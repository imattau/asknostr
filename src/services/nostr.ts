import { SimplePool, verifyEvent } from 'nostr-tools'
import type { Filter, Event } from 'nostr-tools'
import { signerService } from './signer'
import { sanitizeRelayUrls } from '../utils/relays'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://nostr.mom',
  'wss://purplerelay.com'
]

export const DISCOVERY_RELAYS = [
  ...new Set([
    ...DEFAULT_RELAYS,
    'wss://purplepag.es',
    'wss://relay.nostr.band',
    'wss://relay.primal.net',
    'wss://nostr.land',
    'wss://relay.snort.social'
  ])
]

export const SEARCH_RELAYS = [
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://search.nos.lol',
  'wss://relay.noswhere.com'
]

export enum SubscriptionPriority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2
}

interface SubscriptionRequest {
  subId: string
  filters: Filter[]
  onEvent: (event: Event) => void
  relays: string[]
  priority: SubscriptionPriority
  options?: { onEose?: () => void }
  sharedKey?: string
}

interface SharedSubscription {
  key: string
  filters: Filter[]
  relays: string[]
  listeners: Set<(event: Event) => void>
  eoseCallbacks: Set<() => void>
  refCount: number
  priority: SubscriptionPriority
  request: SubscriptionRequest
  closeFn?: () => void
  isTerminated: boolean
}

type FeedEventMessage = { type: 'feed-event'; key: string; event: Event }
type FeedSnapshotMessage = { type: 'feed-snapshot'; key: string; events: Event[] }

interface FeedRegistryEntry {
  filters: Filter[]
  relays: string[]
  limit: number
  eventListeners: Set<(event: Event) => void>
  snapshotResolvers: Set<(events: Event[]) => void>
}

type WorkerToMainMessage =
  | { type: 'event'; subId: string; event: Event }
  | { type: 'eose'; subId: string }
  | { type: 'closed'; subId: string }
  | { type: 'error'; subId?: string; message: string }
  | FeedEventMessage
  | FeedSnapshotMessage

interface WorkerSubscriptionEntry {
  request: SubscriptionRequest
  seenIds: Set<string>
}

class NostrService {
  private pool: SimplePool
  private relays: string[]
  private worker: Worker | null = null
  private maxActiveRelays: number = 8
  private workerSubscriptions = new Map<string, WorkerSubscriptionEntry>()
  private feedRegistry = new Map<string, FeedRegistryEntry>()

  // Rate Limiting & Queuing
  private subscriptionQueue: SubscriptionRequest[] = []
  private activeSubscriptionsCount = 0
  private readonly MAX_CONCURRENT_SUBS = 10
  private readonly SUB_BURST_INTERVAL_MS = 250
  private sharedSubscriptions = new Map<string, SharedSubscription>()

  // Batching System
  private batchTimeout: ReturnType<typeof setTimeout> | null = null
  private profileBatch = new Set<string>()
  private reactionBatch = new Set<string>()
  private zapBatch = new Set<string>()
  private replyCountBatch = new Set<string>()
  private listeners = new Map<string, Set<(event: Event) => void>>()

  constructor(relays: string[] = DEFAULT_RELAYS) {
    this.pool = new SimplePool()
    this.relays = sanitizeRelayUrls(relays).slice(0, this.maxActiveRelays)
    
    if (typeof window !== 'undefined') {
      this.worker = new Worker(new URL('../workers/nostrWorker.ts', import.meta.url), { type: 'module' })
      this.worker.addEventListener('message', (event) => this.handleWorkerMessage(event))
      this.worker.addEventListener('error', () => {
        // worker errors handled silently to avoid console noise
      })
    }
  }

  getFeedKey(filters: Filter[], relays: string[] | undefined, limit: number) {
    const normalizedFilters = filters.map(filter => this.normalizeFilterForKey(filter))
    const resolvedRelays = relays && relays.length ? this.normalizeRelays(relays) : this.relays
    const sortedRelays = [...new Set(resolvedRelays)].sort()
    return `feed:${JSON.stringify(normalizedFilters)}|${JSON.stringify(sortedRelays)}|${limit}`
  }

  registerFeed(
    key: string,
    filters: Filter[],
    relays: string[] | undefined,
    limit: number,
    onEvent: (event: Event) => void
  ) {
    if (!this.worker) {
      return () => undefined
    }

    const resolvedRelays = relays && relays.length ? this.normalizeRelays(relays) : this.relays
    const entry = this.ensureFeedEntry(key, filters, resolvedRelays, limit)
    entry.eventListeners.add(onEvent)

    return () => {
      entry.eventListeners.delete(onEvent)
      this.maybeCleanupFeedEntry(key, entry)
    }
  }

  async requestFeedSnapshot(
    key: string,
    filters: Filter[],
    relays: string[] | undefined,
    limit: number
  ): Promise<Event[]> {
    if (!this.worker) {
      return this.legacyFetchFeedSnapshot(filters, relays, limit)
    }

    const resolvedRelays = relays && relays.length ? this.normalizeRelays(relays) : this.relays
    const entry = this.ensureFeedEntry(key, filters, resolvedRelays, limit)

    return new Promise<Event[]>((resolve) => {
      const resolver = (events: Event[]) => {
        entry.snapshotResolvers.delete(resolver)
        resolve(events)
        this.maybeCleanupFeedEntry(key, entry)
      }
      entry.snapshotResolvers.add(resolver)
      this.worker?.postMessage({ type: 'snapshot_request', key })
    })
  }

  private ensureFeedEntry(key: string, filters: Filter[], relays: string[], limit: number): FeedRegistryEntry {
    const normalizedFilters = filters.map(filter => ({ ...filter }))
    const normalizedRelays = [...new Set(relays)]
    let entry = this.feedRegistry.get(key)
    if (!entry) {
      entry = {
        filters: normalizedFilters,
        relays: normalizedRelays,
        limit,
        eventListeners: new Set(),
        snapshotResolvers: new Set()
      }
      this.feedRegistry.set(key, entry)
    } else {
      entry.filters = normalizedFilters
      entry.relays = normalizedRelays
      entry.limit = limit
    }
    this.worker?.postMessage({
      type: 'register_feed',
      key,
      filters: normalizedFilters,
      relays: normalizedRelays,
      limit
    })
    return entry
  }

  private async legacyFetchFeedSnapshot(filters: Filter[], relays: string[] | undefined, limit: number): Promise<Event[]> {
    return new Promise<Event[]>((resolve) => {
      const events: Event[] = []
      const relaysToUse = relays && relays.length ? relays : this.relays
      const filtersWithLimit = filters.map(filter => ({ ...filter, limit }))
      let settled = false
      let timeout: ReturnType<typeof setTimeout>
      const finalize = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        sub.close()
        const sorted = [...events].sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
        resolve(sorted.slice(0, limit))
      }

      const sub = this.subscribe(
        filtersWithLimit,
        (event: Event) => {
          if (!events.some(e => e.id === event.id)) {
            events.push(event)
          }
        },
        relaysToUse,
        {
          priority: SubscriptionPriority.HIGH,
          onEose: finalize
        }
      )
      timeout = setTimeout(finalize, 4000)
    })
  }

  getRelays() {
    return this.relays
  }

  getDiscoveryRelays() {
    return [...new Set([...DISCOVERY_RELAYS, ...this.relays])].slice(0, this.maxActiveRelays)
  }

  getSearchRelays() {
    return [...new Set([...SEARCH_RELAYS, ...this.relays])].slice(0, this.maxActiveRelays)
  }

  async addRelays(newRelays: string[]) {
    const combined = sanitizeRelayUrls([...this.relays, ...newRelays])
    this.relays = combined.slice(0, this.maxActiveRelays)
  }

  async setRelays(newRelays: string[]) {
    this.relays = sanitizeRelayUrls(newRelays).slice(0, this.maxActiveRelays)
  }

  private normalizeRelays(relays: string[]) {
    return sanitizeRelayUrls(relays).slice(0, this.maxActiveRelays)
  }

  private getSubscriptionKey(filters: Filter[], relays: string[]) {
    const normalizedFilters = filters.map(filter => this.normalizeFilterForKey(filter))
    const sortedRelays = [...new Set(relays)].sort()
    return `${JSON.stringify(normalizedFilters)}|${JSON.stringify(sortedRelays)}`
  }

  private normalizeFilterForKey(filter: Filter): Filter {
    const normalized: Record<string, unknown> = {}
    const source = filter as Record<string, unknown>
    Object.keys(source).sort().forEach(key => {
      const value = source[key]
      if (Array.isArray(value)) {
        normalized[key] = [...value]
      } else if (value && typeof value === 'object') {
        normalized[key] = this.normalizeFilterForKey(value as Filter)
      } else {
        normalized[key] = value
      }
    })
    return normalized as Filter
  }

  private handleWorkerMessage = (event: MessageEvent) => {
    const data = event.data as WorkerToMainMessage
    if (!data || !data.type) return

    const subscriptionEntry = data.subId ? this.workerSubscriptions.get(data.subId) : undefined

    switch (data.type) {
      case 'event':
        if (!subscriptionEntry) return
        if (subscriptionEntry.seenIds.has(data.event.id)) return
        subscriptionEntry.seenIds.add(data.event.id)
        subscriptionEntry.request.onEvent(data.event)
        break
      case 'eose':
        subscriptionEntry?.request.options?.onEose?.()
        break
      case 'closed':
        this.workerSubscriptions.delete(data.subId)
        this.activeSubscriptionsCount = Math.max(0, this.activeSubscriptionsCount - 1)
        this.processQueue()
        break
      case 'error':
        // optionally log to a monitoring service if needed
        if (data.subId) {
          this.workerSubscriptions.delete(data.subId)
          this.activeSubscriptionsCount = Math.max(0, this.activeSubscriptionsCount - 1)
          this.processQueue()
        }
        break
      case 'feed-event': {
        const entry = this.feedRegistry.get(data.key)
        if (!entry) return
        entry.eventListeners.forEach(listener => listener(data.event))
        break
      }
      case 'feed-snapshot': {
        const entry = this.feedRegistry.get(data.key)
        if (!entry) return
        const sorted = [...data.events].sort((a, b) => b.created_at - a.created_at || a.id.localeCompare(b.id))
        entry.snapshotResolvers.forEach(resolver => resolver(sorted))
        entry.snapshotResolvers.clear()
        this.maybeCleanupFeedEntry(data.key, entry)
        break
      }
    }
  }

  private createSharedSubscription(key: string, filters: Filter[], relays: string[], priority: SubscriptionPriority): SharedSubscription {
    const subId = Math.random().toString(36).slice(2, 9)
    const shared: SharedSubscription = {
      key,
      filters,
      relays,
      listeners: new Set(),
      eoseCallbacks: new Set(),
      refCount: 0,
      priority,
      request: {} as SubscriptionRequest,
      isTerminated: false
    }
    const request: SubscriptionRequest = {
      subId,
      sharedKey: key,
      filters,
      onEvent: (event) => {
        shared.listeners.forEach(listener => {
          try {
            listener(event)
      } catch {
        // swallow shared listener errors
      }
        })
      },
      relays,
      priority,
      options: {
        onEose: () => {
          shared.eoseCallbacks.forEach(cb => {
            try {
              cb()
            } catch {
              // swallow shared onEose errors
            }
          })
        }
      },
    }
    shared.request = request
    return shared
  }

  private closeSharedSubscription(shared: SharedSubscription) {
    if (shared.isTerminated) return
    shared.isTerminated = true

    shared.closeFn?.()
    this.subscriptionQueue = this.subscriptionQueue.filter(req => req !== shared.request)

    if (this.sharedSubscriptions.get(shared.key) === shared) {
      this.sharedSubscriptions.delete(shared.key)
    }

    this.processQueue()
  }

  private maybeCleanupFeedEntry(key: string, entry: FeedRegistryEntry) {
    if (entry.eventListeners.size === 0 && entry.snapshotResolvers.size === 0) {
      this.feedRegistry.delete(key)
      this.worker?.postMessage({ type: 'unregister_feed', key })
    }
  }

  // --- Metadata Batching System ---

  requestMetadata(type: 'profile' | 'reactions' | 'zaps' | 'replies', id: string, onEvent: (event: Event) => void) {
    const key = `${type}:${id}`
    if (!this.listeners.has(key)) this.listeners.set(key, new Set())
    this.listeners.get(key)!.add(onEvent)

    if (type === 'profile') this.profileBatch.add(id)
    if (type === 'reactions') this.reactionBatch.add(id)
    if (type === 'zaps') this.zapBatch.add(id)
    if (type === 'replies') this.replyCountBatch.add(id)

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.flushMetadataBatch(), 1500) 
    }

    return () => {
      this.listeners.get(key)?.delete(onEvent)
    }
  }

  private async flushMetadataBatch() {
    this.batchTimeout = null
    const profiles = Array.from(this.profileBatch)
    const reactions = Array.from(this.reactionBatch)
    const zaps = Array.from(this.zapBatch)
    const replies = Array.from(this.replyCountBatch)

    this.profileBatch.clear()
    this.reactionBatch.clear()
    this.zapBatch.clear()
    this.replyCountBatch.clear()

    if (!profiles.length && !reactions.length && !zaps.length && !replies.length) return

    const filters: Filter[] = []
    if (profiles.length) filters.push({ kinds: [0], authors: profiles })
    if (reactions.length) filters.push({ kinds: [7], '#e': reactions })
    if (zaps.length) filters.push({ kinds: [9735], '#e': zaps })
    if (replies.length) filters.push({ kinds: [1], '#e': replies })

    const sub = this.subscribe(filters, (event) => {
      if (event.kind === 0) {
        this.listeners.get(`profile:${event.pubkey}`)?.forEach(cb => cb(event))
      } else if (event.kind === 7 || event.kind === 9735 || event.kind === 1) {
        const eTag = event.tags.find(t => t[0] === 'e')?.[1]
        if (eTag) {
          const type = event.kind === 7 ? 'reactions' : event.kind === 9735 ? 'zaps' : 'replies'
          this.listeners.get(`${type}:${eTag}`)?.forEach(cb => cb(event))
        }
      }
    }, this.getDiscoveryRelays(), { priority: SubscriptionPriority.LOW })

    setTimeout(() => sub.close(), 10000)
  }

  // --- End Batching System ---

  subscribe(
    filters: Filter[],
    onEvent: (event: Event) => void,
    customRelays?: string[],
    options?: { onEose?: () => void, priority?: SubscriptionPriority }
  ) {
    const relays = customRelays || this.relays
    const normalizedRelays = this.normalizeRelays(relays)
    if (normalizedRelays.length === 0) {
      // no relays available; skip subscription quietly
      return { close: () => undefined }
    }

    const priority = options?.priority ?? SubscriptionPriority.MEDIUM
    const key = this.getSubscriptionKey(filters, normalizedRelays)
    let shared = this.sharedSubscriptions.get(key)

    if (!shared) {
      shared = this.createSharedSubscription(key, filters, normalizedRelays, priority)
      this.sharedSubscriptions.set(key, shared)
      this.subscriptionQueue.push(shared.request)
      this.subscriptionQueue.sort((a, b) => a.priority - b.priority)
      this.processQueue()
      // new shared subscription queued
    } else if (priority < shared.priority) {
      shared.priority = priority
      shared.request.priority = priority
      this.subscriptionQueue.sort((a, b) => a.priority - b.priority)
      // shared subscription upgraded
    } else {
      // reusing shared subscription
    }

    shared.listeners.add(onEvent)
    if (options?.onEose) shared.eoseCallbacks.add(options.onEose)
    shared.refCount++

    let isClosed = false
    const closer = {
      close: () => {
        if (isClosed) return
        isClosed = true
        shared!.listeners.delete(onEvent)
        if (options?.onEose) shared!.eoseCallbacks.delete(options.onEose)
        shared!.refCount--
        if (shared!.refCount <= 0) {
          this.closeSharedSubscription(shared!)
        }
      }
    }

    return closer
  }

  private processQueue() {
    if (this.subscriptionQueue.length > 0) {
      // queue status updated
    }

    if (this.activeSubscriptionsCount >= this.MAX_CONCURRENT_SUBS || this.subscriptionQueue.length === 0) {
      return
    }

    const slotsAvailable = this.MAX_CONCURRENT_SUBS - this.activeSubscriptionsCount
    const toProcess = slotsAvailable

    for (let i = 0; i < toProcess; i++) {
      if (this.subscriptionQueue.length === 0) break
      
      const request = this.subscriptionQueue.shift()!
      this.activeSubscriptionsCount++
      this.executeSubscription(request)
    }
  }

  private executeSubscription(request: SubscriptionRequest) {
    const { filters, relays, subId } = request
    const urls = this.normalizeRelays(relays.slice(0, this.maxActiveRelays))
    const cleanFilters = filters.filter(f => f && typeof f === 'object' && Object.keys(f).length > 0)

    if (urls.length === 0 || cleanFilters.length === 0) {
      // skip empty subscription silently
      this.activeSubscriptionsCount--
      this.processQueue()
      return
    }

    const shared = request.sharedKey ? this.sharedSubscriptions.get(request.sharedKey) : null

    if (this.worker) {
      this.workerSubscriptions.set(subId, { request, seenIds: new Set() })
      if (shared) {
        shared.closeFn = () => this.worker?.postMessage({ type: 'close', subId })
      }
      this.worker.postMessage({
        type: 'subscribe',
        subId,
        filters: cleanFilters,
        relays: urls
      })
      setTimeout(() => this.processQueue(), this.SUB_BURST_INTERVAL_MS)
      return
    }

    this.executeSubscriptionLegacy(request, urls, cleanFilters, shared)
  }

  private executeSubscriptionLegacy(
    request: SubscriptionRequest,
    urls: string[],
    cleanFilters: Filter[],
    shared: SharedSubscription | undefined | null
  ) {
    const { onEvent, options, subId } = request
    const subscriptionSeenIds = new Set<string>()
    const wrappedCallback = (event: Event) => {
      if (subscriptionSeenIds.has(event.id)) return
      subscriptionSeenIds.add(event.id)
      try {
        if (verifyEvent(event)) {
          onEvent(event)
        }
    } catch {
      // optionally log verification errors
    }
    }

    try {
      const subscription = this.pool.subscribeMap(
        urls.flatMap(url => cleanFilters.map(f => ({ url, filter: f }))),
        {
          onevent: wrappedCallback,
          oneose: () => {
            // eose received
            options?.onEose?.()
          },
          onclose: () => {
            // relay connection closed
            this.activeSubscriptionsCount = Math.max(0, this.activeSubscriptionsCount - 1)
            this.processQueue()
          }
        }
      )
      // subscription established
      if (shared) {
        shared.closeFn = () => subscription.close()
      }
      setTimeout(() => this.processQueue(), this.SUB_BURST_INTERVAL_MS)
    } catch (e) {
      console.error(`[Nostr] [${subId}] Subscription failed execution:`, e)
      this.activeSubscriptionsCount = Math.max(0, this.activeSubscriptionsCount - 1)
      this.processQueue()
    }
  }

  async fetchRelayList(pubkey: string) {
    return new Promise<string[]>((resolve) => {
      let latestEvent: Event | null = null
      
      const discoveryUrls = this.normalizeRelays(DISCOVERY_RELAYS)
      const fallbackUrls = this.normalizeRelays(this.relays)
      const urls = Array.from(new Set([...discoveryUrls, ...fallbackUrls]))

      const sub = this.subscribe(
        [{ kinds: [10002, 10001, 3], authors: [pubkey], limit: 1 }],
        (event: Event) => {
          if (!latestEvent || event.created_at > latestEvent.created_at) {
            latestEvent = event
          }
        },
        urls,
        { priority: SubscriptionPriority.HIGH }
      )

      setTimeout(() => {
        sub.close()
        if (!latestEvent) {
          resolve([])
          return
        }

        let relays: string[] = []
        if (latestEvent.kind === 10002 || latestEvent.kind === 10001) {
          relays = (latestEvent.tags || [])
            .filter(t => t[0] === 'r')
            .map(t => t[1])
        } else if (latestEvent.kind === 3) {
          try {
            const content = JSON.parse(latestEvent.content)
            relays = Object.keys(content)
          } catch {
            // Ignore
          }
        }

        const filtered = relays.filter(r => r.startsWith('wss://') || r.startsWith('ws://'))
        resolve(filtered)
      }, 6000)
    })
  }

  async publish(event: Event): Promise<boolean> {
    if (this.relays.length === 0) {
      return false
    }
    const targetRelays = [...new Set([...this.relays, ...DISCOVERY_RELAYS])].slice(0, 15)
    return this.publishToRelays(targetRelays, event)
  }

  async publishToRelays(relays: string[], event: Event): Promise<boolean> {
    const urls = this.normalizeRelays(relays)
    if (urls.length === 0) {
      return false
    }
    const promises = this.pool.publish(urls, event)
    try {
      await Promise.any(promises)
      return true
    } catch {
      return false
    }
  }

  async createAndPublishPost(content: string, tags: string[][] = []) {
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: content,
    }
    const signedEvent = await signerService.signEvent(eventTemplate)
    return this.publish(signedEvent)
  }

  async getRelayStatus(url: string): Promise<boolean> {
    try {
      const relay = await this.pool.ensureRelay(url)
      return relay.connected
    } catch {
      return false
    }
  }

  close() {
    this.pool.close(this.relays)
    this.worker?.terminate()
  }
}

export const nostrService = new NostrService()

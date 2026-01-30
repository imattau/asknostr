import { SimplePool } from 'nostr-tools'
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
  filters: Filter[]
  onEvent: (event: Event) => void
  relays: string[]
  priority: SubscriptionPriority
  options?: { onEose?: () => void }
  resolve: (closer: { close: () => void }) => void
}

class NostrService {
  private pool: SimplePool
  private relays: string[]
  private worker: Worker | null = null
  private pendingValidations = new Map<string, { resolve: (ok: boolean) => void, timeoutId: ReturnType<typeof setTimeout> }>()
  private validationCache = new Map<string, boolean>()
  private maxActiveRelays: number = 4 // Reduced to 4 to prevent browser connection limits
  private activeWorkerRequests: number = 0
  private readonly MAX_CONCURRENT_VERIFICATIONS = 50
  private readonly MAX_CACHE_SIZE = 10000

  // Rate Limiting & Queuing
  private subscriptionQueue: SubscriptionRequest[] = []
  private activeSubscriptionsCount = 0
  private readonly MAX_CONCURRENT_SUBS = 10 // Reduced from 20 to prevent relay overload
  private readonly SUB_BURST_INTERVAL_MS = 250 // Increased from 50 to give relays breathing room

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
      this.worker = new Worker('/event-worker.js', { type: 'module' })
      this.worker.addEventListener('message', (e: MessageEvent) => {
        const processResult = () => {
          this.activeWorkerRequests = Math.max(0, this.activeWorkerRequests - 1)
          const { id, isValid } = e.data || {}
          if (!id) return
          const pending = this.pendingValidations.get(id)
          if (!pending) return
          clearTimeout(pending.timeoutId)
          this.pendingValidations.delete(id)
          pending.resolve(!!isValid)
        }

        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(processResult)
        } else {
          processResult()
        }
      })
    }
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

  private async verifyInWorker(event: Event): Promise<boolean> {
    if (this.validationCache.has(event.id)) {
      return this.validationCache.get(event.id)!
    }

    if (!this.worker) return true
    
    if (this.pendingValidations.has(event.id)) {
      return new Promise((resolve) => {
        const existing = this.pendingValidations.get(event.id)
        if (!existing) return resolve(true)
        const originalResolve = existing.resolve
        existing.resolve = (ok: boolean) => {
          originalResolve(ok)
          resolve(ok)
        }
      })
    }

    if (this.activeWorkerRequests > this.MAX_CONCURRENT_VERIFICATIONS) {
      await new Promise(r => setTimeout(r, 100))
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.activeWorkerRequests = Math.max(0, this.activeWorkerRequests - 1)
        this.pendingValidations.delete(event.id)
        resolve(true)
      }, 3000)

      this.pendingValidations.set(event.id, { 
        resolve: (isValid: boolean) => {
          if (this.validationCache.size >= this.MAX_CACHE_SIZE) {
            const firstKey = this.validationCache.keys().next().value
            if (firstKey) this.validationCache.delete(firstKey)
          }
          this.validationCache.set(event.id, isValid)
          resolve(isValid)
        }, 
        timeoutId 
      })
      this.activeWorkerRequests++
      this.worker?.postMessage({ event })
    })
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
      this.batchTimeout = setTimeout(() => this.flushMetadataBatch(), 1500) // Increased window for larger batches
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

    console.log(`[NostrBatch] Flushing batch: ${profiles.length} profiles, ${reactions.length} reactions, ${zaps.length} zaps, ${replies.length} replies`)

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

    setTimeout(() => sub.close(), 10000) // Metadata snapshots close faster
  }

  // --- End Batching System ---

  subscribe(
    filters: Filter[],
    onEvent: (event: Event) => void,
    customRelays?: string[],
    options?: { onEose?: () => void, priority?: SubscriptionPriority }
  ) {
    let underlyingSub: { close: () => void } | null = null
    let isClosed = false

    const resolveRequest = (sub: { close: () => void }) => {
      if (isClosed) {
        sub.close()
        this.activeSubscriptionsCount--
        this.processQueue()
      } else {
        underlyingSub = sub
      }
    }

    const closer = {
      close: () => {
        isClosed = true
        if (underlyingSub) {
          underlyingSub.close()
          this.activeSubscriptionsCount--
          this.processQueue()
        } else {
          this.subscriptionQueue = this.subscriptionQueue.filter(req => req.resolve !== resolveRequest)
        }
      }
    }

    const request: SubscriptionRequest = {
      filters,
      onEvent,
      relays: customRelays || this.relays,
      priority: options?.priority ?? SubscriptionPriority.MEDIUM,
      options,
      resolve: resolveRequest
    }

    this.subscriptionQueue.push(request)
    this.subscriptionQueue.sort((a, b) => a.priority - b.priority)
    this.processQueue()

    return closer
  }

  private processQueue() {
    if (this.activeSubscriptionsCount >= this.MAX_CONCURRENT_SUBS || this.subscriptionQueue.length === 0) {
      return
    }

    const slotsAvailable = this.MAX_CONCURRENT_SUBS - this.activeSubscriptionsCount
    const toProcess = Math.min(slotsAvailable, 2) // Reduced burst size to 2

    for (let i = 0; i < toProcess; i++) {
      if (this.subscriptionQueue.length === 0) break
      
      const request = this.subscriptionQueue.shift()!
      this.activeSubscriptionsCount++
      this.executeSubscription(request)
    }
  }

  private executeSubscription(request: SubscriptionRequest) {
    const { filters, onEvent, relays, options, resolve } = request
    const urls = this.normalizeRelays(relays.slice(0, this.maxActiveRelays))
    const cleanFilters = filters.filter(f => f && typeof f === 'object' && Object.keys(f).length > 0)

    if (urls.length === 0 || cleanFilters.length === 0) {
      this.activeSubscriptionsCount--
      resolve({ close: () => {} })
      this.processQueue()
      return
    }

    const subscriptionSeenIds = new Set<string>()
    const wrappedCallback = async (event: Event) => {
      if (subscriptionSeenIds.has(event.id)) return
      subscriptionSeenIds.add(event.id)
      const isValid = await this.verifyInWorker(event)
      if (isValid) onEvent(event)
    }

    try {
      // Using subscribeMany instead of subscribeMap to consolidate REQs
      const subscription = this.pool.subscribeMany(
        urls,
        cleanFilters,
        {
          onevent: wrappedCallback,
          oneose: () => options?.onEose?.(),
          onclose: () => {}
        }
      )

      resolve({
        close: () => subscription.close()
      })

      setTimeout(() => this.processQueue(), this.SUB_BURST_INTERVAL_MS)
    } catch (e) {
      console.error('[Nostr] Subscription failed:', e)
      this.activeSubscriptionsCount--
      resolve({ close: () => {} })
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
    } catch (e) {
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
    this.pendingValidations.clear()
  }
}

export const nostrService = new NostrService()
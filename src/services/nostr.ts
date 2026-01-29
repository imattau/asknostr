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
  ...DEFAULT_RELAYS,
  'wss://purplepag.es',
  'wss://relay.nostr.band',
  'wss://relay.primal.net',
  'wss://nostr.land'
]

export const SEARCH_RELAYS = [
  'wss://relay.nostr.band',
  'wss://nostr.wine',
  'wss://search.nos.lol',
  'wss://relay.noswhere.com'
]

class NostrService {
  private pool: SimplePool
  private relays: string[]
  private worker: Worker | null = null
  private pendingValidations = new Map<string, { resolve: (ok: boolean) => void, timeoutId: ReturnType<typeof setTimeout> }>()
  private maxActiveRelays: number = 20

  constructor(relays: string[] = DEFAULT_RELAYS) {
    this.pool = new SimplePool()
    this.relays = sanitizeRelayUrls(relays).slice(0, this.maxActiveRelays)
    
    if (typeof window !== 'undefined') {
      this.worker = new Worker('/event-worker.js', { type: 'module' })
      this.worker.addEventListener('message', (e: MessageEvent) => {
        const { id, isValid } = e.data || {}
        if (!id) return
        const pending = this.pendingValidations.get(id)
        if (!pending) return
        clearTimeout(pending.timeoutId)
        this.pendingValidations.delete(id)
        pending.resolve(!!isValid)
      })
    }
  }

  getRelays() {
    return this.relays
  }

  getDiscoveryRelays() {
    // Prioritize global discovery relays for finding metadata/subscriptions
    return [...new Set([...DISCOVERY_RELAYS, ...this.relays])].slice(0, this.maxActiveRelays)
  }

  getSearchRelays() {
    return [...new Set([...this.relays, ...SEARCH_RELAYS])].slice(0, this.maxActiveRelays)
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
    if (!this.worker) return true
    if (this.pendingValidations.has(event.id)) {
      return new Promise((resolve) => {
        const existing = this.pendingValidations.get(event.id)
        if (!existing) return resolve(true)
        const chainedResolve = (ok: boolean) => resolve(ok)
        const originalResolve = existing.resolve
        existing.resolve = (ok: boolean) => {
          originalResolve(ok)
          chainedResolve(ok)
        }
      })
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        this.pendingValidations.delete(event.id)
        console.warn('[Nostr] Verify timeout, allowing event:', event.id)
        resolve(true)
      }, 1500)

      this.pendingValidations.set(event.id, { resolve, timeoutId })
      this.worker?.postMessage({ event })
    })
  }

  async subscribe(
    filters: Filter[],
    onEvent: (event: Event) => void,
    customRelays?: string[],
    options?: { onEose?: () => void }
  ) {
    const sourceRelays = customRelays && customRelays.length > 0 ? customRelays : this.relays
    const urls = this.normalizeRelays(sourceRelays.slice(0, this.maxActiveRelays))
    
    if (!Array.isArray(filters) || filters.length === 0) {
      return { close: () => {} }
    }

    const cleanFilters = filters.filter(f => f && typeof f === 'object' && Object.keys(f).length > 0)
    if (cleanFilters.length === 0) {
      return { close: () => {} }
    }

    if (urls.length === 0) {
      console.warn('[Nostr] Subscribe skipped: no valid relay URLs')
      return { close: () => {} }
    }

    console.log('[Nostr] Subscribe:', { urls, filters: cleanFilters })

    const seenIds = new Set<string>()

    const wrappedCallback = async (event: Event) => {
      if (seenIds.has(event.id)) return
      seenIds.add(event.id)
      const isValid = await this.verifyInWorker(event)
      if (isValid) {
        onEvent(event)
      }
    }

    try {
      // THE FIX: SimplePool.subscribe expects a SINGLE filter.
      // We must map our filter array to individual subscriptions and composite the closers.
      let eoseCount = 0
      const total = cleanFilters.length
      const onEose = () => {
        eoseCount += 1
        if (eoseCount >= total) {
          options?.onEose?.()
        }
      }

      const subs = cleanFilters.map(filter => {
        let eosed = false
        const subscription = this.pool.subscribe(
          urls,
          filter,
          {
            onevent: wrappedCallback,
            oneose: () => {
              if (eosed) return
              eosed = true
              console.log('[Nostr] Subscription EOSE')
              onEose()
            },
            onclose: (reasons: string[]) => {
              console.log('[Nostr] Subscription closed:', reasons)
            }
          }
        )
        return subscription
      })

      let closed = false
      return {
        close: () => {
          if (closed) return
          closed = true
          subs.forEach(sub => sub.close())
        }
      }
    } catch (e) {
      console.error('[Nostr] Subscription critical failure:', e)
      return { close: () => {} }
    }
  }

  async fetchRelayList(pubkey: string) {
    return new Promise<string[]>((resolve) => {
      let latestEvent: Event | null = null
      
      const discoveryUrls = this.normalizeRelays(DISCOVERY_RELAYS)
      const fallbackUrls = this.normalizeRelays(this.relays)
      const urls = Array.from(new Set([...discoveryUrls, ...fallbackUrls]))

      this.subscribe(
        [{ kinds: [10002, 10001, 3], authors: [pubkey], limit: 1 }],
        (event: Event) => {
          if (!latestEvent || event.created_at > latestEvent.created_at) {
            latestEvent = event
          }
        },
        urls
      ).then(sub => {
        setTimeout(() => {
          sub.close()
          if (!latestEvent) {
            resolve([])
            return
          }

          let relays: string[] = []
          if (latestEvent.kind === 10002 || latestEvent.kind === 10001) {
            relays = latestEvent.tags
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
    })
  }

  async publish(event: Event): Promise<boolean> {
    if (this.relays.length === 0) {
      console.warn('No relays configured for broadcast.')
      return false
    }
    const targetRelays = [...new Set([...this.relays, ...DISCOVERY_RELAYS])].slice(0, 15)
    return this.publishToRelays(targetRelays, event)
  }

  async publishToRelays(relays: string[], event: Event): Promise<boolean> {
    const urls = this.normalizeRelays(relays)
    if (urls.length === 0) {
      console.warn('[Nostr] Publish skipped: no valid relay URLs')
      return false
    }
    console.log('[Nostr] Publishing Event:', event.id, 'to', urls.length, 'relays')
    const promises = this.pool.publish(urls, event)
    try {
      await Promise.any(promises)
      console.log('[Nostr] Event successfully accepted by at least one relay.')
      return true
    } catch (e) {
      console.warn('[Nostr] Broadcast might have failed on all relays', e)
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

  close() {
    this.pool.close(this.relays)
    this.worker?.terminate()
    this.pendingValidations.clear()
  }
}

export const nostrService = new NostrService()

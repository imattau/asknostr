import { SimplePool, utils } from 'nostr-tools'
import type { Filter, Event } from 'nostr-tools'
import { signerService } from './signer'

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
  private maxActiveRelays: number = 20

  constructor(relays: string[] = DEFAULT_RELAYS) {
    this.pool = new SimplePool()
    this.relays = relays
    
    if (typeof window !== 'undefined') {
      this.worker = new Worker('/event-worker.js', { type: 'module' })
    }
  }

  getRelays() {
    return this.relays
  }

  getDiscoveryRelays() {
    return [...new Set([...this.relays, ...DISCOVERY_RELAYS])].slice(0, this.maxActiveRelays)
  }

  getSearchRelays() {
    return [...new Set([...this.relays, ...SEARCH_RELAYS])].slice(0, this.maxActiveRelays)
  }

  async addRelays(newRelays: string[]) {
    const combined = [...new Set([...this.relays, ...newRelays])]
    this.relays = combined.slice(0, this.maxActiveRelays)
  }

  async setRelays(newRelays: string[]) {
    this.relays = [...new Set(newRelays)].slice(0, this.maxActiveRelays)
  }

  private async verifyInWorker(event: Event): Promise<boolean> {
    if (!this.worker) return true
    return new Promise((resolve) => {
      const handler = (e: MessageEvent) => {
        if (e.data.id === event.id) {
          this.worker?.removeEventListener('message', handler)
          resolve(e.data.isValid)
        }
      }
      this.worker?.addEventListener('message', handler)
      this.worker?.postMessage({ event })
    })
  }

  async subscribe(filters: Filter[], onEvent: (event: Event) => void, customRelays?: string[]) {
    const urls = (customRelays || this.relays).slice(0, this.maxActiveRelays).map(u => utils.normalizeURL(u))
    
    if (!Array.isArray(filters) || filters.length === 0) {
      return { close: () => {} }
    }

    const cleanFilters = filters.filter(f => f && typeof f === 'object' && Object.keys(f).length > 0)
    if (cleanFilters.length === 0) {
      return { close: () => {} }
    }

    console.log('[Nostr] Subscribe:', { urls, filters: cleanFilters })

    const wrappedCallback = async (event: Event) => {
      const isValid = await this.verifyInWorker(event)
      if (isValid) {
        onEvent(event)
      }
    }

    try {
      // THE FIX: SimplePool.subscribe expects a SINGLE filter.
      // We must map our filter array to individual subscriptions and composite the closers.
      const subs = cleanFilters.map(filter => 
        this.pool.subscribe(
          urls,
          filter,
          {
            onevent: wrappedCallback,
            oneose: () => {
              console.log('[Nostr] Subscription EOSE')
            },
            onclose: (reasons: string[]) => {
              console.log('[Nostr] Subscription closed:', reasons)
            }
          }
        )
      )

      return {
        close: () => {
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
      
      this.subscribe(
        [{ kinds: [10002, 10001, 3], authors: [pubkey], limit: 1 }],
        (event: Event) => {
          if (!latestEvent || event.created_at > latestEvent.created_at) {
            latestEvent = event
          }
        },
        this.getDiscoveryRelays()
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
    console.log('[Nostr] Publishing Event:', event.id, 'to', relays.length, 'relays')
    const promises = this.pool.publish(relays, event)
    try {
      await Promise.any(promises)
      console.log('[Nostr] Event successfully accepted by at least one relay.')
      return true
    } catch (e) {
      console.warn('[Nostr] Broadcast might have failed on all relays', e)
      return false
    }
  }

  async createAndPublishPost(content: string) {
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: content,
    }
    const signedEvent = await signerService.signEvent(eventTemplate)
    return this.publish(signedEvent)
  }

  close() {
    this.pool.close(this.relays)
    this.worker?.terminate()
  }
}

export const nostrService = new NostrService()
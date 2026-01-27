import { SimplePool } from 'nostr-tools'
import type { Filter, Event } from 'nostr-tools'

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.snort.social',
  'wss://offchain.pub',
  'wss://relay.nostr.band'
]

class NostrService {
  private pool: SimplePool
  private relays: string[]
  private batchTimeout: number = 100
  private pendingFilters: Filter[] = []
  private pendingCallbacks: ((event: Event) => void)[] = []
  private batchTimer: ReturnType<typeof setTimeout> | null = null
  private worker: Worker | null = null
  private maxActiveRelays: number = 8

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

  async addRelays(newRelays: string[]) {
    // Limit total active relays for pooling optimization
    const combined = [...new Set([...this.relays, ...newRelays])]
    this.relays = combined.slice(0, this.maxActiveRelays)
  }

  async setRelays(newRelays: string[]) {
    this.relays = [...new Set(newRelays)].slice(0, this.maxActiveRelays)
  }

  private async verifyInWorker(event: Event): Promise<boolean> {
    if (!this.worker) return true // Fallback if no worker
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
    const targetRelays = (customRelays || this.relays).slice(0, this.maxActiveRelays)
    
    const wrappedCallback = async (event: Event) => {
      // Offload verification to worker
      const isValid = await this.verifyInWorker(event)
      if (isValid) {
        onEvent(event)
      }
    }

    if (customRelays) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (this.pool as any).subscribeMany(
        targetRelays,
        filters,
        {
          onevent: wrappedCallback,
          oneose: () => {}
        }
      )
    }

    return new Promise<{ close: () => void }>((resolve) => {
      this.pendingFilters.push(...filters)
      this.pendingCallbacks.push(wrappedCallback)

      if (this.batchTimer) clearTimeout(this.batchTimer)
      
      this.batchTimer = setTimeout(async () => {
        const filtersToRun = [...this.pendingFilters]
        const callbacksToRun = [...this.pendingCallbacks]
        this.pendingFilters = []
        this.pendingCallbacks = []
        this.batchTimer = null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sub = (this.pool as any).subscribeMany(
          this.relays,
          filtersToRun,
          {
            onevent: (event: Event) => {
              callbacksToRun.forEach(cb => cb(event))
            },
            oneose: () => {}
          }
        )
        resolve(sub)
      }, this.batchTimeout)
    })
  }

  async fetchRelayList(pubkey: string) {
    return new Promise<string[]>((resolve) => {
      let found = false
      this.subscribe(
        [{ kinds: [10002], authors: [pubkey], limit: 1 }],
        (event: Event) => {
          const relays = event.tags
            .filter(t => t[0] === 'r')
            .map(t => t[1])
          found = true
          resolve(relays)
        }
      ).then(sub => {
        setTimeout(() => {
          if (!found) {
            sub.close()
            resolve([])
          }
        }, 3000)
      })
    })
  }

  async publish(event: Event) {
    return Promise.all(this.pool.publish(this.relays, event))
  }

  async createAndPublishPost(content: string) {
    if (!window.nostr) throw new Error('No extension found')
    
    const eventTemplate = {
      kind: 1,
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
      content: content,
    }

    const signedEvent = await window.nostr.signEvent(eventTemplate)
    return this.publish(signedEvent)
  }

  close() {
    this.pool.close(this.relays)
    this.worker?.terminate()
  }
}

export const nostrService = new NostrService()
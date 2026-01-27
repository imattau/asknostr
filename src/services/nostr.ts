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

  constructor(relays: string[] = DEFAULT_RELAYS) {
    this.pool = new SimplePool()
    this.relays = relays
  }

  getRelays() {
    return this.relays
  }

  async addRelays(newRelays: string[]) {
    const uniqueRelays = [...new Set([...this.relays, ...newRelays])]
    this.relays = uniqueRelays
  }

  async setRelays(newRelays: string[]) {
    this.relays = [...new Set(newRelays)]
  }

  async subscribe(filters: Filter[], onEvent: (event: Event) => void, customRelays?: string[]) {
    const targetRelays = customRelays || this.relays
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this.pool as any).subscribeMany(
      targetRelays,
      filters,
      {
        onevent: onEvent,
        oneose: () => {
          console.log('End of stored events')
        }
      }
    )
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
  }
}

export const nostrService = new NostrService()
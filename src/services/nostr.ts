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

  async subscribe(filters: Filter[], onEvent: (event: Event) => void) {
    return this.pool.subscribeMany(
      this.relays,
      filters,
      {
        onevent: onEvent,
        oneose: () => {
          console.log('End of stored events')
        }
      }
    )
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

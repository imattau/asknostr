import type { Event } from 'nostr-tools'
import { signerService } from './signer'
import { nostrService } from './nostr'

export interface ZapOptions {
  amount: number // in sats
  comment?: string
  relays: string[]
}

class ZapService {
  async getZapEndpoint(lud16: string): Promise<string | null> {
    try {
      const [name, domain] = lud16.split('@')
      if (!name || !domain) return null
      
      const url = `https://${domain}/.well-known/lnurlp/${name}`
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.allowsNostr && data.nostrPubkey) {
        return data.callback
      }
      return null
    } catch (err) {
      console.error('[ZapService] Failed to fetch LNURL endpoint', err)
      return null
    }
  }

  async createZapRequest(
    targetEvent: Event,
    amount: number,
    comment: string = '',
    relays: string[]
  ): Promise<Event> {
    const amountInMsats = amount * 1000
    
    const zapRequestTemplate = {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['p', targetEvent.pubkey],
        ['e', targetEvent.id],
        ['amount', amountInMsats.toString()],
        ['relays', ...relays],
      ],
      content: comment,
    }

    if (comment) {
      // zapRequestTemplate.tags.push(['comment', comment]) // content is preferred for comment in 9734
    }

    return signerService.signEvent(zapRequestTemplate)
  }

  async fetchInvoice(callback: string, amount: number, zapRequest: Event): Promise<string | null> {
    try {
      const amountInMsats = amount * 1000
      const url = new URL(callback)
      url.searchParams.append('amount', amountInMsats.toString())
      url.searchParams.append('nostr', JSON.stringify(zapRequest))
      
      const response = await fetch(url.toString())
      const data = await response.json()
      
      return data.pr || null
    } catch (err) {
      console.error('[ZapService] Failed to fetch invoice', err)
      return null
    }
  }

  async sendZap(targetEvent: Event, lud16: string, amount: number, comment?: string): Promise<void> {
    const callback = await this.getZapEndpoint(lud16)
    if (!callback) {
      throw new Error('Recipient does not support Nostr Zaps (NIP-57)')
    }

    const relays = nostrService.getRelays()
    const zapRequest = await this.createZapRequest(targetEvent, amount, comment, relays)
    const invoice = await this.fetchInvoice(callback, amount, zapRequest)

    if (!invoice) {
      throw new Error('Failed to retrieve lightning invoice from provider')
    }

    // Open wallet via lightning: URI
    window.location.href = `lightning:${invoice}`
  }
}

export const zapService = new ZapService()

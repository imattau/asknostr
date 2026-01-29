import type { Event } from 'nostr-tools'
import { signerService } from './signer'
import { nostrService } from './nostr'
import { nwcService } from './nwcService'
import { useStore } from '../store/useStore'

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
    targetPubkey: string,
    amount: number,
    relays: string[],
    comment: string = '',
    targetEventId?: string
  ): Promise<Event> {
    const amountInMsats = amount * 1000
    
    const tags = [
      ['p', targetPubkey],
      ['amount', amountInMsats.toString()],
      ['relays', ...relays],
    ]

    if (targetEventId) {
      tags.push(['e', targetEventId])
    }

    const zapRequestTemplate = {
      kind: 9734,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: comment,
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

  async sendZap(
    targetPubkey: string, 
    lud16: string, 
    amount: number, 
    options?: { eventId?: string, comment?: string }
  ): Promise<void> {
    const callback = await this.getZapEndpoint(lud16)
    if (!callback) {
      throw new Error('Recipient does not support Nostr Zaps (NIP-57)')
    }

    const relays = nostrService.getRelays()
    const zapRequest = await this.createZapRequest(
      targetPubkey, 
      amount, 
      relays, 
      options?.comment || '', 
      options?.eventId
    )
    const invoice = await this.fetchInvoice(callback, amount, zapRequest)

    if (!invoice) {
      throw new Error('Failed to retrieve lightning invoice from provider')
    }

    const { nwcUrl } = useStore.getState()
    if (nwcUrl) {
      try {
        console.log('[ZapService] Attempting automated payment via NWC...')
        await nwcService.payInvoice(invoice)
        return
      } catch (err) {
        console.warn('[ZapService] NWC payment failed, falling back to manual:', err)
      }
    }

    // Open wallet via lightning: URI
    window.location.href = `lightning:${invoice}`
  }
}

export const zapService = new ZapService()

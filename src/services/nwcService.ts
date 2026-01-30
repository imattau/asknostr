import { nip04, getPublicKey, finalizeEvent } from 'nostr-tools'
import { nostrService } from './nostr'
import { useStore } from '../store/useStore'

export interface NwcConnection {
  pubkey: string
  relay: string
  secret: string
}

class NwcService {
  parseNwcUrl(url: string): NwcConnection | null {
    try {
      const parsed = new URL(url.replace('nostr+walletconnect:', 'http:'))
      const pubkey = parsed.host
      const relay = parsed.searchParams.get('relay')
      const secret = parsed.searchParams.get('secret')
      
      if (!pubkey || !relay || !secret) return null
      
      return { pubkey, relay, secret }
    } catch (e) {
      return null
    }
  }

  async sendRequest(method: string, params: any): Promise<any> {
    const { nwcUrl } = useStore.getState()
    if (!nwcUrl) throw new Error('NWC not configured')

    const connection = this.parseNwcUrl(nwcUrl)
    if (!connection) throw new Error('Invalid NWC string')

    const storedSecret = localStorage.getItem('asknostr-client-secret')
    const localSecretKey = new Uint8Array(JSON.parse(storedSecret && storedSecret !== 'undefined' ? storedSecret : '[]'))
    if (!localSecretKey.length) throw new Error('Local secret not found')

    const requestId = Math.random().toString(36).substring(7)
    const request = {
      id: requestId,
      method,
      params
    }

    const encryptedContent = await nip04.encrypt(localSecretKey, connection.pubkey, JSON.stringify(request))
    
    const event = finalizeEvent({
      kind: 23194,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', connection.pubkey]],
      content: encryptedContent
    }, localSecretKey)

    return new Promise((resolve, reject) => {
      let sub: any = null
      const timeout = setTimeout(() => {
        if (sub) sub.close()
        reject(new Error('NWC request timeout'))
      }, 30000)

      nostrService.subscribe(
        [{ kinds: [23195], '#p': [getPublicKey(localSecretKey)], authors: [connection.pubkey] }],
        async (responseEvent) => {
          try {
            const decrypted = await nip04.decrypt(localSecretKey, connection.pubkey, responseEvent.content)
            const response = JSON.parse(decrypted)
            if (response.id === requestId) {
              clearTimeout(timeout)
              if (sub) sub.close()
              if (response.error) {
                reject(new Error(response.error.message || 'NWC error'))
              } else {
                resolve(response.result)
              }
            }
          } catch (e) {
            console.error('[NWC] Failed to decrypt response', e)
          }
        },
        [connection.relay]
      ).then(s => sub = s)

      nostrService.publishToRelays([connection.relay], event)
    })
  }

  async payInvoice(invoice: string): Promise<string> {
    const result = await this.sendRequest('pay_invoice', { invoice })
    return result.preimage
  }
}

export const nwcService = new NwcService()

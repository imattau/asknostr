import { generateSecretKey, getPublicKey, finalizeEvent, nip04 } from 'nostr-tools'
import { normalizeHexPubkey, normalizeRelayUrl } from '../utils/nostr'
import type { Event, EventTemplate } from 'nostr-tools'
import { useStore } from '../store/useStore'
import { nostrService } from './nostr'

type NostrSubscriptionHandle = { close: () => void }

class SignerService {
  private localSecretKey: Uint8Array | null = null

  constructor() {
    const stored = localStorage.getItem('asknostr-client-secret')
    if (stored) {
      this.localSecretKey = new Uint8Array(JSON.parse(stored))
    } else {
      this.localSecretKey = generateSecretKey()
      localStorage.setItem('asknostr-client-secret', JSON.stringify(Array.from(this.localSecretKey)))
    }
  }

  get clientPubkey() {
    return getPublicKey(this.localSecretKey!)
  }

  async signEvent(event: EventTemplate): Promise<Event> {
    const state = useStore.getState()

    const resolvedMethod = state.loginMethod
      || (state.remoteSigner.pubkey && state.remoteSigner.relays.length > 0 ? 'nip46' : null)
      || (window.nostr ? 'nip07' : null)

    if (resolvedMethod === 'nip07') {
      if (!window.nostr) throw new Error('NIP-07 extension missing')
      return window.nostr.signEvent(event)
    }

    if (resolvedMethod === 'nip46') {
      return this.signWithRemote(event)
    }

    if (resolvedMethod === 'local') {
      return this.signWithLocal(event)
    }

    throw new Error('No signer configured')
  }

  async signAuthEvent(url: string, method: string): Promise<Event> {
    const authEvent = {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', url],
        ['method', method],
      ],
      content: '',
    }
    return this.signEvent(authEvent)
  }

  private async signWithRemote(template: EventTemplate): Promise<Event> {
    const state = useStore.getState()
    const { pubkey: bunkerPubkey, relays: bunkerRelays } = state.remoteSigner
    
    if (!bunkerPubkey || !bunkerRelays || bunkerRelays.length === 0) throw new Error('Remote signer not configured')

    console.log('[Signer] NIP-46 Signing via:', bunkerRelays)
    
    // Ensure we are connected to the bunker relays
    await nostrService.addRelays(bunkerRelays)

    const requestId = Math.random().toString(36).substring(7)
    const request = {
      id: requestId,
      method: 'sign_event',
      params: [JSON.stringify(template)]
    }

    const encrypted = await nip04.encrypt(this.localSecretKey!, bunkerPubkey, JSON.stringify(request))
    
    const reqEvent = finalizeEvent({
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', bunkerPubkey]],
      content: encrypted,
    }, this.localSecretKey!)

    return new Promise<Event>((resolve, reject) => {
      const subscriptionRef: { current: NostrSubscriptionHandle | null } = { current: null }
      const cleanup = () => subscriptionRef.current?.close()

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Remote sign timeout'))
      }, 30000)

      nostrService.subscribe(
        [{ kinds: [24133], '#p': [this.clientPubkey], authors: [bunkerPubkey] }],
        async (event) => {
          console.log('[Signer] Received NIP-46 response')
          try {
            const decrypted = await nip04.decrypt(this.localSecretKey!, bunkerPubkey, event.content)
            const response = JSON.parse(decrypted)
            if (response.id === requestId) {
              clearTimeout(timeout)
              cleanup()
              if (response.error) {
                reject(new Error(response.error))
              } else {
                resolve(JSON.parse(response.result))
              }
            }
          } catch (e) {
            console.error('Failed to process NIP-46 response', e)
          }
        },
        bunkerRelays
      ).then((handle) => {
        subscriptionRef.current = handle
      })

      // Publish specifically to the bunker relay to ensure delivery
      nostrService.publishToRelays(bunkerRelays, reqEvent)
    })
  }

  private signWithLocal(template: EventTemplate): Event {
    if (!this.localSecretKey) throw new Error('Local secret key not set')
    return finalizeEvent(template, this.localSecretKey)
  }

  setSecretKey(hex: string) {
    const normalized = this.normalizeHex(hex)
    this.localSecretKey = this.hexToBytes(normalized)
    localStorage.setItem('asknostr-client-secret', JSON.stringify(Array.from(this.localSecretKey)))
  }

  private normalizeHex(input: string) {
    return input.trim().replace(/^0x/, '').toLowerCase()
  }

  private hexToBytes(hex: string): Uint8Array {
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error('Secret key must be 64 hex characters')
    const result = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      result[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    return result
  }

  async connect(bunkerUri: string): Promise<string> {
    let pubkey = ''
    let relays: string[] = []
    let secret = ''

    if (bunkerUri.startsWith('bunker://') || bunkerUri.startsWith('nostrconnect://')) {
      const url = new URL(bunkerUri.trim())
      pubkey = normalizeHexPubkey(url.host)
      const rawRelays = url.searchParams.getAll('relay')
      const rRelays = url.searchParams.getAll('r')
      relays = [...rawRelays, ...rRelays].map(normalizeRelayUrl).filter(r => !!r) as string[]
      secret = url.searchParams.get('secret')?.trim() || ''
    }

    if (!pubkey) throw new Error('Invalid bunker public key')
    if (relays.length === 0) throw new Error('Invalid bunker relay URL')

    const requestId = Math.random().toString(36).substring(7)
    const request = {
      id: requestId,
      method: 'connect',
      params: [this.clientPubkey, secret]
    }

    const encrypted = await nip04.encrypt(this.localSecretKey!, pubkey, JSON.stringify(request))
    const reqEvent = finalizeEvent({
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', pubkey]],
      content: encrypted,
    }, this.localSecretKey!)

    return new Promise<string>((resolve, reject) => {
      const subscriptionRef: { current: NostrSubscriptionHandle | null } = { current: null }
      const cleanup = () => subscriptionRef.current?.close()

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Nostr Connect timeout'))
      }, 30000)

      nostrService.subscribe(
        [{ kinds: [24133], '#p': [this.clientPubkey], authors: [pubkey] }],
        async (event) => {
          try {
            const decrypted = await nip04.decrypt(this.localSecretKey!, pubkey, event.content)
            const response = JSON.parse(decrypted)
            if (response.id === requestId) {
              clearTimeout(timeout)
              cleanup()
              if (response.result === 'ack') {
                const userPubkey = await this.fetchRemotePublicKey(pubkey, relays)
                resolve(userPubkey)
              } else {
                reject(new Error('Connection rejected'))
              }
            }
          } catch (e) {
            console.error(e)
          }
        },
        relays
      ).then((handle) => {
        subscriptionRef.current = handle
      })

      nostrService.publishToRelays(relays, reqEvent)
    })
  }

  async fetchRemotePublicKey(bunkerPubkey: string, relays: string[]): Promise<string> {
    const requestId = Math.random().toString(36).substring(7)
    const request = {
      id: requestId,
      method: 'get_public_key',
      params: []
    }

    const encrypted = await nip04.encrypt(this.localSecretKey!, bunkerPubkey, JSON.stringify(request))
    const reqEvent = finalizeEvent({
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', bunkerPubkey]],
      content: encrypted,
    }, this.localSecretKey!)

    return new Promise<string>((resolve, reject) => {
      const subscriptionRef: { current: NostrSubscriptionHandle | null } = { current: null }
      const cleanup = () => subscriptionRef.current?.close()

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('get_public_key timeout'))
      }, 10000)

      nostrService.subscribe(
        [{ kinds: [24133], '#p': [this.clientPubkey], authors: [bunkerPubkey] }],
        async (event) => {
          try {
            const decrypted = await nip04.decrypt(this.localSecretKey!, bunkerPubkey, event.content)
            const response = JSON.parse(decrypted)
            if (response.id === requestId) {
              clearTimeout(timeout)
              cleanup()
              resolve(response.result)
            }
          } catch (e) {
            console.error(e)
          }
        },
        relays
      ).then((handle) => {
        subscriptionRef.current = handle
      })

      nostrService.publishToRelays(relays, reqEvent)
    })
  }

  async acknowledgeConnect(bunkerPubkey: string, relays: string[], requestId: string) {
    const response = {
      id: requestId,
      result: 'ack'
    }

    const encrypted = await nip04.encrypt(this.localSecretKey!, bunkerPubkey, JSON.stringify(response))
    const respEvent = finalizeEvent({
      kind: 24133,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', bunkerPubkey]],
      content: encrypted,
    }, this.localSecretKey!)

    await nostrService.publishToRelays(relays, respEvent)
  }

  async decryptFrom(bunkerPubkey: string, content: string): Promise<string> {
    return nip04.decrypt(this.localSecretKey!, bunkerPubkey, content)
  }
}

export const signerService = new SignerService()

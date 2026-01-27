import { nip19 } from 'nostr-tools'

export const formatPubkey = (pubkey: string): string => {
  try {
    return nip19.npubEncode(pubkey)
  } catch {
    return pubkey
  }
}

export const shortenPubkey = (npub: string): string => {
  return `${npub.slice(0, 8)}...${npub.slice(-8)}`
}

export const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleString()
}
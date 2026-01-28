import { nip19 } from 'nostr-tools'

const HEX_PATTERN = /^[0-9a-f]{64}$/i

export const normalizeHexPubkey = (input: string | null | undefined): string => {
  if (!input) return ''
  const candidate = input.trim()
  if (HEX_PATTERN.test(candidate)) {
    return candidate.toLowerCase()
  }

  try {
    const decoded = nip19.decode(candidate)
    if (decoded.type === 'npub' && typeof decoded.data === 'string') {
      return decoded.data
    }
    if (decoded.type === 'nprofile' && decoded.data && typeof decoded.data === 'object') {
      const profilePubkey = (decoded.data as { pubkey?: string }).pubkey
      if (profilePubkey && HEX_PATTERN.test(profilePubkey)) {
        return profilePubkey.toLowerCase()
      }
    }
  } catch (err) {
    console.warn('[nostr utils] Failed to normalize pubkey', err)
  }

  return ''
}

export const normalizeRelayUrl = (input: string | null | undefined): string => {
  if (!input) return ''
  const candidate = input.trim()
  if (candidate.startsWith('wss://') || candidate.startsWith('ws://') || candidate.startsWith('https://') || candidate.startsWith('http://')) {
    return candidate
  }
  return ''
}

export const shortenPubkey = (hex: string | null | undefined, prefix = 4, suffix = 4): string => {
  if (!hex) return ''
  const normalized = hex.trim()
  if (normalized.length <= prefix + suffix) return normalized
  return `${normalized.slice(0, prefix)}...${normalized.slice(-suffix)}`
}

export const formatPubkey = (hex: string | null | undefined): string => {
  if (!hex) return ''
  return `pk_${shortenPubkey(hex, 6, 6)}`
}

export const formatDate = (timestamp: number | string | undefined | null): string => {
  if (!timestamp) return ''
  const numeric = typeof timestamp === 'string' ? Number(timestamp) : timestamp
  if (Number.isNaN(numeric)) return ''
  const date = new Date(numeric * 1000)
  return date.toLocaleString()
}

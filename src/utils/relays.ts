import { utils } from 'nostr-tools'

export const isRelayUrl = (value: string) => {
  const normalized = value.trim().toLowerCase()
  return normalized.startsWith('wss://') || normalized.startsWith('ws://')
}

export const normalizeRelayUrl = (value: string): string | null => {
  if (!value) return null
  const trimmed = value.trim()
  if (!isRelayUrl(trimmed)) return null
  try {
    return utils.normalizeURL(trimmed)
  } catch {
    return null
  }
}

export const sanitizeRelayUrls = (relays: string[]) => {
  const seen = new Set<string>()
  const normalized = relays
    .map(r => normalizeRelayUrl(r))
    .filter((r): r is string => !!r)
    .filter((uri) => {
      if (seen.has(uri)) return false
      seen.add(uri)
      return true
    })
  return normalized
}

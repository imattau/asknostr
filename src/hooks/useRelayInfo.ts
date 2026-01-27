import { useQuery } from '@tanstack/react-query'
import { get, set } from 'idb-keyval'

export interface RelayInfo {
  name?: string
  description?: string
  pubkey?: string
  contact?: string
  supported_nips?: number[]
  software?: string
  version?: string
  limitation?: {
    max_message_length?: number
    max_subscriptions?: number
    max_filters?: number
    max_limit?: number
    max_subid_length?: number
    min_pow_difficulty?: number
    auth_required?: boolean
    payment_required?: boolean
  }
}

export const useRelayInfo = (url: string) => {
  return useQuery({
    queryKey: ['relay-info', url],
    queryFn: async () => {
      const cacheKey = `relay-info-${url}`
      const cached = await get(cacheKey)
      if (cached) return cached as RelayInfo

      try {
        const httpUrl = url.replace('wss://', 'https://').replace('ws://', 'http://')
        const response = await fetch(httpUrl, {
          headers: { 'Accept': 'application/nostr+json' }
        })
        const info = await response.json()
        await set(cacheKey, info)
        return info as RelayInfo
      } catch (e) {
        console.error(`Failed to fetch NIP-11 for ${url}`, e)
        return null
      }
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  })
}

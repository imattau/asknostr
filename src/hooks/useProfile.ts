import { useQuery, useQueryClient } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { get, set } from 'idb-keyval'

export const useProfile = (pubkey: string) => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: async () => {
      if (!pubkey) return null
      
      const cacheKey = `profile-${pubkey}`
      const cached = await get(cacheKey)
      
      // Start background fetch to update cache and state
      nostrService.subscribe(
        [{ kinds: [0], authors: [pubkey], limit: 1 }],
        (event: Event) => {
          try {
            const profile = JSON.parse(event.content)
            set(cacheKey, profile)
            queryClient.setQueryData(['profile', pubkey], profile)
          } catch (e) {
            console.error('[ProfileHook] Background update failed', e)
          }
        }
      ).then(sub => {
        setTimeout(() => sub.close(), 5000)
      })

      // Return cached immediately if we have it
      if (cached) return cached
      
      // Otherwise wait a bit for the first hit
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(null)
        }, 3000)
      })
    },
    staleTime: 1000 * 60 * 30, // 30 mins
    enabled: !!pubkey,
  })
}

import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { get, set } from 'idb-keyval'

export const useProfile = (pubkey: string) => {
  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: async () => {
      // Check cache first
      const cached = await get(`profile-${pubkey}`)
      if (cached) return cached

      return new Promise((resolve) => {
        let found = false
        nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            try {
              const profile = JSON.parse(event.content)
              found = true
              set(`profile-${pubkey}`, profile) // Save to cache
              resolve(profile)
            } catch (e) {
              console.error('Failed to parse profile', e)
              resolve(null)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            if (!found) {
              sub.close()
              resolve(null)
            }
          }, 2000)
        })
      })
    },
    staleTime: 1000 * 60 * 60, // 1 hour (longer because we have local cache)
    enabled: !!pubkey,
  })
}

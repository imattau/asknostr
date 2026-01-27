import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export const useProfile = (pubkey: string) => {
  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: async () => {
      return new Promise((resolve) => {
        let found = false
        nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            try {
              const profile = JSON.parse(event.content)
              found = true
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
    staleTime: 1000 * 60 * 30,
    enabled: !!pubkey,
  })
}

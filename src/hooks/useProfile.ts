import { useQuery, useQueryClient } from '@tanstack/react-query'
import { nostrService, DISCOVERY_RELAYS } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { get, set } from 'idb-keyval'
import type { UserProfile } from '../store/useStore'

const normalizeProfile = (raw: Record<string, string | undefined>): UserProfile => {
  return {
    name: raw.name || '',
    display_name: raw.display_name || raw.displayName || '',
    about: raw.about || '',
    picture: raw.picture || raw.image || '',
    banner: raw.banner || '',
    website: raw.website || '',
    lud16: raw.lud16 || raw.lud06 || '',
    nip05: raw.nip05 || '',
  }
}

export const useProfile = (pubkey: string) => {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: async () => {
      if (!pubkey) return null
      
      const cacheKey = `profile-${pubkey}`
      const cached = await get(cacheKey)
      
      if (cached) {
        console.log('[ProfileHook] Returning cached:', pubkey)
        
        // Background sync
        nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            try {
              const profile = normalizeProfile(JSON.parse(event.content))
              set(cacheKey, profile)
              queryClient.setQueryData(['profile', pubkey], profile)
            } catch (e) {
              console.error('[ProfileHook] Sync parse error', e)
            }
          },
          DISCOVERY_RELAYS // Use discovery relays for background sync
        ).then(sub => {
          setTimeout(() => sub.close(), 5000)
        })

        return cached as UserProfile
      }

      console.log('[ProfileHook] Waiting for network:', pubkey)
      return new Promise<UserProfile | null>((resolve) => {
        let found = false
        const timeout = setTimeout(() => {
          if (!found) resolve(null)
        }, 8000)

        nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            try {
              const profile = normalizeProfile(JSON.parse(event.content))
              found = true
              clearTimeout(timeout)
              set(cacheKey, profile)
              resolve(profile)
            } catch (e) {
              console.error('[ProfileHook] Network parse error', e)
            }
          },
          DISCOVERY_RELAYS
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            if (!found) resolve(null)
          }, 9000)
        })
      })
    },
    staleTime: 1000 * 60 * 30, 
    enabled: !!pubkey,
  })
}

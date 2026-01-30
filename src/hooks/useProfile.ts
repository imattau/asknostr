import { useQuery } from '@tanstack/react-query'
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
  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: async () => {
      if (!pubkey) return null
      
      const cacheKey = `profile-${pubkey}`
      const cached = await get(cacheKey) as UserProfile | undefined
      
      return new Promise<UserProfile | null>((resolve) => {
        let found = false
        
        // Timeout: If network is slow, resolve with cache if available, else null
        const timeout = setTimeout(() => {
          if (!found) {
            sub.close()
            resolve(cached || null)
          }
        }, 4000)

        const sub = nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            try {
              const profile = normalizeProfile(JSON.parse(event.content))
              found = true
              clearTimeout(timeout)
              sub.close()
              set(cacheKey, profile)
              resolve(profile)
            } catch (e) {
              // Parse error, keep waiting or timeout
            }
          },
          DISCOVERY_RELAYS
        );
      })
    },
    // Keep profiles fresh for 30 mins, purge if unused for 1 hour
    staleTime: 1000 * 60 * 30, 
    gcTime: 1000 * 60 * 60,
    enabled: !!pubkey,
  })
}

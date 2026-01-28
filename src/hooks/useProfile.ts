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
      
      console.log(`[ProfileHook] Fetching for ${pubkey.slice(0, 8)}... Cached: ${!!cached}`)

      return new Promise<UserProfile | null>((resolve) => {
        let found = false
        
        let sub: { close: () => void } | undefined

        // Timeout: If network is slow, resolve with cache if available, else null
        const timeout = setTimeout(() => {
          if (!found) {
            console.log('[ProfileHook] Network timeout. Using cache:', !!cached)
            if (sub) sub.close()
            resolve(cached || null)
          }
        }, 4000)

        nostrService.subscribe(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          (event: Event) => {
            // Find the latest event if multiple come in (though limit:1 usually gives one)
            // Ideally we check created_at, but for now take the first valid one
            try {
              const profile = normalizeProfile(JSON.parse(event.content))
              console.log('[ProfileHook] Network data received')
              found = true
              clearTimeout(timeout)
              if (sub) sub.close()
              set(cacheKey, profile)
              resolve(profile)
            } catch (e) {
              console.error('[ProfileHook] Parse error', e)
            }
          },
          DISCOVERY_RELAYS
        ).then(s => sub = s)
      })
    },
    // Reduce staleTime so it actually tries to fetch more often
    staleTime: 1000 * 60 * 5, 
    enabled: !!pubkey,
  })
}

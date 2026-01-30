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

export const fetchProfile = async (pubkey: string): Promise<UserProfile | null> => {
  if (!pubkey) return null
  
  const cacheKey = `profile-${pubkey}`
  const cached = await get(cacheKey) as UserProfile | undefined
  
  return new Promise<UserProfile | null>((resolve) => {
    let found = false
    
    // Timeout: If network is slow, resolve with cache if available, else null
    const timeout = setTimeout(() => {
      if (!found) {
        resolve(cached || null)
      }
    }, 4000)

    const cleanup = nostrService.requestMetadata('profile', pubkey, (event: Event) => {
      try {
        const profile = normalizeProfile(JSON.parse(event.content))
        found = true
        clearTimeout(timeout)
        cleanup()
        set(cacheKey, profile)
        resolve(profile)
      } catch (e) {
        // Parse error
      }
    })
  })
}

export const useProfile = (pubkey: string) => {
  return useQuery({
    queryKey: ['profile', pubkey],
    queryFn: () => fetchProfile(pubkey),
    // Keep profiles fresh for 30 mins, purge if unused for 1 hour
    staleTime: 1000 * 60 * 30, 
    gcTime: 1000 * 60 * 60,
    enabled: !!pubkey,
  })
}

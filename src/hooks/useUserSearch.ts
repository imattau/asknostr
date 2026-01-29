import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { UserProfile } from '../store/useStore'

export interface UserSearchResult {
  pubkey: string
  profile?: UserProfile
}

export const useUserSearch = (query: string) => {
  return useQuery({
    queryKey: ['user-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      
      return new Promise<UserSearchResult[]>((resolve) => {
        const results: UserSearchResult[] = []
        const seen = new Set<string>()
        
        const sub = nostrService.subscribe(
          [{ kinds: [0], search: query, limit: 10 }],
          (event: Event) => {
            if (seen.has(event.pubkey)) return
            seen.add(event.pubkey)
            try {
              const profile = JSON.parse(event.content)
              results.push({ pubkey: event.pubkey, profile })
            } catch (e) {
              results.push({ pubkey: event.pubkey })
            }
          },
          nostrService.getSearchRelays()
        )

        setTimeout(() => {
          sub.then(s => s.close())
          resolve(results)
        }, 2000)
      })
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 60 * 5, // 5 mins
  })
}

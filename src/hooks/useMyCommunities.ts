import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useMyCommunities = () => {
  const { user, events } = useStore()

  return useQuery({
    queryKey: ['my-communities', user.pubkey, events.length],
    queryFn: async () => {
      if (!user.pubkey) return []
      console.log('[MyCommunities] Scanning for owned stations for:', user.pubkey)
      
      // 1. Check local store first for instant results
      const localOwned: CommunityDefinition[] = events
        .filter(e => e.kind === 34550 && e.pubkey === user.pubkey)
        .map(e => parseCommunityEvent(e))
        .filter((c): c is CommunityDefinition => !!c)

      return new Promise<CommunityDefinition[]>((resolve) => {
        const owned = [...localOwned]
        
        nostrService.subscribe(
          [
            { kinds: [34550], authors: [user.pubkey as string] },
            { kinds: [34550], '#p': [user.pubkey as string] }
          ],
          (event: Event) => {
            const definition = parseCommunityEvent(event)
            if (definition && !owned.find(s => s.id === definition.id)) {
              owned.push(definition)
            }
          },
          nostrService.getDiscoveryRelays()
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(owned)
          }, 3000)
        })
      })
    },
    enabled: !!user.pubkey,
    staleTime: 1000 * 30, // 30 seconds
  })
}

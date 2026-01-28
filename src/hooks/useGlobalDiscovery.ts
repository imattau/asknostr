import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useGlobalDiscovery = () => {
  const { events } = useStore()

  return useQuery({
    queryKey: ['global-community-discovery', events.length],
    queryFn: async () => {
      console.log('[Discovery] Initiating network scan for Kind 34550...')
      
      // 1. Check local store first
      const localDiscovered: CommunityDefinition[] = events
        .filter(e => e.kind === 34550)
        .map(e => parseCommunityEvent(e))
        .filter((c): c is CommunityDefinition => !!c)

      return new Promise<CommunityDefinition[]>((resolve) => {
        const discovered = [...localDiscovered]
        
        nostrService.subscribe(
          [{ kinds: [34550], limit: 100 }],
          (event: Event) => {
            const definition = parseCommunityEvent(event)
            if (definition && !discovered.find(s => s.id === definition.id && s.creator === definition.creator)) {
              discovered.push(definition)
            }
          },
          nostrService.getDiscoveryRelays()
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(discovered)
          }, 6000)
        })
      })
    },
    staleTime: 1000 * 60 * 5,
  })
}

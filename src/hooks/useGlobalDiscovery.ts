import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'

export const useGlobalDiscovery = () => {
  return useQuery({
    queryKey: ['global-community-discovery'],
    queryFn: async () => {
      return new Promise<CommunityDefinition[]>((resolve) => {
        const discovered: CommunityDefinition[] = []
        
        nostrService.subscribe(
          [{ kinds: [34550], limit: 50 }],
          (event: Event) => {
            const dTag = event.tags.find(t => t[0] === 'd')?.[1]
            if (!dTag) return

            const moderators = event.tags.filter(t => t[0] === 'p').map(t => t[1])
            const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1])
            const name = event.tags.find(t => t[0] === 'name')?.[1]
            const description = event.tags.find(t => t[0] === 'description')?.[1]
            const image = event.tags.find(t => t[0] === 'image')?.[1]

            const definition: CommunityDefinition = {
              id: dTag,
              name,
              description,
              image,
              moderators,
              relays,
              pinned: event.tags.filter(t => t[0] === 'e').map(t => t[1]),
              creator: event.pubkey
            }

            if (!discovered.find(s => s.id === definition.id && s.creator === definition.creator)) {
              discovered.push(definition)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(discovered)
          }, 3000)
        })
      })
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

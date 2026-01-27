import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'

export const useMyCommunities = () => {
  const { user } = useStore()

  return useQuery({
    queryKey: ['my-communities', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) return []
      
      return new Promise<CommunityDefinition[]>((resolve) => {
        const owned: CommunityDefinition[] = []
        
        nostrService.subscribe(
          [{ kinds: [34550], authors: [user.pubkey as string] }],
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

            if (!owned.find(s => s.id === definition.id)) {
              owned.push(definition)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(owned)
          }, 2000)
        })
      })
    },
    enabled: !!user.pubkey,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

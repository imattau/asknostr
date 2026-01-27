import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export interface CommunityDefinition {
  id: string // d tag
  name?: string
  description?: string
  rules?: string
  image?: string
  moderators: string[] // p tags
  relays: string[] // relay tags
  creator: string // pubkey
}

export const useCommunity = (communityId: string, creatorPubkey: string) => {
  return useQuery({
    queryKey: ['community', communityId, creatorPubkey],
    queryFn: async () => {
      return new Promise<CommunityDefinition | null>((resolve) => {
        let found = false
        nostrService.subscribe(
          [{ 
            kinds: [34550], 
            authors: [creatorPubkey], 
            '#d': [communityId],
            limit: 1 
          }],
          (event: Event) => {
            const dTag = event.tags.find(t => t[0] === 'd')?.[1]
            if (dTag === communityId) {
              const moderators = event.tags.filter(t => t[0] === 'p').map(t => t[1])
              const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1])
              const name = event.tags.find(t => t[0] === 'name')?.[1]
              const description = event.tags.find(t => t[0] === 'description')?.[1]
              const rules = event.tags.find(t => t[0] === 'rules')?.[1]
              const image = event.tags.find(t => t[0] === 'image')?.[1]

              const definition: CommunityDefinition = {
                id: dTag,
                name,
                description,
                rules,
                image,
                moderators,
                relays,
                creator: event.pubkey
              }
              found = true
              resolve(definition)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            if (!found) {
              sub.close()
              resolve(null)
            }
          }, 3000)
        })
      })
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
    enabled: !!communityId && !!creatorPubkey,
  })
}

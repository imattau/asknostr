import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'

export const useFollowerSuggestions = () => {
  const { user } = useStore()

  // 1. Fetch user's follows (Kind 3)
  const { data: follows = [] } = useQuery({
    queryKey: ['follows', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) return []
      return new Promise<string[]>((resolve) => {
        let latest: Event | null = null
        nostrService.subscribe(
          [{ kinds: [3], authors: [user.pubkey], limit: 1 }],
          (event: Event) => {
            if (!latest || event.created_at > latest.created_at) {
              latest = event
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            const pTags = latest?.tags.filter(t => t[0] === 'p').map(t => t[1]) || []
            resolve(pTags)
          }, 2000)
        })
      })
    },
    enabled: !!user.pubkey,
  })

  // 2. Fetch Kind 34550 from follows
  return useQuery({
    queryKey: ['follower-community-suggestions', follows],
    queryFn: async () => {
      if (follows.length === 0) return []
      return new Promise<CommunityDefinition[]>((resolve) => {
        const suggestions: CommunityDefinition[] = []
        // Only query first 50 follows to keep it performant
        const targetPubkeys = follows.slice(0, 50)
        
        nostrService.subscribe(
          [{ kinds: [34550], authors: targetPubkeys, limit: 20 }],
          (event: Event) => {
            const dTag = event.tags.find(t => t[0] === 'd')?.[1]
            if (!dTag) return

            const moderators = event.tags.filter(t => t[0] === 'p').map(t => t[1])
            const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1])
            const name = event.tags.find(t => t[0] === 'name')?.[1]
            const description = event.tags.find(t => t[0] === 'description')?.[1]

            const definition: CommunityDefinition = {
              id: dTag,
              name,
              description,
              moderators,
              relays,
              pinned: event.tags.filter(t => t[0] === 'e').map(t => t[1]),
              creator: event.pubkey
            }

            if (!suggestions.find(s => s.id === definition.id && s.creator === definition.creator)) {
              suggestions.push(definition)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(suggestions)
          }, 3000)
        })
      })
    },
    enabled: follows.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}

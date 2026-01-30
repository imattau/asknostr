import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useFollowerSuggestions = () => {
  const { user } = useStore()

  // 1. Fetch user's follows (Kind 3)
  const { data: follows = [] } = useQuery({
    queryKey: ['follows', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) return []
      return new Promise<string[]>((resolve) => {
        let latest: Event | null = null
        const sub = nostrService.subscribe(
          [{ kinds: [3], authors: [user.pubkey as string], limit: 1 }],
          (event: Event) => {
            if (!latest || event.created_at > latest.created_at) {
              latest = event
            }
          }
        )
        setTimeout(() => {
          sub.close()
          const pTags = latest?.tags?.filter(t => t[0] === 'p').map(t => t[1]) || []
          resolve(pTags)
        }, 4000)
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
        
        const sub = nostrService.subscribe(
          [{ kinds: [34550], authors: targetPubkeys, limit: 20 }],
          (event: Event) => {
            const definition = parseCommunityEvent(event)
            if (definition && !suggestions.find(s => s.id === definition.id && s.creator === definition.creator)) {
              suggestions.push(definition)
            }
          }
        )
        setTimeout(() => {
          sub.close()
          resolve(suggestions)
        }, 5000)
      })
    },
    enabled: follows.length > 0,
    staleTime: 1000 * 60 * 30, // 30 minutes
  })
}
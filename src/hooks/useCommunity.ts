import { useQuery } from '@tanstack/react-query'
import { nostrService, SubscriptionPriority } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { get, set } from 'idb-keyval'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export interface CommunityDefinition {
  id: string // d tag
  name?: string
  description?: string
  rules?: string
  image?: string
  banner?: string
  moderators: string[] // p tags
  relays: string[] // relay tags
  creator: string // pubkey
  pinned: string[] // e tags
  moderationMode?: 'open' | 'restricted'
}

export const useCommunity = (communityId: string, creatorPubkey: string) => {

  return useQuery<CommunityDefinition | null>({
    queryKey: ['community', communityId, creatorPubkey],
    queryFn: async () => {
      // 1. Check IndexedDB
      const cacheKey = `community-${creatorPubkey}-${communityId}`
      const cached = await get(cacheKey)
      if (cached) {
        return cached as CommunityDefinition
      }

      // 3. Network Fetch
      return new Promise<CommunityDefinition | null>((resolve) => {
        let found = false
        let resolved = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = (value: CommunityDefinition | null) => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          resolve(value)
        }

        const sub = nostrService.subscribe(
          [
            // Specific filter
            { kinds: [34550], authors: [creatorPubkey], '#d': [communityId] },
            // Fallback: get all communities from this author to be sure
            { kinds: [34550], authors: [creatorPubkey] }
          ],
          (event: Event) => {
            const definition = parseCommunityEvent(event)
            if (definition && definition.id === communityId && definition.creator === creatorPubkey) {
              found = true
              set(cacheKey, definition)
              sub.close()
              finish(definition)
            }
          },
          nostrService.getDiscoveryRelays(),
          { 
            priority: SubscriptionPriority.HIGH,
            onEose: () => { 
              if (!found) {
                sub.close()
                finish(null) 
              }
            } 
          }
        );

        timeoutId = setTimeout(() => {
          if (!found) {
            sub.close()
            finish(null)
          }
        }, 12000)
      })
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!communityId && !!creatorPubkey,
  })
}
import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import { useStore } from '../store/useStore'
import type { Event } from 'nostr-tools'
import { get, set } from 'idb-keyval'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export interface CommunityDefinition {
  id: string // d tag
  name?: string
  description?: string
  rules?: string
  image?: string
  moderators: string[] // p tags
  relays: string[] // relay tags
  creator: string // pubkey
  pinned: string[] // e tags
  moderationMode?: 'open' | 'restricted'
}

export const useCommunity = (communityId: string, creatorPubkey: string) => {
  const { events } = useStore()

  return useQuery({
    queryKey: ['community', communityId, creatorPubkey, events.length],
    queryFn: async () => {
      console.log(`[useCommunity] Loading metadata for ${communityId} by ${creatorPubkey}`)
      
      const communityATag = `34550:${creatorPubkey}:${communityId}`

      // 1. Check local store first (Strongest source of truth for current session)
      const localEvent = events.find(e => 
        e.kind === 34550 && 
        e.pubkey === creatorPubkey && 
        (e.tags.some(t => t[0] === 'd' && t[1] === communityId) || e.tags.some(t => t[0] === 'a' && t[1] === communityATag))
      )
      
      if (localEvent) {
        console.log('[useCommunity] Found in local store buffer')
        const definition = parseCommunityEvent(localEvent)
        if (definition) return definition
      }

      // 2. Check IndexedDB
      const cacheKey = `community-${creatorPubkey}-${communityId}`
      const cached = await get(cacheKey)
      if (cached) {
        console.log('[useCommunity] Found in IndexedDB cache')
        return cached as CommunityDefinition
      }

      // 3. Network Fetch
      console.log('[useCommunity] Fetching from network...')
      return new Promise<CommunityDefinition | null>((resolve) => {
        let found = false
        let resolved = false
        let subRef: { close: () => void } | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = (value: CommunityDefinition | null) => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          subRef?.close()
          resolve(value)
        }

        nostrService.subscribe(
          [
            // Specific filter
            { kinds: [34550], authors: [creatorPubkey], '#d': [communityId] },
            // Fallback: get all communities from this author to be sure
            { kinds: [34550], authors: [creatorPubkey] }
          ],
          (event: Event) => {
            const definition = parseCommunityEvent(event)
            if (definition && definition.id === communityId && definition.creator === creatorPubkey) {
              console.log('[useCommunity] Network event received & validated')
              found = true
              set(cacheKey, definition)
              finish(definition)
            }
          },
          undefined,
          { onEose: () => { if (!found) finish(null) } }
        ).then(sub => {
          subRef = sub
          if (resolved) {
            sub.close()
            return
          }
          timeoutId = setTimeout(() => {
            if (!found) {
              console.warn('[useCommunity] Network timeout')
              finish(null)
            }
          }, 8000)
        })
      })
    },
    staleTime: 1000 * 60 * 10,
    enabled: !!communityId && !!creatorPubkey,
  })
}

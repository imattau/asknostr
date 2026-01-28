import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useMyCommunities = () => {
  const { user, events } = useStore()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user.pubkey) return
    const localOwned: CommunityDefinition[] = events
      .filter(e => e.kind === 34550 && e.pubkey === user.pubkey)
      .map(e => parseCommunityEvent(e))
      .filter((c): c is CommunityDefinition => !!c)

    const uniqueLocal = Array.from(
      new Map(localOwned.map(item => [item.id, item])).values()
    )

    queryClient.setQueryData(['my-communities', user.pubkey], uniqueLocal)
  }, [events, queryClient, user.pubkey])

  return useQuery<CommunityDefinition[]>({
    queryKey: ['my-communities', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) return []
      console.log('[MyCommunities] Scanning for owned stations for:', user.pubkey)
      
      // 1. Check local store first for instant results
      const localOwned: CommunityDefinition[] = events
        .filter(e => e.kind === 34550 && e.pubkey === user.pubkey)
        .map(e => parseCommunityEvent(e))
        .filter((c): c is CommunityDefinition => !!c)

      // Deduplicate local results (keep latest version if multiple events exist for same ID)
      const uniqueLocal = Array.from(
        new Map(localOwned.map(item => [item.id, item])).values()
      )

      return new Promise<CommunityDefinition[]>((resolve) => {
        const owned = [...uniqueLocal]
        const seen = new Set<string>()
        let resolved = false
        let subRef: { close: () => void } | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = () => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          subRef?.close()
          const uniqueFinal = Array.from(
            new Map(owned.map(item => [item.id, item])).values()
          )
          resolve(uniqueFinal)
        }
        
        nostrService.subscribe(
          [
            { kinds: [34550], authors: [user.pubkey as string] },
            { kinds: [34550], '#p': [user.pubkey as string] }
          ],
          (event: Event) => {
            if (seen.has(event.id)) return
            seen.add(event.id)
            const definition = parseCommunityEvent(event)
            if (definition) {
              // Check if we already have this station (either from local or previous network event)
              const existingIndex = owned.findIndex(s => s.id === definition.id)
              
              if (existingIndex === -1) {
                // New station found
                owned.push(definition)
              } else {
                // Update if potentially newer (though we can't easily check created_at here without expanding the type, 
                // typically network results might be fresher or same)
                // For now, we just ensure we don't duplicate.
              }
            }
          },
          nostrService.getDiscoveryRelays(),
          { onEose: finish }
        ).then(sub => {
          subRef = sub
          if (resolved) {
            sub.close()
            return
          }
          timeoutId = setTimeout(finish, 3000)
        })
      })
    },
    enabled: !!user.pubkey,
    staleTime: 1000 * 30, // 30 seconds
  })
}

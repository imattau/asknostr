import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useGlobalDiscovery = () => {
  return useQuery({
    queryKey: ['global-community-discovery'],
    queryFn: async () => {
      const discovered: CommunityDefinition[] = []

      const runSubscription = async (relays: string[]) => {
        let count = 0
        return new Promise<void>((resolve) => {
          nostrService.subscribe(
            [{ kinds: [34550], limit: 50 }],
            (event: Event) => {
              const definition = parseCommunityEvent(event)
              if (definition) {
                const exists = discovered.some(s => s.id === definition.id && s.creator === definition.creator)
                if (!exists) {
                  discovered.push(definition)
                  count++
                }
              }
            },
            relays
          ).then(sub => {
            setTimeout(() => {
              sub.close()
              resolve()
            }, 6000)
          })
        })
      }

      const discoveryRelays = nostrService.getDiscoveryRelays()
      await runSubscription(discoveryRelays)
      let usedFallback = false

      if (discovered.length === 0) {
        const fallbackRelays = nostrService.getRelays()
        if (fallbackRelays.some(url => !discoveryRelays.includes(url))) {
          usedFallback = true
          await runSubscription(fallbackRelays)
        }
      }

      const uniqueFinal = Array.from(
        new Map(discovered.map(item => [`${item.creator}:${item.id}`, item])).values()
      )
      return { communities: uniqueFinal, usedFallback }
    },
    staleTime: Infinity, // Cache indefinitely
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}

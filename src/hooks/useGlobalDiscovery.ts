import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'
import { useSocialGraph } from './useSocialGraph'

export const useGlobalDiscovery = () => {
  const { muted } = useSocialGraph()

  return useQuery({
    queryKey: ['global-community-discovery', muted],
    queryFn: async () => {
      const discovered: CommunityDefinition[] = []

      const runSubscription = async (relays: string[]) => {
        let count = 0
        return new Promise<void>((resolve) => {
          const sub = nostrService.subscribe(
            [{ kinds: [34550], limit: 50 }],
            (event: Event) => {
              if (muted.includes(event.pubkey)) return

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
          )
          setTimeout(() => {
            sub.close()
            resolve()
          }, 6000)
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
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
}

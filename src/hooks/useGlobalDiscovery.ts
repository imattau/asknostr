import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useGlobalDiscovery = () => {
  const { events } = useStore()

  return useQuery({
    queryKey: ['global-community-discovery'],
    queryFn: async () => {
      console.log('[Discovery] Initiating network scan for Kind 34550...')
      const localDiscovered: CommunityDefinition[] = events
        .filter(e => e.kind === 34550)
        .map(e => parseCommunityEvent(e))
        .filter((c): c is CommunityDefinition => !!c)

      const uniqueLocal = Array.from(
        new Map(localDiscovered.map(item => [`${item.creator}:${item.id}`, item])).values()
      )

      const discovered = [...uniqueLocal]

      const runSubscription = async (relays: string[]) => {
        return new Promise<void>((resolve) => {
          nostrService.subscribe(
            [{ kinds: [34550], limit: 100 }],
            (event: Event) => {
              const definition = parseCommunityEvent(event)
              if (definition) {
                const exists = discovered.some(s => s.id === definition.id && s.creator === definition.creator)
                if (!exists) {
                  discovered.push(definition)
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

      if (discovered.length === uniqueLocal.length) {
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
  })
}

import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useGlobalDiscovery = () => {
  return useQuery({
    queryKey: ['global-community-discovery'],
    queryFn: async () => {
      console.log('[Discovery] Initiating network scan for Kind 34550...')
      const discovered: CommunityDefinition[] = []

      const runSubscription = async (relays: string[]) => {
        console.log(`[Discovery] Scanning ${relays.length} relays for communities...`)
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
              console.log(`[Discovery] Scan complete. Found ${count} new items on this set.`)
              resolve()
            }, 6000)
          })
        })
      }

      const discoveryRelays = nostrService.getDiscoveryRelays()
      await runSubscription(discoveryRelays)
      let usedFallback = false

      if (discovered.length === 0) { // Was uniqueLocal.length check
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

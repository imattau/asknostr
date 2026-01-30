import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from './useCommunity'
import { parseCommunityEvent } from '../utils/nostr-parsers'

export const useMyCommunities = () => {
  const { user, relays: storeRelays, administeredStations, setAdministeredStations } = useStore()
  const queryClient = useQueryClient()

  return useQuery<CommunityDefinition[]>({
    queryKey: ['my-communities', user.pubkey, storeRelays],
    queryFn: async () => {
      if (!user.pubkey) return []
      console.log('[MyCommunities] Scanning for owned stations for:', user.pubkey)
      
      return new Promise<CommunityDefinition[]>((resolve) => {
        const owned = [...administeredStations]
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
            new Map(owned.map(item => [`${item.creator}:${item.id}`, item])).values()
          )
          
          // Seed the individual query cache for each discovered community
          uniqueFinal.forEach(comm => {
            queryClient.setQueryData(['community', comm.id, comm.creator], comm)
          })

          if (uniqueFinal.length > administeredStations.length) {
            setAdministeredStations(uniqueFinal)
          }
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
              const existingIndex = owned.findIndex(s => s.id === definition.id && s.creator === definition.creator)
              if (existingIndex === -1) {
                owned.push(definition)
              } else {
                owned[existingIndex] = definition
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
          timeoutId = setTimeout(finish, 6000)
        })
      })
    },
    enabled: !!user.pubkey,
    staleTime: 1000 * 30, // 30 seconds
  })
}

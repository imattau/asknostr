import { useQuery } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService, DEFAULT_RELAYS } from '../services/nostr'
import { get, set } from 'idb-keyval'

export const useRelays = () => {
  const { user, setRelays: setStoreRelays } = useStore()

  return useQuery({
    queryKey: ['user-relays', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) {
        return DEFAULT_RELAYS
      }
      
      const cacheKey = `relays-${user.pubkey}`
      const cached = await get(cacheKey)

      try {
        const relays = await nostrService.fetchRelayList(user.pubkey)
        
        if (relays && relays.length > 0) {
          await set(cacheKey, relays)
          nostrService.setRelays(relays)
          setStoreRelays(relays)
          return relays
        }
      } catch (e) {
        console.error('[RelaysHook] Network fetch failed:', e)
      }

      const result = cached || DEFAULT_RELAYS
      nostrService.setRelays(result)
      setStoreRelays(result)
      return result
    },

    enabled: !!user.pubkey,
    staleTime: 1000 * 60 * 15, // 15 mins
  })
}

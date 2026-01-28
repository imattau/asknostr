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
        console.log('[RelaysHook] No pubkey, using defaults')
        return DEFAULT_RELAYS
      }
      
      const cacheKey = `relays-${user.pubkey}`
      const cached = await get(cacheKey)
      console.log('[RelaysHook] Initial cached list:', cached?.length || 0, 'relays')

      try {
        const relays = await nostrService.fetchRelayList(user.pubkey)
        
        if (relays && relays.length > 0) {
          console.log('[RelaysHook] Fetched fresh relays:', relays.length)
          await set(cacheKey, relays)
          nostrService.setRelays(relays)
          setStoreRelays(relays)
          return relays
        } else {
          console.log('[RelaysHook] No relays found on network for this pubkey')
        }
      } catch (e) {
        console.error('[RelaysHook] Network fetch failed:', e)
      }

      const result = cached || DEFAULT_RELAYS
      console.log('[RelaysHook] Final relay list size:', result.length)
      nostrService.setRelays(result)
      setStoreRelays(result)
      return result
    },

    enabled: !!user.pubkey,
    staleTime: 1000 * 60 * 15, // 15 mins
  })
}
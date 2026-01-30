import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import type { Event } from 'nostr-tools'
import { triggerHaptic } from '../utils/haptics'
import { get, set } from 'idb-keyval'

export const useSubscriptions = () => {
  const { user, relays: storeRelays } = useStore()
  const queryClient = useQueryClient()

  const { data: subscriptionEvent, isLoading } = useQuery({
    queryKey: ['subscriptions', user.pubkey, storeRelays],
    queryFn: async () => {
      if (!user.pubkey) return null
      
      const cacheKey = `subs-${user.pubkey}`
      const cached = await get(cacheKey)

      return new Promise<Event | null>((resolve) => {
        let latest: Event | null = null
        let found = false
        let resolved = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = (value: Event | null) => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          sub.close()
          resolve(value)
        }

        const sub = nostrService.subscribe(
          [{ kinds: [30001], authors: [user.pubkey as string], '#d': ['communities'], limit: 1 }],
          (event: Event) => {
            if (!latest || event.created_at > latest.created_at) {
              latest = event
              found = true
              set(cacheKey, event)
            }
          },
          nostrService.getDiscoveryRelays(),
          { onEose: () => finish(found ? latest : cached || null) }
        );

        timeoutId = setTimeout(() => {
          finish(found ? latest : cached || null)
        }, 6000)
      })
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!user.pubkey,
  })

  const subscribedCommunities = subscriptionEvent?.tags
    ?.filter(t => t[0] === 'a')
    .map(t => t[1]) || []

  const updateSubscriptions = useMutation({
    mutationFn: async (newATags: string[]) => {
      if (!user.pubkey) throw new Error('Not logged in')

      const eventTemplate = {
        kind: 30001,
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'communities'],
          ...newATags.map(a => ['a', a])
        ],
        content: '',
      }

      const signedEvent = await signerService.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      await set(`subs-${user.pubkey}`, signedEvent)
      return signedEvent
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['subscriptions', user.pubkey], newEvent)
      queryClient.invalidateQueries({ queryKey: ['subscriptions', user.pubkey] })
      triggerHaptic(30)
    },
    onError: (error) => {
      console.error('Subscription update failed:', error)
      alert(`Subscription failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  })

  const toggleSubscription = (communityATag: string) => {
    console.log('[Subs] Toggling:', communityATag)
    const current = subscribedCommunities
    const next = current.includes(communityATag)
      ? current.filter(a => a !== communityATag)
      : [...current, communityATag]
    
    console.log('[Subs] Next state:', next)
    updateSubscriptions.mutate(next)
  }

  return {
    subscribedCommunities,
    toggleSubscription,
    isLoading,
    isUpdating: updateSubscriptions.isPending
  }
}

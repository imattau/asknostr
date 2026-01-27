import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { triggerHaptic } from '../utils/haptics'

export const useSubscriptions = () => {
  const { user } = useStore()
  const queryClient = useQueryClient()

  const { data: subscriptionEvent, isLoading } = useQuery({
    queryKey: ['subscriptions', user.pubkey],
    queryFn: async () => {
      if (!user.pubkey) return null
      return new Promise<Event | null>((resolve) => {
        let latest: Event | null = null
        nostrService.subscribe(
          [{ kinds: [30001], authors: [user.pubkey as string], '#d': ['communities'], limit: 1 }],
          (event: Event) => {
            if (!latest || event.created_at > latest.created_at) {
              latest = event
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(latest)
          }, 2000)
        })
      })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    enabled: !!user.pubkey,
  })

  const subscribedCommunities = subscriptionEvent?.tags
    .filter(t => t[0] === 'a')
    .map(t => t[1]) || []

  const updateSubscriptions = useMutation({
    mutationFn: async (newATags: string[]) => {
      if (!user.pubkey || !window.nostr) throw new Error('Not logged in')

      const eventTemplate = {
        kind: 30001,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', 'communities'],
          ...newATags.map(a => ['a', a])
        ],
        content: '',
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      return signedEvent
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['subscriptions', user.pubkey], newEvent)
      triggerHaptic(30)
    },
  })

  const toggleSubscription = (communityATag: string) => {
    const current = subscribedCommunities
    const next = current.includes(communityATag)
      ? current.filter(a => a !== communityATag)
      : [...current, communityATag]
    updateSubscriptions.mutate(next)
  }

  return {
    subscribedCommunities,
    toggleSubscription,
    isLoading,
    isUpdating: updateSubscriptions.isPending
  }
}

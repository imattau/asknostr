import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStore } from '../store/useStore'
import { nostrService, SubscriptionPriority } from '../services/nostr'
import { signerService } from '../services/signer'
// ... (several lines down)
        const sub = nostrService.subscribe(
          [{ kinds: [3], authors: [user.pubkey as string], limit: 1 }],
          (event: Event) => {
// ... (several lines down)
          },
          undefined,
          { 
            priority: SubscriptionPriority.HIGH,
            onEose: () => finish(found ? latest : cached || null) 
          }
        );
// ... (several lines down)
        const sub = nostrService.subscribe(
          [{ kinds: [10000], authors: [user.pubkey as string], limit: 1 }],
          (event: Event) => {
// ... (several lines down)
          },
          undefined,
          { 
            priority: SubscriptionPriority.HIGH,
            onEose: () => finish(found ? latest : cached || null) 
          }
        );

        setTimeout(() => finish(found ? latest : cached || null), 4000)
      })
    },
    staleTime: 1000 * 60 * 30,
    enabled: !!user.pubkey,
  })

  const following = contactEvent?.tags?.filter(t => t[0] === 'p').map(t => t[1]) || []
  const muted = muteEvent?.tags?.filter(t => t[0] === 'p').map(t => t[1]) || []

  const updateContacts = useMutation({
    mutationFn: async (newFollowing: string[]) => {
      if (!user.pubkey) throw new Error('Not logged in')
      const eventTemplate = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: newFollowing.map(p => ['p', p]),
        content: contactEvent?.content || '',
      }
      const signedEvent = await signerService.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      await set(`contacts-${user.pubkey}`, signedEvent)
      return signedEvent
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['contacts', user.pubkey], newEvent)
      triggerHaptic(30)
    }
  })

  const updateMutes = useMutation({
    mutationFn: async (newMuted: string[]) => {
      if (!user.pubkey) throw new Error('Not logged in')
      const eventTemplate = {
        kind: 10000,
        created_at: Math.floor(Date.now() / 1000),
        tags: newMuted.map(p => ['p', p]),
        content: '',
      }
      const signedEvent = await signerService.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      await set(`mutes-${user.pubkey}`, signedEvent)
      return signedEvent
    },
    onSuccess: (newEvent) => {
      queryClient.setQueryData(['mutes', user.pubkey], newEvent)
      triggerHaptic(30)
    }
  })

  const toggleFollow = (pubkey: string) => {
    const next = following.includes(pubkey)
      ? following.filter(p => p !== pubkey)
      : [...following, pubkey]
    updateContacts.mutate(next)
  }

  const toggleMute = (pubkey: string) => {
    const next = muted.includes(pubkey)
      ? muted.filter(p => p !== pubkey)
      : [...muted, pubkey]
    updateMutes.mutate(next)
  }

  return {
    following,
    muted,
    toggleFollow,
    toggleMute,
    isLoading: isContactsLoading || isMutesLoading,
    isUpdating: updateContacts.isPending || updateMutes.isPending
  }
}

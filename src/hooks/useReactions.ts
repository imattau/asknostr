import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export const useReactions = (eventId: string) => {
  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async () => {
      return new Promise<Event[]>((resolve) => {
        const reactions: Event[] = []
        nostrService.subscribe(
          [{ kinds: [7], '#e': [eventId] }],
          (event: Event) => {
            reactions.push(event)
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(reactions)
          }, 1500)
        })
      })
    },
    staleTime: 1000 * 30,
    enabled: !!eventId,
  })
}
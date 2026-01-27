import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export interface AggregatedReactions {
  [emoji: string]: {
    count: number
    pubkeys: string[]
  }
}

export const useReactions = (eventId: string) => {
  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: async () => {
      return new Promise<{ reactions: Event[], aggregated: AggregatedReactions }>((resolve) => {
        const reactions: Event[] = []
        const aggregated: AggregatedReactions = {}

        nostrService.subscribe(
          [{ kinds: [7], '#e': [eventId] }],
          (event: Event) => {
            reactions.push(event)
            const emoji = event.content || '+' // Default to + if empty
            if (!aggregated[emoji]) {
              aggregated[emoji] = { count: 0, pubkeys: [] }
            }
            aggregated[emoji].count++
            if (!aggregated[emoji].pubkeys.includes(event.pubkey)) {
              aggregated[emoji].pubkeys.push(event.pubkey)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve({ reactions, aggregated })
          }, 1500)
        })
      })
    },
    staleTime: 1000 * 30,
    enabled: !!eventId,
  })
}

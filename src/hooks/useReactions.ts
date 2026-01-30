import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export interface AggregatedReactions {
  [emoji: string]: {
    count: number
    pubkeys: string[]
  }
}

export const fetchReactions = (eventId: string): Promise<{ reactions: Event[], aggregated: AggregatedReactions }> => {
  return new Promise<{ reactions: Event[], aggregated: AggregatedReactions }>((resolve) => {
    const reactions: Event[] = []
    const aggregated: AggregatedReactions = {}
    const seen = new Set<string>()
    let resolved = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const finish = () => {
      if (resolved) return
      resolved = true
      if (timeoutId) clearTimeout(timeoutId)
      cleanup()
      resolve({ reactions, aggregated })
    }

    const cleanup = nostrService.requestMetadata('reactions', eventId, (event: Event) => {
      if (seen.has(event.id)) return
      seen.add(event.id)
      
      const emoji = event.content || '+'
      const isDuplicate = reactions.some(r => r.pubkey === event.pubkey && (r.content || '+') === emoji)
      
      reactions.push(event)
      
      if (!isDuplicate) {
        if (!aggregated[emoji]) {
          aggregated[emoji] = { count: 0, pubkeys: [] }
        }
        aggregated[emoji].count++
        if (!aggregated[emoji].pubkeys.includes(event.pubkey)) {
          aggregated[emoji].pubkeys.push(event.pubkey)
        }
      }
    });

    timeoutId = setTimeout(finish, 2500)
  })
}

export const useReactions = (eventId: string) => {
  return useQuery({
    queryKey: ['reactions', eventId],
    queryFn: () => fetchReactions(eventId),
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 5,    // 5 minutes
    enabled: !!eventId,
  })
}

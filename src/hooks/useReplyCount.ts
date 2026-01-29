import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import { useStore } from '../store/useStore'

export const useReplyCount = (eventId: string) => {
  const { events } = useStore()

  return useQuery({
    queryKey: ['reply-count', eventId],
    queryFn: async () => {
      // 1. Check local store buffer first for instant data
      const localCount = events.filter(e => 
        e.kind === 1 && 
        e.tags.some(t => t[0] === 'e' && t[1] === eventId)
      ).length

      return new Promise<number>((resolve) => {
        let count = localCount
        let sub: any = null
        let resolved = false

        const finish = () => {
          if (resolved) return
          resolved = true
          if (sub) sub.close()
          resolve(count)
        }

        // 2. Subscribe to find replies we don't have in local buffer
        nostrService.subscribe(
          [{ kinds: [1], '#e': [eventId], limit: 100 }],
          () => {
            count++
          },
          undefined,
          { onEose: finish }
        ).then(s => {
          sub = s
          // Safety timeout
          setTimeout(finish, 2000)
        })
      })
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5,    // 5 minutes
    enabled: !!eventId,
  })
}

import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export const useDeletions = (eventIds: string[]) => {
  return useQuery({
    queryKey: ['deletions', eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return []
      
      return new Promise<string[]>((resolve) => {
        const deletedIds: string[] = []
        nostrService.subscribe(
          [{ 
            kinds: [5], 
            '#e': eventIds
          }],
          (event: Event) => {
            const targets = event.tags.filter(t => t[0] === 'e').map(t => t[1])
            deletedIds.push(...targets)
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(deletedIds)
          }, 1500)
        })
      })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: eventIds.length > 0,
  })
}

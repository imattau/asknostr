import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export const useApprovals = (eventIds: string[], moderators: string[]) => {
  return useQuery({
    queryKey: ['approvals', eventIds, moderators],
    queryFn: async () => {
      if (eventIds.length === 0 || moderators.length === 0) return []
      
      return new Promise<Event[]>((resolve) => {
        const approvals: Event[] = []
        nostrService.subscribe(
          [{ 
            kinds: [4550], 
            '#e': eventIds,
            authors: moderators
          }],
          (event: Event) => {
            approvals.push(event)
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(approvals)
          }, 2000)
        })
      })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: eventIds.length > 0 && moderators.length > 0,
  })
}

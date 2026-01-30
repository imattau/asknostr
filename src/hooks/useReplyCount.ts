import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'

export const fetchReplyCount = (eventId: string): Promise<number> => {
  return new Promise<number>((resolve) => {
    let count = 0
    let resolved = false

    const finish = () => {
      if (resolved) return
      resolved = true
      cleanup()
      resolve(count)
    }

    const cleanup = nostrService.requestMetadata('replies', eventId, () => {
      count++
    });

    // Batch window for gathering initial counts
    setTimeout(finish, 3000)
  })
}

export const useReplyCount = (eventId: string) => {

  return useQuery({
    queryKey: ['reply-count', eventId],
    queryFn: () => fetchReplyCount(eventId),
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5,    // 5 minutes
    enabled: !!eventId,
  })
}

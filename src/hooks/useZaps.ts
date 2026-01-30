import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export const useZaps = (eventId: string) => {
  return useQuery({
    queryKey: ['zaps', eventId],
    queryFn: async () => {
      return new Promise<{ total: number, receipts: Event[] }>((resolve) => {
        const receipts: Event[] = []
        let total = 0

        const cleanup = nostrService.requestMetadata('zaps', eventId, (event: Event) => {
          receipts.push(event)
          const descriptionTag = event.tags.find(t => t[0] === 'description')?.[1]
          if (descriptionTag) {
            try {
              const desc = JSON.parse(descriptionTag)
              const amountTag = desc.tags.find((t: string[]) => t[0] === 'amount')?.[1]
              if (amountTag) {
                total += parseInt(amountTag) / 1000 // msats to sats
              }
            } catch {
              // Ignore parse errors
            }
          }
        });

        setTimeout(() => {
          cleanup()
          resolve({ total, receipts })
        }, 3000)
      })
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 15,    // 15 minutes
    enabled: !!eventId,
  })
}

import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'
import { useStore } from '../store/useStore'

export const useDeletions = (eventIds: string[]) => {
  const { events } = useStore()

  return useQuery({
    queryKey: ['deletions', eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return []
      
      return new Promise<string[]>((resolve) => {
        const deletedSet = new Set<string>()
        const seen = new Set<string>()
        const authorById = new Map(events.map(event => [event.id, event.pubkey]))
        let resolved = false
        let subRef: { close: () => void } | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = () => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          subRef?.close()
          resolve([...deletedSet])
        }

        nostrService.subscribe(
          [{ 
            kinds: [5], 
            '#e': eventIds
          }],
          (event: Event) => {
            if (seen.has(event.id)) return
            seen.add(event.id)
            const targets = event.tags.filter(t => t[0] === 'e').map(t => t[1])
            targets.forEach((targetId) => {
              if (authorById.get(targetId) === event.pubkey) {
                deletedSet.add(targetId)
              }
            })
          },
          undefined,
          { onEose: finish }
        ).then(sub => {
          subRef = sub
          if (resolved) {
            sub.close()
            return
          }
          timeoutId = setTimeout(finish, 1500)
        })
      })
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    enabled: eventIds.length > 0,
  })
}

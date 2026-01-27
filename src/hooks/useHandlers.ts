import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export interface HandlerDefinition {
  id: string // d tag
  name?: string
  about?: string
  image?: string
  website?: string
  lud16?: string
  kTags: number[] // kinds it handles
  event: Event
}

interface HandlerMetadata {
  name?: string
  about?: string
  picture?: string
  image?: string
  website?: string
  lud16?: string
}

export const useHandlers = (kinds: number[]) => {
  return useQuery({
    queryKey: ['handlers', kinds],
    queryFn: async () => {
      return new Promise<HandlerDefinition[]>((resolve) => {
        const handlers: HandlerDefinition[] = []
        nostrService.subscribe(
          [{ kinds: [31990], '#k': kinds.map(String) }],
          (event: Event) => {
            const dTag = event.tags.find(t => t[0] === 'd')?.[1]
            if (!dTag) return

            const kTags = event.tags.filter(t => t[0] === 'k').map(t => parseInt(t[1]))
            
            let metadata: HandlerMetadata = {}
            try {
              metadata = JSON.parse(event.content)
            } catch {
              // content might not be JSON
            }

            const handler: HandlerDefinition = {
              id: dTag,
              name: metadata.name,
              about: metadata.about,
              image: metadata.picture || metadata.image,
              website: metadata.website,
              lud16: metadata.lud16,
              kTags,
              event
            }
            
            if (!handlers.find(h => h.id === handler.id)) {
              handlers.push(handler)
            }
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            resolve(handlers)
          }, 2000)
        })
      })
    },
    staleTime: 1000 * 60 * 60, // 1 hour
    enabled: kinds.length > 0,
  })
}
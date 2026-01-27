import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

export interface TrendingCommunity {
  aTag: string
  count: number
  kind: string
  pubkey: string
  id: string
}

export const useTrendingCommunities = () => {
  return useQuery({
    queryKey: ['trending-communities'],
    queryFn: async () => {
      return new Promise<TrendingCommunity[]>((resolve) => {
        const communityCounts: Record<string, number> = {}
        const now = Math.floor(Date.now() / 1000)
        const oneDayAgo = now - (24 * 60 * 60)

        nostrService.subscribe(
          [{ kinds: [1, 4550], since: oneDayAgo, limit: 200 }],
          (event: Event) => {
            const aTags = event.tags.filter(t => t[0] === 'a' && t[1].startsWith('34550:'))
            aTags.forEach(t => {
              const aTag = t[1]
              communityCounts[aTag] = (communityCounts[aTag] || 0) + 1
            })
          }
        ).then(sub => {
          setTimeout(() => {
            sub.close()
            const sorted = Object.entries(communityCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([aTag, count]) => {
                const [kind, pubkey, id] = aTag.split(':')
                return { aTag, count, kind, pubkey, id }
              })
            resolve(sorted)
          }, 3000)
        })
      })
    },
    staleTime: 1000 * 60 * 15, // 15 minutes
  })
}

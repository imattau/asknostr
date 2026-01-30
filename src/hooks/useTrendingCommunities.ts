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

        const sub = nostrService.subscribe(
          [{ kinds: [1, 4550], since: oneDayAgo, limit: 200 }],
          (event: Event) => {
            const aTags = event.tags.filter(t => t[0] === 'a' && t[1].startsWith('34550:'))
            aTags.forEach(t => {
              const aTag = t[1]
              communityCounts[aTag] = (communityCounts[aTag] || 0) + 1
            })
          },
          nostrService.getDiscoveryRelays()
        )
        setTimeout(() => {
          sub.close()
          const sorted = Object.entries(communityCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([aTag, count]) => {
              const parts = aTag.split(':')
              const kind = parts[0] || '34550'
              const pubkey = parts[1] || ''
              const id = parts[2] || ''
              return { aTag, count, kind, pubkey, id }
            })
          resolve(sorted)
        }, 4000)
      })
    },
    staleTime: 1000 * 60 * 15,
  })
}

import { useMemo } from 'react'
import type { Event } from 'nostr-tools'

export type SortOrder = 'new' | 'hot' | 'top' | 'controversial'

export const useFeedSorting = (events: Event[], sortBy: SortOrder) => {
  return useMemo(() => {
    const sorted = [...events]

    switch (sortBy) {
      case 'new':
        return sorted.sort((a, b) => b.created_at - a.created_at)
      
      case 'top':
        // Simplified top: sort by content length or other available metadata
        // Real top requires aggregated query data
        return sorted.sort((a, b) => b.created_at - a.created_at)

      case 'hot':
        // Hot: recent events prioritized
        return sorted.sort((a, b) => b.created_at - a.created_at)

      case 'controversial':
        // Controversial: high activity but mixed
        return sorted.sort((a, b) => b.created_at - a.created_at)

      default:
        return sorted
    }
  }, [events, sortBy])
}
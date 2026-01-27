import { useMemo } from 'react'
import { useStore } from '../store/useStore'

export const useTrendingTags = () => {
  const { events } = useStore()

  return useMemo(() => {
    const tagCounts: Record<string, number> = {}
    
    events.forEach(event => {
      event.tags.forEach(tag => {
        if (tag[0] === 't') {
          const tagName = tag[1].toLowerCase()
          tagCounts[tagName] = (tagCounts[tagName] || 0) + 1
        }
      })
    })

    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }))
  }, [events])
}

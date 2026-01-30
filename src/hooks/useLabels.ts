import { useQuery } from '@tanstack/react-query'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

const formatLabel = (label: string, namespace?: string) => {
  const cleaned = label.trim()
  if (!cleaned) return ''
  if (!namespace || namespace === 'ugc') return `#${cleaned}`
  return `${namespace}/${cleaned}`
}

export const useLabels = (aTag?: string) => {
  return useQuery({
    queryKey: ['labels', aTag],
    queryFn: async () => {
      if (!aTag) return []

      return new Promise<string[]>((resolve) => {
        const labels = new Set<string>()
        const seen = new Set<string>()
        let resolved = false
        let subRef: { close: () => void } | null = null
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const finish = () => {
          if (resolved) return
          resolved = true
          if (timeoutId) clearTimeout(timeoutId)
          subRef?.close()
          resolve(Array.from(labels))
        }

        const sub = nostrService.subscribe(
          [{ kinds: [1985], '#a': [aTag] }],
          (event: Event) => {
            if (seen.has(event.id)) return
            seen.add(event.id)
            event.tags
              .filter(t => t[0] === 'l' && t[1])
              .forEach(t => {
                const formatted = formatLabel(t[1], t[2])
                if (formatted) labels.add(formatted)
              })
          },
          undefined,
          { onEose: finish }
        )
        
        subRef = sub
        if (resolved) {
          sub.close()
          return
        }
        timeoutId = setTimeout(finish, 2000)
      })
    },
    enabled: !!aTag,
    staleTime: 1000 * 60 * 10,
  })
}

import React from 'react'
import { List, useDynamicRowHeight } from 'react-window'
import { AutoSizer } from 'react-virtualized-auto-sizer'
import type { Event } from 'nostr-tools'
import { Post } from './Post'
import { useUiStore } from '../store/useUiStore'

interface VirtualFeedProps {
// ... (keep props)
  events: Event[]
  isLoadingMore: boolean
  onLoadMore: () => void
  onScroll?: (scrollOffset: number) => void
  header?: React.ReactNode
}

interface RowProps {
  events: Event[]
  isLoadingMore: boolean
  onLoadMore: () => void
  header?: React.ReactNode
}

const Row = ({
  ariaAttributes,
  index,
  style,
  events,
  isLoadingMore,
  onLoadMore,
  header
}: {
  ariaAttributes: {
    'aria-posinset': number
    'aria-setsize': number
    role: 'listitem'
  }
  index: number
  style: React.CSSProperties
} & RowProps): React.ReactElement | null => {
  const { theme } = useUiStore()
  if (header && index === 0) {
    return (
      <div style={style} {...ariaAttributes}>
        {header}
      </div>
    )
  }

  const adjustedIndex = header ? index - 1 : index
  const isLoadMoreRow = adjustedIndex === events.length

  return (
    <div style={style} className="px-4 py-2" {...ariaAttributes}>
      {isLoadMoreRow ? (
        <button
          onClick={onLoadMore}
          className={`w-full glassmorphism p-3 rounded-lg text-[10px] ${theme === 'light' ? 'text-slate-600' : 'opacity-50'} uppercase font-bold`}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </button>
      ) : (
        <Post event={events[adjustedIndex]} depth={0} />
      )}
    </div>
  )
}

export const VirtualFeed = React.forwardRef<typeof List, VirtualFeedProps>(
  ({ events, isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const rowCount = events.length + 1 + (header ? 1 : 0)
    const rowHeight = useDynamicRowHeight({ defaultRowHeight: 260, key: `${events.length}-${!!header}` })

    return (
      <div className="h-full w-full">
        <AutoSizer
          renderProp={({ height, width }) => {
            if (!height || !width) return null
            const ListAny = List as any
            return (
              <ListAny
                ref={ref}
                rowCount={rowCount}
                rowHeight={rowHeight}
                rowComponent={Row}
                rowProps={{ events, isLoadingMore, onLoadMore, header }}
                style={{ height, width }}
                onScroll={(event: React.UIEvent<HTMLDivElement>) => {
                  if (onScroll) {
                    onScroll(event.currentTarget.scrollTop)
                  }
                }}
              />
            )
          }}
        />
      </div>
    )
  }
)

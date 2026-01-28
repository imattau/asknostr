import React from 'react'
import { List, useDynamicRowHeight } from 'react-window'
import { AutoSizer } from 'react-virtualized-auto-sizer'
import type { Event } from 'nostr-tools'
import { Post } from './Post'

interface VirtualFeedProps {
  events: Event[]
  isLoadingMore: boolean
  onLoadMore: () => void
}

interface RowProps {
  events: Event[]
  isLoadingMore: boolean
  onLoadMore: () => void
}

const Row = ({
  ariaAttributes,
  index,
  style,
  events,
  isLoadingMore,
  onLoadMore
}: {
  ariaAttributes: {
    'aria-posinset': number
    'aria-setsize': number
    role: 'listitem'
  }
  index: number
  style: React.CSSProperties
} & RowProps): React.ReactElement | null => {
  const isLoadMoreRow = index === events.length

  return (
    <div style={style} className="px-4 py-2" {...ariaAttributes}>
      {isLoadMoreRow ? (
        <button
          onClick={onLoadMore}
          className="w-full glassmorphism p-3 rounded-lg text-[10px] opacity-50 uppercase font-bold"
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </button>
      ) : (
        <Post event={events[index]} />
      )}
    </div>
  )
}

export const VirtualFeed: React.FC<VirtualFeedProps> = ({ events, isLoadingMore, onLoadMore }) => {
  const rowHeight = useDynamicRowHeight({ defaultRowHeight: 260, key: `${events.length}` })

  return (
    <div className="h-full w-full">
      <AutoSizer
        renderProp={({ height, width }) => {
          if (!height || !width) return null
          return (
            <List
              rowCount={events.length + 1}
              rowHeight={rowHeight}
              rowComponent={Row}
              rowProps={{ events, isLoadingMore, onLoadMore }}
              style={{ height, width }}
            />
          )
        }}
      />
    </div>
  )
}

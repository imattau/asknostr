import React from 'react'
// @ts-ignore
import { List } from 'react-window'
import { AutoSizer } from 'react-virtualized-auto-sizer'
import type { Event } from 'nostr-tools'
import { Post } from './Post'
import { useUiStore } from '../store/useUiStore'

interface VirtualFeedProps {
  events: Event[]
  isLoadingMore: boolean
  onLoadMore: () => void
  onScroll?: (scrollOffset: number) => void
  header?: React.ReactNode
}

const Row = ({
  index,
  style,
  data
}: any): React.ReactElement | null => {
  const { events, isLoadingMore, onLoadMore, header } = data || {}
  const { theme } = useUiStore()

  if (!events) return <div style={style} />

  if (header && index === 0) {
    return (
      <div style={style}>
        {header}
      </div>
    )
  }

  const adjustedIndex = header ? index - 1 : index
  
  if (adjustedIndex === events.length) {
    return (
      <div style={style} className="px-4 py-2">
        <button
          onClick={onLoadMore}
          className={`w-full glassmorphism p-3 rounded-lg text-[10px] ${theme === 'light' ? 'text-slate-600' : 'opacity-50'} uppercase font-bold`}
          disabled={isLoadingMore}
        >
          {isLoadingMore ? 'Loading...' : 'Load More'}
        </button>
      </div>
    )
  }

  const event = events[adjustedIndex]
  if (!event) return <div style={style} />

  return (
    <div style={style} className="px-4 py-2">
      <Post event={event} depth={0} />
    </div>
  )
}

export const VirtualFeed = React.forwardRef<any, VirtualFeedProps>(
  ({ events, isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const rowCount = events.length + (header ? 1 : 0) + 1

    return (
      <div className="h-full w-full">
        <AutoSizer
          renderProp={({ height, width }: any) => {
            if (!height || !width) return null;
            const ListAny = List as any;
            return (
              <ListAny
                ref={ref}
                height={height}
                width={width}
                itemCount={rowCount}
                itemSize={260} // Use fixed size for stability with List
                itemData={{ events, isLoadingMore, onLoadMore, header }}
                onScroll={(e: any) => {
                  if (onScroll) {
                    const offset = e.scrollOffset !== undefined ? e.scrollOffset : e.target?.scrollTop;
                    if (offset !== undefined) onScroll(offset);
                  }
                }}
              >
                {Row}
              </ListAny>
            );
          }}
        />
      </div>
    )
  }
)

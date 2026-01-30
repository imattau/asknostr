import React, { useRef, useCallback, useEffect, useMemo } from 'react'
import { List, useDynamicRowHeight, useListRef } from 'react-window'
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

const Row = (props: any): React.ReactElement | null => {
  const { index, style, events, isLoadingMore, onLoadMore, header, theme, dynamicRowHeight } = props

  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rowRef.current) {
      return dynamicRowHeight.observeRowElements([rowRef.current])
    }
  }, [dynamicRowHeight])

  if (!events) return <div style={style} />

  if (header && index === 0) {
    return (
      <div style={style} ref={rowRef}>
        {header}
      </div>
    )
  }

  const adjustedIndex = header ? index - 1 : index
  
  if (adjustedIndex === events.length) {
    return (
      <div style={style} className="px-4 py-2" ref={rowRef}>
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
    <div style={style} className="px-4 py-2" ref={rowRef}>
      <Post event={event} depth={0} />
    </div>
  )
}

export const VirtualFeed = React.forwardRef<any, VirtualFeedProps>(
  ({ events = [], isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const internalListRef = useListRef()
    const { theme } = useUiStore()
    
    // We want to clear cache when the list is REFRESHED (e.g. navigation or manual refresh)
    // but not necessarily on every tiny update. 
    // However, if the first item's ID changes, it's likely a significant enough change to reset.
    const firstEventId = events[0]?.id || 'empty'
    
    const dynamicRowHeight = useDynamicRowHeight({
      defaultRowHeight: 260,
      key: `${firstEventId}-${header ? 'h' : 'nh'}`
    })

    const rowCount = events.length + (header ? 1 : 0) + 1

    return (
      <div className="h-full w-full">
        <AutoSizer
          renderProp={({ height, width }: any) => {
            if (!height || !width) return null;
            return (
              <List
                listRef={(node) => {
                  (internalListRef as any).current = node;
                  if (typeof ref === 'function') ref(node);
                  else if (ref) (ref as any).current = node;
                }}
                height={height}
                width={width}
                rowCount={rowCount}
                rowHeight={dynamicRowHeight}
                rowProps={{ 
                  events, 
                  isLoadingMore, 
                  onLoadMore, 
                  header,
                  theme,
                  dynamicRowHeight
                }}
                rowComponent={Row}
                onScroll={(e: any) => {
                  if (onScroll) {
                    const offset = e.target?.scrollTop;
                    if (offset !== undefined) onScroll(offset);
                  }
                }}
              />
            );
          }}
        />
      </div>
    )
  }
)
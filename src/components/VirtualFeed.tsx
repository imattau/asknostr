import React, { useRef, useEffect, useMemo } from 'react'
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

const Row = React.memo((props: any) => {
  const { index, style, data } = props
  
  if (!data) {
    return <div style={style} />
  }

  const { events, isLoadingMore, onLoadMore, header, theme, dynamicRowHeight } = data

  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (rowRef.current && dynamicRowHeight) {
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
  
  if (events.length > 0 && adjustedIndex === events.length) {
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
}, (prev, next) => {
  return prev.index === next.index && 
         prev.style === next.style && 
         prev.data === next.data
})

Row.displayName = 'VirtualFeedRow'

export const VirtualFeed = React.forwardRef<any, VirtualFeedProps>(
  ({ events = [], isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const internalListRef = useListRef()
    const { theme } = useUiStore()
    
    const firstEventId = events[0]?.id || 'empty'
    
    const dynamicRowHeight = useDynamicRowHeight({
      defaultRowHeight: 260,
      key: `${firstEventId}-${header ? 'h' : 'nh'}`
    })

    const rowCount = events.length + (header ? 1 : 0) + (events.length > 0 ? 1 : 0)

    const itemData = useMemo(() => ({
      events, 
      isLoadingMore, 
      onLoadMore, 
      header,
      theme,
      dynamicRowHeight
    }), [events, isLoadingMore, onLoadMore, header, theme, dynamicRowHeight])

    if (events.length === 0 && !header) {
      return (
        <div className="flex flex-col items-center justify-center h-full opacity-20 font-mono text-[10px] uppercase tracking-[0.3em]">
          No_Activity_Detected
        </div>
      )
    }

    return (
      <div className="h-full w-full">
        <AutoSizer>
          {({ height, width }: any) => {
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
                overscanCount={5}
                itemData={itemData}
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
        </AutoSizer>
      </div>
    )
  }
)
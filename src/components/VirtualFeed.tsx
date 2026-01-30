import React, { useRef, useEffect } from 'react'
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

// In react-window v2 (and v1), if you use rowComponent, it receives props.index, props.style, and props.rowProps (v2) or props.data (v1)
const Row = React.memo((props: any) => {
  const { index, style, rowProps } = props
  // Check if it's v2 (rowProps) or v1 (data)
  const data = rowProps || props.data
  
  if (!data) {
    console.error('[VirtualFeed] Row rendered without data at index:', index)
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
}, (prev, next) => {
  const prevData = prev.rowProps || prev.data
  const nextData = next.rowProps || next.data
  return prev.index === next.index && 
         prev.style === next.style && 
         prevData?.events === nextData?.events &&
         prevData?.theme === nextData?.theme &&
         prevData?.isLoadingMore === nextData?.isLoadingMore
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
                overscanCount={5}
                // In v2, rowProps is the way to pass data to rowComponent
                rowProps={{ 
                  events, 
                  isLoadingMore, 
                  onLoadMore, 
                  header,
                  theme,
                  dynamicRowHeight
                }}
                // Support both v1 and v2 just in case
                itemData={{
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

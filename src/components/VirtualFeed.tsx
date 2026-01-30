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

const Row = React.memo((props: any) => {
  const { index, style } = props
  
  // Diagnostic log to see exactly what react-window v2 passes
  if (index === 0) {
    console.log('[VirtualFeed] Row props sample:', Object.keys(props))
  }

  // Support v2 (spread props), v2 (explicit rowProps), and v1 (itemData/data)
  const data = props.rowProps || props.data || props
  
  const { events, isLoadingMore, onLoadMore, header, theme, dynamicRowHeight } = data

  if (!events) {
    if (index === 0) console.warn('[VirtualFeed] No events found in row data')
    return <div style={style} />
  }

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

    const rowCount = events.length + (header ? 1 : 0) + (events.length > 0 ? 1 : 0)

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
            
            console.log(`[VirtualFeed] Rendering ${rowCount} rows at ${width}x${height}`);
            
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
                // Pass data in all possible ways to ensure compatibility
                rowProps={{ 
                  events, 
                  isLoadingMore, 
                  onLoadMore, 
                  header,
                  theme,
                  dynamicRowHeight
                }}
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
        </AutoSizer>
      </div>
    )
  }
)

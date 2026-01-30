import React, { useRef, useCallback, useEffect } from 'react'
import { VariableSizeList as List } from 'react-window'
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
  const { index, style, data } = props
  const { events, isLoadingMore, onLoadMore, header, theme, onRowHeightChange } = data

  if (!events) return <div style={style} />

  const handleHeightChange = useCallback((height: number) => {
    onRowHeightChange(index, height)
  }, [index, onRowHeightChange])

  if (header && index === 0) {
    return (
      <div style={style}>
        <div ref={(el) => {
          if (el) {
            const h = el.getBoundingClientRect().height
            if (h > 0) handleHeightChange(h)
          }
        }}>
          {header}
        </div>
      </div>
    )
  }

  const adjustedIndex = header ? index - 1 : index
  
  if (adjustedIndex === events.length) {
    return (
      <div style={style} className="px-4 py-2">
        <div ref={(el) => {
          if (el) {
            const h = el.getBoundingClientRect().height
            if (h > 0) handleHeightChange(h)
          }
        }}>
          <button
            onClick={onLoadMore}
            className={`w-full glassmorphism p-3 rounded-lg text-[10px] ${theme === 'light' ? 'text-slate-600' : 'opacity-50'} uppercase font-bold`}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      </div>
    )
  }

  const event = events[adjustedIndex]
  if (!event) return <div style={style} />

  return (
    <div style={style} className="px-4 py-2">
      <Post event={event} depth={0} onHeightChange={handleHeightChange} />
    </div>
  )
}

export const VirtualFeed = React.forwardRef<any, VirtualFeedProps>(
  ({ events = [], isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const listRef = useRef<List>(null)
    const rowHeights = useRef<Record<number, number>>({})
    const { theme } = useUiStore()

    const onRowHeightChange = useCallback((index: number, height: number) => {
      // Add a small buffer for safety
      const h = height + 16
      if (rowHeights.current[index] !== h) {
        rowHeights.current[index] = h
        if (listRef.current) {
          listRef.current.resetAfterIndex(index)
        }
      }
    }, [])

    const getRowHeight = useCallback((index: number) => {
      return rowHeights.current[index] || 260
    }, [])

    const getItemKey = useCallback((index: number, data: any) => {
      const { events, header } = data
      if (header && index === 0) return 'header'
      const adjustedIndex = header ? index - 1 : index
      if (adjustedIndex === events.length) return 'load-more'
      return events[adjustedIndex]?.id || `idx-${index}`
    }, [])

    const rowCount = events.length + (header ? 1 : 0) + 1

    // Clear cache when events change significantly (e.g. refresh)
    useEffect(() => {
      if (listRef.current) {
        // If we just loaded more, we only need to reset from the previous end
        // but for simplicity and to handle re-orders/deletions, we reset all.
        // However, resetting all might cause a jump.
        // Let's only reset after the previous length if it was an append.
        listRef.current.resetAfterIndex(0)
      }
    }, [events.length, header])

    return (
      <div className="h-full w-full">
        <AutoSizer
          renderProp={({ height, width }: any) => {
            if (!height || !width) return null;
            return (
              <List
                ref={(node) => {
                  (listRef as any).current = node;
                  if (typeof ref === 'function') ref(node);
                  else if (ref) (ref as any).current = node;
                }}
                height={height}
                width={width}
                itemCount={rowCount}
                itemSize={getRowHeight}
                itemKey={getItemKey}
                itemData={{ 
                  events, 
                  isLoadingMore, 
                  onLoadMore, 
                  header,
                  theme,
                  onRowHeightChange
                }}
                onScroll={(e: any) => {
                  if (onScroll) {
                    const offset = e.scrollOffset !== undefined ? e.scrollOffset : e.target?.scrollTop;
                    if (offset !== undefined) onScroll(offset);
                  }
                }}
              >
                {Row}
              </List>
            );
          }}
        />
      </div>
    )
  }
)

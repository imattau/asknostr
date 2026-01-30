import React, { useRef, useCallback, useEffect, useState } from 'react'
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
    onRowHeightChange(index, height + 16) // Add padding
  }, [index, onRowHeightChange])

  if (header && index === 0) {
    return (
      <div style={style}>
        <div ref={(el) => el && handleHeightChange(el.getBoundingClientRect().height)}>
          {header}
        </div>
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
      if (rowHeights.current[index] !== height) {
        rowHeights.current[index] = height
        if (listRef.current) {
          listRef.current.resetAfterIndex(index)
        }
      }
    }, [])

    const getRowHeight = useCallback((index: number) => {
      return rowHeights.current[index] || 260
    }, [])

    const rowCount = events.length + (header ? 1 : 0) + 1

    useEffect(() => {
      if (listRef.current) {
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
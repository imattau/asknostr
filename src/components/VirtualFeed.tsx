import React, { useCallback, useMemo, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'
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

export const VirtualFeed = React.forwardRef<any, VirtualFeedProps>(
  ({ events = [], isLoadingMore, onLoadMore, onScroll, header }, ref) => {
    const { theme } = useUiStore()
    const headerRef = useRef<React.ReactNode>(null)
    const isLoadingMoreRef = useRef(isLoadingMore)
    const onLoadMoreRef = useRef(onLoadMore)
    const themeRef = useRef(theme)

    headerRef.current = header
    isLoadingMoreRef.current = isLoadingMore
    onLoadMoreRef.current = onLoadMore
    themeRef.current = theme

    const Header = useCallback(() => {
      if (!headerRef.current) return null
      return <div className="w-full">{headerRef.current}</div>
    }, [])

    const Footer = useCallback(() => {
      return (
        <div className="px-4 py-4 pb-20">
          <button
            onClick={() => onLoadMoreRef.current()}
            className={`w-full glassmorphism p-3 rounded-lg text-[10px] ${themeRef.current === 'light' ? 'text-slate-600' : 'opacity-50'} uppercase font-bold`}
            disabled={isLoadingMoreRef.current}
          >
            {isLoadingMoreRef.current ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )
    }, [])

    const components = useMemo(
      () => ({
        Header,
        Footer,
      }),
      [Header, Footer]
    )

    return (
      <div className="h-full w-full relative">
        <Virtuoso
          ref={ref}
          data={events}
          useWindowScroll={false}
          style={{ height: '100%', width: '100%' }}
          increaseViewportBy={200}
          endReached={() => {
            if (!isLoadingMore && events.length > 0) {
              onLoadMore()
            }
          }}
          onScroll={(e: any) => {
            if (onScroll) {
              const offset = e.target?.scrollTop;
              if (offset !== undefined) onScroll(offset);
            }
          }}
          components={components}
          itemContent={(_index, event) => (
            <div className="px-4 py-2 border-b border-white/5">
              <Post event={event} depth={0} />
            </div>
          )}
        />
      </div>
    )
  }
)

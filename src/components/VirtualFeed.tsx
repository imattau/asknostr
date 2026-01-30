import React from 'react'
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
          components={{
            Header: () => (
              <>
                {header && <div className="w-full">{header}</div>}
              </>
            ),
            Footer: () => (
              <div className="px-4 py-4 pb-20">
                <button
                  onClick={onLoadMore}
                  className={`w-full glassmorphism p-3 rounded-lg text-[10px] ${theme === 'light' ? 'text-slate-600' : 'opacity-50'} uppercase font-bold`}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )
          }}
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

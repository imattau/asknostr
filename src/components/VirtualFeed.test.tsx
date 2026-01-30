import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { VirtualFeed } from './VirtualFeed'

// Mock react-window components
vi.mock('react-window', () => ({
  List: ({ rowCount, rowHeight, rowComponent: Row, rowProps }: any) => {
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: rowCount }).map((_, i) => {
          const height = typeof rowHeight === 'object' ? rowHeight.getRowHeight(i) || 260 : 260;
          return (
            <div key={i} data-testid={`row-${i}`} style={{ height }}>
              <Row index={i} {...rowProps} style={{}} />
            </div>
          )
        })}
      </div>
    )
  },
  useDynamicRowHeight: vi.fn(() => ({
    getRowHeight: vi.fn((index) => index === 0 ? 316 : 260),
    observeRowElements: vi.fn()
  })),
  useListRef: vi.fn(() => ({ current: null }))
}))

// Mock AutoSizer
vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({ renderProp }: any) => renderProp({ height: 1000, width: 1000 }),
}))

// Mock Post component
vi.mock('./Post', () => ({
  Post: () => <div data-testid="post">Post Content</div>,
}))

describe('VirtualFeed', () => {
  const mockEvents = [
    { id: '1', pubkey: 'p1', created_at: 1, content: 'c1', tags: [], sig: 's1' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the list and show correct heights', async () => {
    await act(async () => {
      render(
        <VirtualFeed 
          events={mockEvents as any} 
          isLoadingMore={false} 
          onLoadMore={() => {}} 
        />
      )
    })
    
    // In our mock, row 0 has height 316
    const row = screen.getByTestId('row-0')
    expect(row.getAttribute('style')).toContain('height: 316px')
  })
})
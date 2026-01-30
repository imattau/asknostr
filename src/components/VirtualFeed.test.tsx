import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { VirtualFeed } from './VirtualFeed'

// Mock react-window components
const mockResetAfterIndex = vi.fn()
vi.mock('react-window', () => ({
  VariableSizeList: React.forwardRef(({ itemCount, itemSize, children: Row, itemData }: any, ref: any) => {
    const [, forceUpdate] = React.useState(0)
    React.useImperativeHandle(ref, () => ({
      resetAfterIndex: (index: number) => {
        mockResetAfterIndex(index)
        forceUpdate(s => s + 1)
      }
    }))
    return (
      <div data-testid="virtual-list">
        {Array.from({ length: itemCount }).map((_, i) => (
          <div key={i} data-testid={`row-${i}`} style={{ height: itemSize(i) }}>
            <Row index={i} data={itemData} style={{}} />
          </div>
        ))}
      </div>
    )
  }),
}))

// Mock AutoSizer
vi.mock('react-virtualized-auto-sizer', () => ({
  AutoSizer: ({ renderProp }: any) => renderProp({ height: 1000, width: 1000 }),
}))

// Mock Post component
vi.mock('./Post', () => ({
  Post: ({ onHeightChange }: any) => {
    React.useEffect(() => {
      onHeightChange?.(300) // Report a height
    }, [onHeightChange])
    return <div data-testid="post">Post Content</div>
  },
}))

describe('VirtualFeed', () => {
  const mockEvents = [
    { id: '1', pubkey: 'p1', created_at: 1, content: 'c1', tags: [], sig: 's1' },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the list and update row heights', async () => {
    await act(async () => {
      render(
        <VirtualFeed 
          events={mockEvents as any} 
          isLoadingMore={false} 
          onLoadMore={() => {}} 
        />
      )
    })
    
    // Row 0 should have reported height 300 + 16 padding = 316
    const row = screen.getByTestId('row-0')
    expect(row.getAttribute('style')).toContain('height: 316px')
    expect(mockResetAfterIndex).toHaveBeenCalled()
  })
})

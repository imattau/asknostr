import { describe, it, expect } from 'vitest'
import type { Event } from 'nostr-tools'

// Mocking communityEvents filter logic from CommunityFeed.tsx
const filterCommunityEvents = (events: Event[], communityATag: string, communityId: string) => {
  return events.filter(e => {
    const hasATag = e.tags.some(t => t[0] === 'a' && t[1] === communityATag);
    const hasTTag = e.tags.some(t => t[0] === 't' && t[1]?.toLowerCase() === communityId.toLowerCase());
    return hasATag || hasTTag;
  });
}

describe('Community Tag Matching', () => {
  const communityId = 'MyCommunity'
  const creator = 'pubkey1'
  const communityATag = `34550:${creator}:${communityId}`

  it('should match an exact "a" tag', () => {
    const events = [
      { 
        kind: 1, 
        tags: [['a', communityATag, '', 'root']], 
        content: 'hello',
        id: 'e1'
      } as Event
    ]
    const result = filterCommunityEvents(events, communityATag, communityId)
    expect(result).toHaveLength(1)
  })

  it('should match a "t" tag case-insensitively', () => {
    const events = [
      { 
        kind: 1, 
        tags: [['t', 'mycommunity']], 
        content: 'hello',
        id: 'e2'
      } as Event,
      { 
        kind: 1, 
        tags: [['t', 'MYCOMMUNITY']], 
        content: 'hello',
        id: 'e3'
      } as Event
    ]
    const result = filterCommunityEvents(events, communityATag, communityId)
    expect(result).toHaveLength(2)
  })

  it('should not match unrelated events', () => {
    const events = [
      { 
        kind: 1, 
        tags: [['t', 'other']], 
        content: 'hello',
        id: 'e4'
      } as Event
    ]
    const result = filterCommunityEvents(events, communityATag, communityId)
    expect(result).toHaveLength(0)
  })
})

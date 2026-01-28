import type { Event } from 'nostr-tools'
import type { CommunityDefinition } from '../hooks/useCommunity'

export const parseCommunityEvent = (event: Event): CommunityDefinition | null => {
  if (event.kind !== 34550) return null

  try {
    const dTag = event.tags.find(t => t[0] === 'd')?.[1]
    if (!dTag) return null

    const moderators = [...new Set([
      event.pubkey, // Creator is always a moderator
      ...event.tags.filter(t => t[0] === 'p').map(t => t[1])
    ])]
    const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1])
    const pinned = event.tags.filter(t => t[0] === 'e').map(t => t[1])
    const name = event.tags.find(t => t[0] === 'name')?.[1]
    const description = event.tags.find(t => t[0] === 'description')?.[1]
    const rules = event.tags.find(t => t[0] === 'rules')?.[1]
    const image = event.tags.find(t => t[0] === 'image')?.[1]
    const moderationMode = (event.tags.find(t => t[0] === 'moderation_mode')?.[1] || 'open') as 'open' | 'restricted'

    return {
      id: dTag,
      name: name || dTag,
      description: description || '',
      rules,
      image,
      moderators,
      relays,
      pinned,
      creator: event.pubkey,
      moderationMode
    }
  } catch (e) {
    console.error('[NostrParser] Error parsing Kind 34550:', e)
    return null
  }
}

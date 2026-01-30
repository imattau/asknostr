/// <reference lib="webworker" />
import { SimplePool, verifyEvent } from 'nostr-tools'
import type { Event, Filter } from 'nostr-tools'

type WorkerMessage =
  | { type: 'subscribe'; subId: string; filters: Filter[]; relays: string[] }
  | { type: 'close'; subId: string }
  | { type: 'register_feed'; key: string; filters: Filter[]; relays: string[]; limit: number }
  | { type: 'unregister_feed'; key: string }
  | { type: 'snapshot_request'; key: string }

type EventMessage = { type: 'event'; subId: string; event: Event }
type EoseMessage = { type: 'eose'; subId: string }
type ClosedMessage = { type: 'closed'; subId: string }
type ErrorMessage = { type: 'error'; subId?: string; message: string }
type FeedEventMessage = { type: 'feed-event'; key: string; event: Event }
type FeedSnapshotMessage = { type: 'feed-snapshot'; key: string; events: Event[] }

type ToMainMessage = EventMessage | EoseMessage | ClosedMessage | ErrorMessage | FeedEventMessage | FeedSnapshotMessage

const pool = new SimplePool()
const subscriptions = new Map<string, ReturnType<typeof pool.subscribeMap>>()

interface FeedEntry {
  key: string
  filters: Filter[]
  relays: string[]
  limit: number
  buffer: Event[]
  seenIds: Set<string>
  subId: string
  subscription?: ReturnType<typeof pool.subscribeMap>
}

const feedRegistry = new Map<string, FeedEntry>()
const subIdToFeedKey = new Map<string, string>()

const publishMessage = (message: ToMainMessage) => {
  self.postMessage(message)
}

const handleEvent = (subId: string, event: Event) => {
  try {
    if (!verifyEvent(event)) return
  } catch {
    return
  }

  publishMessage({ type: 'event', subId, event })
}

const handleEose = (subId: string) => {
  publishMessage({ type: 'eose', subId })
}

const handleClosed = (subId: string) => {
  publishMessage({ type: 'closed', subId })
  const feedKey = subIdToFeedKey.get(subId)
  if (feedKey) {
    subIdToFeedKey.delete(subId)
    const entry = feedRegistry.get(feedKey)
    if (entry && entry.subId === subId) {
      entry.subscription = undefined
    }
  }
}

const startSubscription = (subId: string, filters: Filter[], relays: string[]) => {
  if (!filters.length || !relays.length) {
    publishMessage({ type: 'error', subId, message: 'Empty filters or relays' })
    return
  }

  try {
    const subscription = pool.subscribeMap(
      relays.flatMap(url => filters.map(filter => ({ url, filter }))),
      {
        onevent: (event: Event) => handleEvent(subId, event),
        oneose: () => handleEose(subId),
        onclose: () => handleClosed(subId)
      }
    )
    subscriptions.set(subId, subscription)
  } catch (err) {
    publishMessage({ type: 'error', subId, message: (err as Error).message })
  }
}

const closeSubscription = (subId: string) => {
  const subscription = subscriptions.get(subId)
  if (subscription) {
    subscription.close()
    subscriptions.delete(subId)
  }
}

const handleFeedEvent = (entry: FeedEntry, event: Event) => {
  if (entry.seenIds.has(event.id)) return
  entry.seenIds.add(event.id)
  entry.buffer.unshift(event)
  if (entry.buffer.length > entry.limit) {
    entry.buffer.pop()
  }
  publishMessage({ type: 'feed-event', key: entry.key, event })
}

const startFeedSubscription = (entry: FeedEntry) => {
  if (entry.subscription) return
  if (!entry.filters.length || !entry.relays.length) return
  try {
    const subscription = pool.subscribeMap(
      entry.relays.flatMap(url => entry.filters.map(filter => ({ url, filter }))),
      {
        onevent: (event: Event) => handleFeedEvent(entry, event),
        oneose: () => {},
        onclose: () => handleClosed(entry.subId)
      }
    )
    entry.subscription = subscription
    subIdToFeedKey.set(entry.subId, entry.key)
  } catch (err) {
    publishMessage({ type: 'error', subId: entry.subId, message: (err as Error).message })
  }
}

const sendFeedSnapshot = (entry: FeedEntry) => {
  publishMessage({ type: 'feed-snapshot', key: entry.key, events: [...entry.buffer] })
}

const registerFeed = (key: string, filters: Filter[], relays: string[], limit: number) => {
  const normalizedFilters = filters.map(filter => ({ ...filter }))
  const normalizedRelays = relays.filter(Boolean)
  let entry = feedRegistry.get(key)
  if (entry) {
    entry.filters = normalizedFilters
    entry.relays = normalizedRelays
    entry.limit = limit
  } else {
    entry = {
      key,
      filters: normalizedFilters,
      relays: normalizedRelays,
      limit,
      buffer: [],
      seenIds: new Set<string>(),
      subId: `feed-${key}`
    }
    feedRegistry.set(key, entry)
  }
  startFeedSubscription(entry)
}

const unregisterFeed = (key: string) => {
  const entry = feedRegistry.get(key)
  if (!entry) return
  entry.subscription?.close()
  feedRegistry.delete(key)
  subIdToFeedKey.delete(entry.subId)
}

const handleSnapshotRequest = (key: string) => {
  const entry = feedRegistry.get(key)
  if (!entry) return
  sendFeedSnapshot(entry)
}

self.addEventListener('message', (event) => {
  const message = event.data as WorkerMessage
  if (!message || !message.type) return

  switch (message.type) {
    case 'subscribe':
      startSubscription(message.subId, message.filters, message.relays)
      break
    case 'close':
      closeSubscription(message.subId)
      break
    case 'register_feed':
      registerFeed(message.key, message.filters, message.relays, message.limit)
      break
    case 'unregister_feed':
      unregisterFeed(message.key)
      break
    case 'snapshot_request':
      handleSnapshotRequest(message.key)
      break
  }
})

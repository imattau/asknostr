// event-worker.js
import { verifyEvent } from 'nostr-tools'

self.onmessage = async (e) => {
  const { event } = e.data
  try {
    const isValid = verifyEvent(event)
    self.postMessage({ id: event.id, isValid })
  } catch (err) {
    self.postMessage({ id: event.id, isValid: false, error: err.message })
  }
}

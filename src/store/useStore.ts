import { create } from 'zustand'
import type { Event } from 'nostr-tools'

export interface UserProfile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  website?: string
  lud16?: string
  nip05?: string
}

interface NostrState {
  events: Event[]
  optimisticReactions: Record<string, string[]> // eventId -> array of pubkeys who liked
  optimisticApprovals: string[] // array of eventIds approved by current user (if moderator)
  relays: string[]
  isConnected: boolean
  user: {
    pubkey: string | null
    profile: UserProfile | null
  }
  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  addOptimisticReaction: (eventId: string, pubkey: string) => void
  addOptimisticApproval: (eventId: string) => void
  setRelays: (relays: string[]) => void
  setConnected: (connected: boolean) => void
  setUser: (pubkey: string | null) => void
  setProfile: (profile: UserProfile) => void
  login: () => Promise<void>
  logout: () => void
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>
      signEvent: (event: Partial<Event>) => Promise<Event>
    }
  }
}

export const useStore = create<NostrState>((set) => ({
  events: [],
  optimisticReactions: {},
  optimisticApprovals: [],
  relays: [],
  isConnected: false,
  user: {
    pubkey: null,
    profile: null,
  },
  setEvents: (events) => set({ events }),
  addEvent: (event) => set((state) => {
    if (state.events.find(e => e.id === event.id)) return state
    const newEvents = [...state.events, event].sort((a, b) => b.created_at - a.created_at)
    return { events: newEvents }
  }),
  addOptimisticReaction: (eventId, pubkey) => set((state) => {
    const current = state.optimisticReactions[eventId] || []
    if (current.includes(pubkey)) return state
    return {
      optimisticReactions: {
        ...state.optimisticReactions,
        [eventId]: [...current, pubkey]
      }
    }
  }),
  addOptimisticApproval: (eventId) => set((state) => {
    if (state.optimisticApprovals.includes(eventId)) return state
    return {
      optimisticApprovals: [...state.optimisticApprovals, eventId]
    }
  }),
  setRelays: (relays) => set({ relays }),
  setConnected: (connected) => set({ isConnected: connected }),
  setUser: (pubkey) => set((state) => ({ user: { ...state.user, pubkey } })),
  setProfile: (profile) => set((state) => ({ user: { ...state.user, profile } })),
  login: async () => {
    if (window.nostr) {
      try {
        const pubkey = await window.nostr.getPublicKey()
        set((state) => ({ user: { ...state.user, pubkey } }))
      } catch (e) {
        console.error('Login failed', e)
      }
    } else {
      alert('Nostr extension not found')
    }
  },
  logout: () => set({ user: { pubkey: null, profile: null } }),
}))

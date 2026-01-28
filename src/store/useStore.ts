import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { Event } from 'nostr-tools'

export interface UserProfile {
  name?: string
  display_name?: string
  picture?: string
  about?: string
  website?: string
  banner?: string
  lud16?: string
  nip05?: string
}

const MAX_EVENTS = 2000

interface NostrState {
  events: Event[]
  optimisticReactions: Record<string, Record<string, string[]>> // eventId -> { emoji -> pubkeys[] }
  optimisticApprovals: string[]
  relays: string[]
  isConnected: boolean
  loginMethod: 'nip07' | 'nip46' | null
  remoteSigner: {
    pubkey: string | null
    relay: string | null
    secret: string | null
  }
  user: {
    pubkey: string | null
    profile: UserProfile | null
  }
  setEvents: (events: Event[]) => void
  addEvent: (event: Event) => void
  addOptimisticReaction: (eventId: string, pubkey: string, emoji: string) => void
  addOptimisticApproval: (eventId: string) => void
  setRelays: (relays: string[]) => void
  setConnected: (connected: boolean) => void
  setUser: (pubkey: string | null) => void
  setProfile: (profile: UserProfile) => void
  setLoginMethod: (method: 'nip07' | 'nip46' | null) => void
  setRemoteSigner: (signer: { pubkey: string | null, relay: string | null, secret: string | null }) => void
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

export const useStore = create<NostrState>()(
  persist(
    (set, get) => ({
      events: [],
      optimisticReactions: {},
      optimisticApprovals: [],
      relays: [],
      isConnected: false,
      loginMethod: null,
      remoteSigner: {
        pubkey: null,
        relay: null,
        secret: null,
      },
      user: {
        pubkey: null,
        profile: null,
      },
      setEvents: (events) => set({ events }),
      addEvent: (event) => set((state) => {
        if (state.events.find(e => e.id === event.id)) return state
        const newEvents = [...state.events, event]
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, MAX_EVENTS)
        return { events: newEvents }
      }),
      addOptimisticReaction: (eventId, pubkey, emoji) => set((state) => {
        const currentEvent = state.optimisticReactions[eventId] || {}
        const currentEmoji = currentEvent[emoji] || []
        
        if (currentEmoji.includes(pubkey)) return state
        
        return {
          optimisticReactions: { 
            ...state.optimisticReactions, 
            [eventId]: {
              ...currentEvent,
              [emoji]: [...currentEmoji, pubkey]
            }
          }
        }
      }),
      addOptimisticApproval: (eventId) => set((state) => {
        if (state.optimisticApprovals.includes(eventId)) return state
        return { optimisticApprovals: [...state.optimisticApprovals, eventId] }
      }),
      setRelays: (relays) => set({ relays }),
      setConnected: (connected) => set({ isConnected: connected }),
      setUser: (pubkey) => set((state) => ({ user: { ...state.user, pubkey } })),
      setProfile: (profile) => set((state) => ({ user: { ...state.user, profile } })),
      setLoginMethod: (method) => set({ loginMethod: method }),
      setRemoteSigner: (signer) => set({ remoteSigner: signer }),
      login: async () => {
        if (window.nostr) {
          try {
            const pubkey = await window.nostr.getPublicKey()
            const state = get()
            set(() => ({ 
              user: { ...state.user, pubkey },
              loginMethod: 'nip07'
            }))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const qc = (window as any).queryClient
            if (qc) qc.invalidateQueries()
          } catch (e) {
            console.error('Login failed', e)
          }
        } else {
          alert('Nostr extension not found')
        }
      },
      logout: () => set({ 
        user: { pubkey: null, profile: null }, 
        loginMethod: null,
        remoteSigner: { pubkey: null, relay: null, secret: null }
      }),
    }),
    {
      name: 'asknostr-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user, 
        relays: state.relays, 
        loginMethod: state.loginMethod,
        remoteSigner: state.remoteSigner
      }),
    }
  )
)

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { sanitizeRelayUrls } from '../utils/relays'

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

export type MediaServerType = 'blossom' | 'generic'

export interface MediaServer {
  id: string
  url: string
  type: MediaServerType
}

const DEFAULT_MEDIA_SERVERS: MediaServer[] = [
  { id: 'blossom-nostr-wine', url: 'https://blossom.nostr.wine', type: 'blossom' },
  { id: 'blossom-void-cat', url: 'https://void.cat', type: 'blossom' },
  { id: 'media-nostr-build', url: 'https://nostr.build', type: 'generic' },
]

interface NostrState {
  optimisticReactions: Record<string, Record<string, string[]>> // eventId -> { emoji -> pubkeys[] }
  optimisticDeletions: string[] // array of event IDs to treat as deleted
  optimisticApprovals: string[]
  relays: string[]
  mediaServers: MediaServer[]
  isConnected: boolean
  loginMethod: 'nip07' | 'nip46' | 'local' | null
  remoteSigner: {
    pubkey: string | null
    relays: string[]
    secret: string | null
  }
  user: {
    pubkey: string | null
    profile: UserProfile | null
  }
  lastRead: Record<string, number> // aTag -> timestamp
  nwcUrl: string | null
  bridgeUrl: string
  administeredStations: any[] // CommunityDefinition[]
  addOptimisticReaction: (eventId: string, pubkey: string, emoji: string) => void
  addOptimisticDeletion: (eventId: string) => void
  addOptimisticApproval: (eventId: string) => void
  setRelays: (relays: string[]) => void
  setMediaServers: (servers: MediaServer[]) => void
  addMediaServer: (server: MediaServer) => void
  removeMediaServer: (id: string) => void
  setConnected: (connected: boolean) => void
  setUser: (pubkey: string | null) => void
  setProfile: (profile: UserProfile) => void
  setLoginMethod: (method: 'nip07' | 'nip46' | 'local' | null) => void
  setRemoteSigner: (signer: { pubkey: string | null, relays: string[], secret: string | null }) => void
  setNwcUrl: (url: string | null) => void
  setBridgeUrl: (url: string) => void
  setAdministeredStations: (stations: any[]) => void
  markAsRead: (aTag: string) => void
  login: () => Promise<void>
  logout: () => void
}

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>
      signEvent: (event: any) => Promise<any>
    }
  }
}

export const useStore = create<NostrState>()(
  persist(
    (set, get) => ({
      optimisticReactions: {},
      optimisticDeletions: [],
      optimisticApprovals: [],
      relays: [],
      mediaServers: DEFAULT_MEDIA_SERVERS,
      isConnected: false,
      loginMethod: null,
      remoteSigner: {
        pubkey: null,
        relays: [],
        secret: null,
      },
      user: {
        pubkey: null,
        profile: null,
      },
      lastRead: {},
      nwcUrl: null,
      bridgeUrl: '',
      administeredStations: [],
      addOptimisticReaction: (eventId, pubkey, emoji) => set((state) => {
        const currentEvent = state.optimisticReactions[eventId] || {}
        const currentEmoji = currentEvent[emoji] || []
        if (currentEmoji.includes(pubkey)) return state
        
        let nextReactions = { 
          ...state.optimisticReactions, 
          [eventId]: { ...currentEvent, [emoji]: [...currentEmoji, pubkey] }
        }

        // Keep last 100 event reactions in memory
        const keys = Object.keys(nextReactions)
        if (keys.length > 100) {
          const { [keys[0]]: _, ...rest } = nextReactions
          nextReactions = rest
        }

        return { optimisticReactions: nextReactions }
      }),
      addOptimisticDeletion: (eventId) => set((state) => ({
        optimisticDeletions: [...state.optimisticDeletions, eventId].slice(-100)
      })),
      addOptimisticApproval: (eventId) => set((state) => ({
        optimisticApprovals: [...state.optimisticApprovals, eventId].slice(-100)
      })),
      setRelays: (relays) => set({ relays: sanitizeRelayUrls(relays) }),
      setMediaServers: (mediaServers) => set({ mediaServers }),
      addMediaServer: (server) => set((state) => ({
        mediaServers: state.mediaServers.find(s => s.id === server.id || s.url === server.url)
          ? state.mediaServers
          : [...state.mediaServers, server]
      })),
      removeMediaServer: (id) => set((state) => ({
        mediaServers: state.mediaServers.filter(server => server.id !== id)
      })),
      setConnected: (connected) => set({ isConnected: connected }),
      setUser: (pubkey) => set((state) => ({ user: { ...state.user, pubkey } })),
      setProfile: (profile) => set((state) => ({ user: { ...state.user, profile } })),
      setLoginMethod: (method) => set({ loginMethod: method }),
      setRemoteSigner: (signer) => set({ remoteSigner: signer }),
      setNwcUrl: (url) => set({ nwcUrl: url }),
      setBridgeUrl: (url) => set({ bridgeUrl: url }),
      setAdministeredStations: (administeredStations) => set({ administeredStations }),
      markAsRead: (aTag) => set((state) => ({
        lastRead: { ...state.lastRead, [aTag]: Math.floor(Date.now() / 1000) }
      })),
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
        remoteSigner: { pubkey: null, relays: [], secret: null },
        lastRead: {},
        nwcUrl: null,
        administeredStations: []
      }),
    }),
    {
      name: 'asknostr-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user, 
        relays: state.relays, 
        mediaServers: state.mediaServers,
        loginMethod: state.loginMethod,
        lastRead: state.lastRead,
        nwcUrl: state.nwcUrl,
        bridgeUrl: state.bridgeUrl,
        administeredStations: state.administeredStations,
        remoteSigner: {
          pubkey: state.remoteSigner.pubkey,
          relays: state.remoteSigner.relays,
          secret: null
        }
      }),
    }
  )
)
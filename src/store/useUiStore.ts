import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ViewType = 'feed' | 'thread' | 'relays' | 'mediaservers' | 'errorlog' | 'profile' | 'profile-view' | 'communities' | 'community' | 'modqueue' | 'modlog' | 'createcommunity' | 'communityadmin' | 'search' | 'claimstation' | 'sidebar' | 'connectbunker' | 'wallet'

export interface Layer {
  id: string
  type: ViewType
  title: string
  params?: Record<string, unknown>
}

export interface LightboxState {
  isOpen: boolean
  media: { url: string; type: 'image' | 'video' }[]
  index: number
}

interface UiState {
  theme: 'terminal' | 'modern' | 'light'
  layout: 'classic' | 'swipe'
  stack: Layer[]
  lightbox: LightboxState
  setTheme: (theme: 'terminal' | 'modern' | 'light') => void
  setLayout: (layout: 'classic' | 'swipe') => void
  pushLayer: (layer: Layer) => void
  popLayer: () => void
  resetStack: (layer: Layer) => void
  clearStack: () => void
  openLightbox: (media: { url: string; type: 'image' | 'video' }[], index?: number) => void
  closeLightbox: () => void
  setLightboxIndex: (index: number) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'terminal',
      layout: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'classic' : 'swipe',
      // Start with Global Feed as the default active layer
      stack: [{ id: 'root-feed', type: 'feed', title: 'Global_Feed' }],
      lightbox: { isOpen: false, media: [], index: 0 },
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      pushLayer: (layer) => set((state) => ({ stack: [...state.stack, layer] })),
      popLayer: () => set((state) => ({ 
        // Allow stack to go empty so implicit Sidebar becomes the only layer visible
        stack: state.stack.slice(0, -1) 
      })),
      resetStack: (layer) => set({ stack: [layer] }),
      clearStack: () => set({ stack: [] }),
      openLightbox: (media, index = 0) => set({ lightbox: { isOpen: true, media, index } }),
      closeLightbox: () => set((state) => ({ lightbox: { ...state.lightbox, isOpen: false } })),
      setLightboxIndex: (index) => set((state) => ({ lightbox: { ...state.lightbox, index } })),
    }),
    {
      name: 'asknostr-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        theme: state.theme, 
        layout: state.layout 
      }),
    }
  )
)

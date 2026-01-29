import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ViewType = 'feed' | 'thread' | 'relays' | 'mediaservers' | 'errorlog' | 'profile' | 'profile-view' | 'communities' | 'community' | 'modqueue' | 'modlog' | 'createcommunity' | 'communityadmin' | 'search' | 'claimstation' | 'sidebar' | 'connectbunker' | 'wallet'

export interface Layer {
  id: string
  type: ViewType
  title: string
  params?: Record<string, unknown>
}

interface UiState {
  theme: 'terminal' | 'modern' | 'light'
  layout: 'classic' | 'swipe'
  stack: Layer[]
  setTheme: (theme: 'terminal' | 'modern' | 'light') => void
  setLayout: (layout: 'classic' | 'swipe') => void
  pushLayer: (layer: Layer) => void
  popLayer: () => void
  resetStack: (layer: Layer) => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'terminal',
      layout: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'classic' : 'swipe',
      // Start with Global Feed as the default active layer
      stack: [{ id: 'root-feed', type: 'feed', title: 'Global_Feed' }],
      setTheme: (theme) => set({ theme }),
      setLayout: (layout) => set({ layout }),
      pushLayer: (layer) => set((state) => ({ stack: [...state.stack, layer] })),
      popLayer: () => set((state) => ({ 
        // Allow stack to go empty so implicit Sidebar becomes the only layer visible
        stack: state.stack.slice(0, -1) 
      })),
      resetStack: (layer) => set({ stack: [layer] }),
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

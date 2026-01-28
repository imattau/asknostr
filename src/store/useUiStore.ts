import { create } from 'zustand'

export type ViewType = 'feed' | 'thread' | 'relays' | 'mediaservers' | 'errorlog' | 'profile' | 'communities' | 'community' | 'modqueue' | 'modlog' | 'createcommunity' | 'communityadmin' | 'search' | 'claimstation' | 'sidebar' | 'connectbunker'

export interface Layer {
  id: string
  type: ViewType
  title: string
  params?: Record<string, unknown>
}

interface UiState {
  theme: 'terminal' | 'modern'
  layout: 'classic' | 'swipe'
  stack: Layer[]
  setTheme: (theme: 'terminal' | 'modern') => void
  setLayout: (layout: 'classic' | 'swipe') => void
  pushLayer: (layer: Layer) => void
  popLayer: () => void
  resetStack: (layer: Layer) => void
}

export const useUiStore = create<UiState>((set) => ({
  theme: 'terminal',
  layout: 'swipe',
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
}))

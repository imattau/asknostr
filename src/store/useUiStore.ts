import { create } from 'zustand'

export type ViewType = 'feed' | 'thread' | 'relays' | 'profile' | 'communities' | 'community' | 'modqueue' | 'modlog'

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
  stack: [{ id: 'root', type: 'communities', title: 'Communities' }],
  setTheme: (theme) => set({ theme }),
  setLayout: (layout) => set({ layout }),
  pushLayer: (layer) => set((state) => ({ 
    stack: [...state.stack, layer] 
  })),
  popLayer: () => set((state) => ({ 
    stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack 
  })),
  resetStack: (layer) => set({ stack: [layer] }),
}))

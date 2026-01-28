import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../store/useUiStore'
import type { Layer } from '../store/useUiStore'
import { Sidebar } from './Sidebar'
import { triggerHaptic } from '../utils/haptics'

interface SwipeStackProps {
  renderLayer: (layer: Layer) => React.ReactNode
}

export const SwipeStack: React.FC<SwipeStackProps> = ({ renderLayer }) => {
  const { stack, popLayer } = useUiStore()

  // Full stack including the implicit Sidebar at index 0
  const fullStack = React.useMemo(() => [
    { id: 'system-sidebar', type: 'sidebar' as const, title: 'System_Control' },
    ...stack
  ], [stack])

  // Desktop Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && stack.length > 0) {
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) return
        popLayer()
        triggerHaptic(10)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [stack.length, popLayer])
  
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <AnimatePresence mode="popLayout" initial={false}>
        {fullStack.map((layer, index) => {
          const isTop = index === fullStack.length - 1
          const isUnder = index === fullStack.length - 2
          
          return (
            <motion.div
              key={layer.id}
              initial={index === 0 ? false : { x: '100%' }}
              animate={{ 
                x: isTop ? 0 : isUnder ? '-20%' : '-100%',
                scale: isTop ? 1 : 0.95,
                opacity: isTop ? 1 : 0.5,
                zIndex: index
              }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              drag={isTop && index > 0 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) {
                  popLayer()
                  triggerHaptic(30)
                }
              }}
              className="absolute inset-0 bg-[#05070A] shadow-2xl overflow-hidden flex flex-col"
            >
              <header className="h-14 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md flex items-center px-4 gap-4 shrink-0">
                {index > 0 && (
                  <button 
                    onClick={popLayer}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-tighter transition-colors"
                  >
                    [BACK]
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className="text-[10px] font-black uppercase tracking-[0.2em] truncate text-slate-400">
                    {layer.title}
                  </h2>
                </div>
                <div className="text-[8px] font-mono opacity-30 uppercase">
                  L:{index}
                </div>
              </header>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {layer.type === 'sidebar' ? <Sidebar /> : renderLayer(layer)}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '../store/useUiStore'
import type { Layer } from '../store/useUiStore'
import { ChevronLeft, MoreHorizontal } from 'lucide-react'

interface SwipeStackProps {
  renderLayer: (layer: Layer) => React.ReactNode
}

export const SwipeStack: React.FC<SwipeStackProps> = ({ renderLayer }) => {
  const { stack, popLayer } = useUiStore()
  
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05070A]">
      {/* Peeking Header Scaffolding (scrolled-under hint) */}
      <div className="absolute top-0 left-0 w-full h-14 border-b border-slate-800 bg-slate-950/50 flex items-center px-6 z-0">
        {stack.length > 1 && (
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest overflow-hidden">
            <span className="truncate max-w-[150px]">{stack[stack.length - 2].title}</span>
            <span className="text-purple-500">/</span>
            <MoreHorizontal size={12} className="animate-pulse" />
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {stack.map((layer, index) => {
          const isTop = index === stack.length - 1
          const isUnder = index === stack.length - 2
          
          return (
            <motion.div
              key={layer.id}
              initial={{ x: '100%' }}
              animate={{ 
                x: isTop ? 0 : isUnder ? '-25%' : '-100%',
                scale: isTop ? 1 : isUnder ? 0.96 : 0.9,
                opacity: isTop ? 1 : isUnder ? 0.3 : 0,
                filter: isTop ? 'blur(0px)' : 'blur(4px)'
              }}
              exit={{ x: '100%', transition: { type: 'spring', damping: 30, stiffness: 350 } }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              drag={index > 0 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(_, info) => {
                if (info.offset.x > 70) {
                  popLayer()
                }
              }}
              className={`absolute inset-0 w-full h-full bg-[#05070A] flex flex-col ${index > 0 ? 'shadow-[-20px_0_50px_rgba(0,0,0,0.5)] layer-border' : ''}`}
              style={{ zIndex: index + 1 }}
            >
              {/* Modern Layer Header */}
              <div className="flex items-center gap-4 p-4 h-16 border-b border-slate-800 bg-slate-950 shrink-0 relative overflow-hidden">
                {/* Decorative accent for active layer */}
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-purple-500 to-magenta-500 opacity-50" />
                
                {index > 0 ? (
                  <button onClick={popLayer} className="p-2 -ml-2 hover:bg-white/5 text-purple-500 rounded-lg transition-all active:scale-95">
                    <ChevronLeft size={24} />
                  </button>
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-magenta-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                    <span className="font-mono font-bold">A</span>
                  </div>
                )}
                
                <div className="flex flex-col min-w-0">
                  {index > 0 && (
                    <span className="text-[9px] uppercase font-mono font-bold text-slate-500 leading-none mb-1 tracking-tighter truncate">
                      root://{stack[index - 1].title.toLowerCase()}
                    </span>
                  )}
                  <h2 className="text-base font-bold text-slate-50 leading-none truncate tracking-tight">
                    {layer.title}
                  </h2>
                </div>
              </div>
              
              {/* Content with subtle grid background */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#05070A] relative">
                <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                {renderLayer(layer)}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
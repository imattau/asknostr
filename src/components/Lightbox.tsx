import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronLeft, ChevronRight, Download, ExternalLink } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'

export const Lightbox: React.FC = () => {
  const { lightbox, closeLightbox, setLightboxIndex } = useUiStore()
  const { isOpen, media, index } = lightbox

  const currentMedia = media[index]

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (index > 0) {
      setLightboxIndex(index - 1)
    }
  }, [index, setLightboxIndex])

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (index < media.length - 1) {
      setLightboxIndex(index + 1)
    }
  }, [index, media.length, setLightboxIndex])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, closeLightbox, handlePrev, handleNext])

  if (!isOpen || !currentMedia) return null

  return createPortal(
    <div 
      className="fixed inset-0 z-[100000] bg-black/95 flex flex-col items-center justify-center animate-in fade-in duration-200"
      onClick={closeLightbox}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent">
        <div className="text-[10px] font-mono text-white/50 uppercase tracking-widest">
          {index + 1} / {media.length}
        </div>
        <div className="flex items-center gap-4">
          <a 
            href={currentMedia.url} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 text-white/70 hover:text-white transition-colors"
            title="Open Original"
          >
            <ExternalLink size={20} />
          </a>
          <button 
            onClick={closeLightbox}
            className="p-2 text-white/70 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative w-full h-full flex items-center justify-center p-4">
        {media.length > 1 && index > 0 && (
          <button 
            onClick={handlePrev}
            className="absolute left-4 p-4 text-white/50 hover:text-white transition-colors z-10"
          >
            <ChevronLeft size={48} />
          </button>
        )}

        <div 
          className="relative max-w-full max-h-full flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {currentMedia.type === 'video' ? (
            <video 
              src={currentMedia.url} 
              controls 
              autoPlay 
              className="max-w-full max-h-[90vh] shadow-2xl"
            />
          ) : (
            <img 
              src={currentMedia.url} 
              alt="" 
              className="max-w-full max-h-[90vh] object-contain shadow-2xl animate-in zoom-in-95 duration-300"
            />
          )}
        </div>

        {media.length > 1 && index < media.length - 1 && (
          <button 
            onClick={handleNext}
            className="absolute right-4 p-4 text-white/50 hover:text-white transition-colors z-10"
          >
            <ChevronRight size={48} />
          </button>
        )}
      </div>

      {/* Footer / Info (Optional) */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex justify-center bg-gradient-to-t from-black/50 to-transparent">
         <p className="text-[9px] font-mono text-white/30 truncate max-w-md">
           {currentMedia.url}
         </p>
      </div>
    </div>,
    document.body
  )
}

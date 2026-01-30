import React, { useEffect, useState, useRef } from 'react'
import { torrentService } from '../services/torrentService'
import { Loader2, Share2, Users, Download, AlertCircle } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import type { TorrentState } from '../services/torrent/workerBridge'
import { useHeightObserver } from '../hooks/useHeightObserver'

interface TorrentMediaProps {
  magnetUri: string
  fallbackUrl?: string
  onHeightChange?: (height: number) => void
}

export const TorrentMedia: React.FC<TorrentMediaProps> = ({ magnetUri, fallbackUrl, onHeightChange }) => {
  const [torrentState, setTorrentState] = useState<TorrentState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [useFallback, setUseFallback] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const containerRef = useHeightObserver(onHeightChange)
  const { theme } = useUiStore()

  const infoHashMatch = magnetUri.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
  const infoHash = infoHashMatch ? infoHashMatch[1].toLowerCase() : null

  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const bgMuted = theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setInterval>
    
    // The 5-Second Rule: Fallback to HTTP if swarm is cold
    const fallbackTimer = setTimeout(() => {
      if (mounted && (!torrentState || torrentState.numPeers === 0) && !isReady && fallbackUrl) {
        console.log('[TorrentMedia] Swarm cold after 5s, falling back to HTTP...')
        setUseFallback(true)
      }
    }, 5000)

    const initTorrent = async () => {
      try {
        await torrentService.addTorrent(magnetUri)
        if (infoHash) {
          torrentService.prioritizeInitialChunks(infoHash)
        }

        interval = setInterval(() => {
          if (!mounted) return
          const state = torrentService.getActiveTorrents().find(t => t.infoHash.toLowerCase() === infoHash)
          if (state) {
            setTorrentState({ ...state })
            if (state.isReady) setIsReady(true)
            if (state.numPeers > 0) setUseFallback(false)
          }
        }, 2000)
      } catch (err) {
        console.error('[TorrentMedia] Failed to add torrent:', err)
        if (mounted && !fallbackUrl) setError('Failed to join swarm')
        else if (mounted) setUseFallback(true)
      }
    }

    initTorrent()

    return () => {
      mounted = false
      clearInterval(interval)
      clearTimeout(fallbackTimer)
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [magnetUri, fallbackUrl, infoHash])

  // For now, if we have a fallback URL and it's a video/audio, we'll use it for better streaming performance
  // while the worker seeds in the background.
  if ((useFallback || !isReady) && fallbackUrl) {
    const isVideo = fallbackUrl.match(/\.(mp4|webm|mov)$/i)
    const isAudio = fallbackUrl.match(/\.(mp3|wav|ogg)$/i)

    return (
      <div className={`rounded-xl border ${borderClass} overflow-hidden ${bgMuted} relative`}>
        {isVideo ? (
          <video src={fallbackUrl} controls className="max-h-[500px] w-full object-contain" />
        ) : isAudio ? (
          <audio src={fallbackUrl} controls className="w-full p-4" />
        ) : (
          <img src={fallbackUrl} alt="Media" className="max-h-[500px] w-full object-contain" />
        )}
        <div className="absolute top-2 right-2 flex gap-2">
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-amber-400 border border-amber-500/30 flex items-center gap-1">
            {isReady ? 'HYBRID_MODE_ACTIVE' : 'HTTP_FALLBACK_ACTIVE'}
          </div>
        </div>
      </div>
    )
  }

  if (error && !fallbackUrl) {
    return (
      <div className={`p-4 rounded-xl border ${borderClass} ${bgMuted} flex items-center gap-3 text-red-500`}>
        <AlertCircle size={20} />
        <span className="font-mono text-xs uppercase">Swarm_Error: {error}</span>
      </div>
    )
  }

  return (
    <div ref={containerRef} className={`rounded-xl border ${borderClass} overflow-hidden ${bgMuted} group relative`}>
      {!isReady && (
        <div className="p-8 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <div className="text-center">
            <p className={`text-[10px] font-mono uppercase tracking-widest ${mutedText}`}>Synchronizing_Swarm...</p>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-500">
                <Users size={12} /> {torrentState?.numPeers || 0} PEERS
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                <Download size={12} /> {((torrentState?.progress || 0) * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {isReady && !useFallback && (
        <div className="p-12 flex flex-col items-center justify-center space-y-4">
           <Share2 size={48} className="text-purple-500 opacity-50" />
           <p className="text-[10px] font-mono uppercase tracking-widest opacity-50">
             Stream_Available_Via_Worker
           </p>
           <p className="text-[8px] opacity-30 text-center max-w-[200px]">
             Direct P2P rendering is currently being optimized for the worker bridge.
           </p>
        </div>
      )}

      {isReady && !useFallback && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <Share2 size={10} /> P2P_ACTIVE
          </div>
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
            <Users size={10} /> {torrentState?.numPeers || 0}
          </div>
        </div>
      )}
    </div>
  )
}
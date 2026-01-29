import React, { useEffect, useState, useRef } from 'react'
import { torrentService } from '../services/torrentService'
import WebTorrent from 'webtorrent'
import { Loader2, Share2, Users, Download, AlertCircle } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'

interface TorrentMediaProps {
  magnetUri: string
  fallbackUrl?: string
}

export const TorrentMedia: React.FC<TorrentMediaProps> = ({ magnetUri, fallbackUrl }) => {
  const [torrent, setTorrent] = useState<WebTorrent.Torrent | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReady, setIsRevealed] = useState(false)
  const [progress, setProgress] = useState(0)
  const [numPeers, setNumPeers] = useState(0)
  const [useFallback, setUseFallback] = useState(false)
  const mediaRef = useRef<HTMLDivElement>(null)
  const { theme } = useUiStore()

  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const bgMuted = theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'

  useEffect(() => {
    let mounted = true
    let interval: ReturnType<typeof setTimeout>
    
    // The 5-Second Rule: Fallback to HTTP if swarm is cold
    const fallbackTimer = setTimeout(() => {
      if (mounted && numPeers === 0 && !isReady && fallbackUrl) {
        console.log('[TorrentMedia] Swarm cold after 5s, falling back to HTTP...')
        setUseFallback(true)
      }
    }, 5000)

    const initTorrent = async () => {
      try {
        const t = await torrentService.addTorrent(magnetUri)
        if (!mounted) return
        setTorrent(t)

        t.on('ready', () => {
          console.log('[TorrentMedia] Torrent ready:', t.name)
          if (mounted) {
            setIsRevealed(true)
            setUseFallback(false) // Found peers or data, cancel fallback if it happened to trigger
          }
        })

        t.on('error', (err) => {
          console.error('[TorrentMedia] Torrent error:', err)
          if (mounted) setError(typeof err === 'string' ? err : err.message)
        })

        interval = setInterval(() => {
          if (mounted && t) {
            setProgress(t.progress)
            setNumPeers(t.numPeers)
            if (t.numPeers > 0) setUseFallback(false)
          }
        }, 1000)

        // If it's already ready (e.g. from service cache)
        if (t.ready && mounted) {
          setIsRevealed(true)
        }
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
    }
  }, [magnetUri, fallbackUrl])

  useEffect(() => {
    if (isReady && torrent && mediaRef.current && !useFallback) {
      const file = torrent.files.find(f => 
        f.name.match(/\.(mp4|webm|mov|png|jpg|jpeg|gif|webp|mp3|wav|ogg)$/i)
      ) || torrent.files[0]

      if (file && mediaRef.current.childNodes.length === 0) {
        // Use appendTo for general element creation within the div
        file.appendTo(mediaRef.current, (err, elem) => {
          if (err) console.error('[TorrentMedia] Render error:', err)
          if (elem) {
            elem.className = 'max-h-[500px] w-full object-contain'
            if (elem.tagName === 'VIDEO' || elem.tagName === 'AUDIO') {
              (elem as HTMLMediaElement).controls = true
            }
          }
        })
      }
    }
  }, [isReady, torrent, useFallback])

  if (useFallback && fallbackUrl) {
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
            HTTP_FALLBACK_ACTIVE
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
    <div className={`rounded-xl border ${borderClass} overflow-hidden ${bgMuted} group relative`}>
      {!isReady && (
        <div className="p-8 flex flex-col items-center justify-center space-y-4">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <div className="text-center">
            <p className={`text-[10px] font-mono uppercase tracking-widest ${mutedText}`}>Synchronizing_Swarm...</p>
            <div className="flex items-center gap-4 mt-2 justify-center">
              <span className="flex items-center gap-1 text-[9px] font-bold text-cyan-500">
                <Users size={12} /> {numPeers} PEERS
              </span>
              <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-500">
                <Download size={12} /> {(progress * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      <div ref={mediaRef} className={(isReady && !useFallback) ? 'block' : 'hidden'} />

      {isReady && !useFallback && (
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-purple-400 border border-purple-500/30 flex items-center gap-1">
            <Share2 size={10} /> P2P_STREAM
          </div>
          <div className="bg-black/60 backdrop-blur-md px-2 py-1 rounded text-[8px] font-mono text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
            <Users size={10} /> {numPeers}
          </div>
        </div>
      )}
    </div>
  )
}

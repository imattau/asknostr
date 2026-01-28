import React, { useMemo, useState } from 'react'
import { Server, Plus, Trash2, ShieldAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { MediaServerType } from '../store/useStore'
import { triggerHaptic } from '../utils/haptics'

const typeLabels: Record<MediaServerType, string> = {
  blossom: 'BLOSSOM',
  generic: 'GENERIC'
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    const url = new URL(trimmed)
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export const MediaServers: React.FC = () => {
  const { mediaServers, addMediaServer, removeMediaServer } = useStore()
  const [url, setUrl] = useState('')
  const [type, setType] = useState<MediaServerType>('blossom')
  const [error, setError] = useState<string | null>(null)

  const hasServers = mediaServers.length > 0
  const normalizedUrl = useMemo(() => normalizeUrl(url), [url])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const nextUrl = normalizeUrl(url)
    if (!nextUrl) {
      setError('Invalid URL. Include https://')
      return
    }
    addMediaServer({
      id: `${type}-${Date.now()}`,
      url: nextUrl,
      type
    })
    setUrl('')
    triggerHaptic(20)
  }

  return (
    <div className="p-6 space-y-6 pb-20">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-50 uppercase flex items-center gap-2">
            <Server size={24} className="text-emerald-500" /> Media_Servers
          </h2>
          <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase">
            {hasServers ? `Configured Endpoints [${mediaServers.length}]` : 'No Servers Configured'}
          </p>
        </div>
      </header>

      <form onSubmit={handleAdd} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-media-server.com"
            className="terminal-input rounded-xl px-4 py-3 text-xs font-mono"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MediaServerType)}
            className="terminal-input rounded-xl px-4 py-3 text-xs font-mono"
          >
            <option value="blossom">BLOSSOM</option>
            <option value="generic">GENERIC</option>
          </select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase text-red-400">
            <ShieldAlert size={12} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!normalizedUrl}
          className="terminal-button rounded-xl py-3 px-4 flex items-center gap-2 text-[10px] uppercase disabled:opacity-50"
        >
          <Plus size={14} /> Add_Server
        </button>
      </form>

      <div className="grid gap-4">
        {mediaServers.map((server) => (
          <div key={server.id} className="p-4 glassmorphism border-slate-800 rounded-xl flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-100 truncate">{server.url}</div>
              <div className="text-[9px] text-slate-500 font-mono uppercase">{typeLabels[server.type]}</div>
            </div>
            <button
              onClick={() => removeMediaServer(server.id)}
              className="p-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

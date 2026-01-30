import React, { useMemo, useState } from 'react'
import { Server, Plus, Trash2, ShieldAlert } from 'lucide-react'
import { useStore } from '../store/useStore'
import type { MediaServerType } from '../store/useStore'
import { triggerHaptic } from '../utils/haptics'
import { useUiStore } from '../store/useUiStore'

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
  const { mediaServers, addMediaServer, removeMediaServer, bridgeUrl, setBridgeUrl } = useStore()
  const { theme } = useUiStore()
  const [url, setUrl] = useState('')
  const [tempBridgeUrl, setTempBridgeUrl] = useState(bridgeUrl)
  const [type, setType] = useState<MediaServerType>('blossom')
  const [error, setError] = useState<string | null>(null)

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : ''

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

  const updateBridge = () => {
    setBridgeUrl(tempBridgeUrl)
    triggerHaptic(50)
    alert('BitTorrent Bridge Server updated.')
  }

  return (
    <div className={`p-6 space-y-10 pb-20 ${containerBg}`}>
      {/* Bridge Configuration */}
      <section className="space-y-4">
        <header className={`flex items-center justify-between border-b ${borderClass} pb-4`}>
          <div>
            <h2 className={`text-xl font-bold ${primaryText} uppercase flex items-center gap-2`}>
              <Server size={24} className="text-purple-500" /> Swarm_Bootstrap
            </h2>
            <p className={`text-[10px] ${mutedText} font-mono mt-1 uppercase`}>
              BitTorrent Bridge Orchestrator
            </p>
          </div>
        </header>
        
        <div className="flex gap-2">
          <input
            value={tempBridgeUrl}
            onChange={(e) => setTempBridgeUrl(e.target.value)}
            placeholder="Leave blank for same domain..."
            className="flex-1 terminal-input rounded-xl px-4 py-3 text-xs font-mono"
          />
          <button
            onClick={updateBridge}
            className="px-6 py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 font-bold uppercase text-[10px] hover:bg-purple-500/20 transition-all active:scale-95"
          >
            Update
          </button>
        </div>
        <p className={`text-[9px] ${mutedText} italic font-mono px-1`}>
          {tempBridgeUrl ? `Bootstrapping via ${tempBridgeUrl}` : 'Currently using the main app domain for bootstrap API calls.'}
        </p>
      </section>

      {/* Media Servers Section */}
      <section className="space-y-6">
        <header className={`flex items-center justify-between border-b ${borderClass} pb-4`}>
          <div>
            <h2 className={`text-xl font-bold ${primaryText} uppercase flex items-center gap-2`}>
              <Server size={24} className="text-emerald-500" /> Media_Servers
            </h2>
            <p className={`text-[10px] ${mutedText} font-mono mt-1 uppercase`}>
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
            <div key={server.id} className={`p-4 glassmorphism border ${borderClass} rounded-xl flex items-center justify-between gap-4`}>
              <div className="min-w-0">
                <div className={`text-xs font-mono ${theme === 'light' ? 'text-slate-700' : 'text-slate-100'} truncate`}>{server.url}</div>
                <div className={`text-[9px] ${mutedText} font-mono uppercase`}>{typeLabels[server.type]}</div>
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
      </section>
    </div>
  )
}
import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { DEFAULT_RELAYS, nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { Server, Wifi, WifiOff, RefreshCw, Plus, Trash2, Save, Info } from 'lucide-react'
import { useRelayInfo } from '../hooks/useRelayInfo'
import { useRelays } from '../hooks/useRelays'
import { useRelayConnection } from '../hooks/useRelayConnection'
import { triggerHaptic } from '../utils/haptics'
import { normalizeRelayUrl } from '../utils/nostr'
import { useUiStore } from '../store/useUiStore'

const RelayItem: React.FC<{ url: string, onRemove?: () => void }> = ({ url, onRemove }) => {
  const { data: info } = useRelayInfo(url)
  const { data: isConnected } = useRelayConnection(url)
  const { theme } = useUiStore()

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'

  return (
    <div className={`flex flex-col gap-2 p-4 glassmorphism ${borderClass} rounded-xl group hover:border-purple-500/30 transition-all`}>
      <div className="flex justify-between items-center">
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-mono text-sm ${primaryText} truncate`}>{url}</span>
          <span className={`text-[10px] ${mutedText} font-mono uppercase`}>
            {info?.software || 'Unknown'} {info?.version}
          </span>
        </div>
        <div className="flex items-center gap-3 ml-4">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-bold ${isConnected ? "text-green-500" : "text-red-500"}`}>
              {isConnected ? 'ACTIVE' : 'OFFLINE'}
            </span>
            {isConnected ? <Wifi size={14} className="text-green-500" /> : <WifiOff size={14} className="text-red-500" />}
          </div>
          {onRemove && (
            <button 
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className={`p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors`}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {info?.description && (
        <p className={`text-[11px] ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} font-sans line-clamp-2 italic opacity-70 group-hover:opacity-100 transition-opacity`}>
          "{info.description}"
        </p>
      )}
    </div>
  )
}

export const RelayList: React.FC = () => {
  const { user, setRelays: setStoreRelays } = useStore()
  const { data: userRelays, isLoading } = useRelays()
  const { theme } = useUiStore()
  
  const [localRelays, setLocalRelays] = useState<string[]>([])
  const [newRelay, setNewRelay] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'

  useEffect(() => {
    if (userRelays && userRelays.length > 0) {
      setLocalRelays(userRelays)
    } else {
      setLocalRelays(DEFAULT_RELAYS)
    }
  }, [userRelays])

  // ... (keep logic)

  const handleAdd = () => {
    const normalized = normalizeRelayUrl(newRelay)
    if (!normalized) {
      alert('Invalid relay URL. Must start with wss:// or ws://')
      return
    }
    if (localRelays.includes(normalized)) return
    
    setLocalRelays(prev => [...prev, normalized])
    setNewRelay('')
    setHasChanges(true)
    triggerHaptic(10)
  }

  const handleRemove = (url: string) => {
    setLocalRelays(prev => prev.filter(r => r !== url))
    setHasChanges(true)
    triggerHaptic(10)
  }

  const handleSave = async () => {
    if (!user.pubkey) {
      alert('Login required to save relay preferences to network.')
      return
    }

    setIsSaving(true)
    try {
      // 1. Create NIP-65 (Kind 10002) relay list event
      const eventTemplate = {
        kind: 10002,
        created_at: Math.floor(Date.now() / 1000),
        tags: localRelays.map(r => ['r', r]),
        content: '',
      }

      const signedEvent = await signerService.signEvent(eventTemplate)
      const success = await nostrService.publish(signedEvent)

      if (success) {
        // 2. Update app state
        nostrService.setRelays(localRelays)
        setStoreRelays(localRelays)
        setHasChanges(false)
        triggerHaptic(50)
        alert('Relay configuration successfully committed to the network.')
      } else {
        alert('Broadcast failed. Changes saved locally but may not persist across devices.')
      }
    } catch (e) {
      console.error('Failed to save relays', e)
      alert(e instanceof Error ? e.message : 'Failed to save configuration.')
    } finally {
      setIsSaving(false)
    }
  }

  const isUsingDefault = !user.pubkey || !userRelays || userRelays.length === 0

  return (
    <div className={`p-6 space-y-6 pb-20 ${theme === 'light' ? 'bg-slate-50' : ''}`}>
      <header className={`flex items-center justify-between border-b ${borderClass} pb-4`}>
        <div>
          <h2 className={`text-xl font-bold ${primaryText} uppercase flex items-center gap-2`}>
            <Server size={24} className="text-cyan-500" /> Node_Network_Map
          </h2>
          <p className={`text-[10px] ${mutedText} font-mono mt-1 uppercase`}>
            {isUsingDefault ? 'Public Discovery Infrastructure' : `Personalized Identity Nodes [${localRelays.length}]`}
          </p>
        </div>
        {isLoading && <RefreshCw size={16} className="animate-spin text-cyan-500" />}
      </header>

      {user.pubkey && (
        <section className="space-y-4">
          <div className="flex gap-2">
            <input 
              value={newRelay}
              onChange={(e) => setNewRelay(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="wss://new-relay.com"
              className="flex-1 terminal-input rounded-xl px-4"
            />
            <button 
              onClick={handleAdd}
              className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all active:scale-95"
            >
              <Plus size={18} />
            </button>
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full terminal-button rounded-xl py-3 flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
            >
              {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'SYNCHRONIZING...' : 'COMMIT_CONFIGURATION'}
            </button>
          )}
        </section>
      )}

      <div className="grid gap-4">
        {localRelays.map((url: string) => (
          <RelayItem 
            key={url} 
            url={url} 
            onRemove={user.pubkey ? () => handleRemove(url) : undefined} 
          />
        ))}
      </div>

      <div className={`mt-8 p-4 glassmorphism border-amber-500/20 rounded-xl text-[10px] uppercase font-mono ${mutedText} leading-relaxed`}>
        <div className="flex items-center gap-2 text-amber-400 font-bold mb-2">
          <Info size={14} /> SYSTEM_PROTOCOL_ADVISORY
        </div>
        <p>Configuring custom nodes (NIP-65) ensures your identity and subscriptions remain accessible across all compatible clients. Uncommitted changes will only persist in this session.</p>
      </div>
    </div>
  )
}
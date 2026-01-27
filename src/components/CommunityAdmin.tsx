import React, { useState } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { Shield, X, Globe, Save, RefreshCw } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import { formatPubkey, shortenPubkey } from '../utils/nostr'

interface CommunityAdminProps {
  communityId: string
  creator: string
}

export const CommunityAdmin: React.FC<CommunityAdminProps> = ({ communityId, creator }) => {
  const { data: community, isLoading } = useCommunity(communityId, creator)
  const { user } = useStore()
  const { popLayer } = useUiStore()
  
  const [newMod, setNewMod] = useState('')
  const [mods, setMods] = useState<string[]>([])
  const [relays, setRelays] = useState<string>('')
  const [isSaving, setIsSubmitting] = useState(false)

  // Initialize state when data loads
  React.useEffect(() => {
    if (community) {
      setMods(community.moderators)
      setRelays(community.relays.join(', '))
    }
  }, [community])

  if (isLoading) return <div className="p-8 text-center animate-pulse opacity-50">[LOADING_ADMIN_DATA...]</div>
  if (user.pubkey !== creator) return <div className="p-8 text-center text-red-500">[ACCESS_DENIED: UNAUTHORIZED_ENTITY]</div>

  const addMod = () => {
    if (newMod && !mods.includes(newMod)) {
      setMods([...mods, newMod])
      setNewMod('')
      triggerHaptic(10)
    }
  }

  const removeMod = (pubkey: string) => {
    setMods(mods.filter(m => m !== pubkey))
    triggerHaptic(10)
  }

  const handleSave = async () => {
    if (!window.nostr || !community) return
    setIsSubmitting(true)
    try {
      const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://'))
      
      const eventTemplate = {
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', communityId],
          ['name', community.name || ''],
          ['description', community.description || ''],
          ...(community.rules ? [['rules', community.rules]] : []),
          ...(community.image ? [['image', community.image]] : []),
          ...relayList.map(r => ['relay', r]),
          ...mods.map(m => ['p', m]),
          ...community.pinned.map(e => ['e', e])
        ],
        content: '',
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      triggerHaptic(50)
      alert('Community parameters synchronized.')
      popLayer()
    } catch (e) {
      console.error('Update failed', e)
      alert('Failed to update community definition.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="p-6 space-y-8">
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30">
        <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2">
          <Shield size={24} /> Station_Administration: c/{communityId}
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1">
          Modifying community nodes and moderator authorizations
        </p>
      </header>

      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase opacity-50 flex items-center gap-2">
          <Shield size={14} /> Authorized_Moderators
        </h3>
        
        <div className="space-y-2">
          {mods.map(m => (
            <div key={m} className="flex justify-between items-center glassmorphism p-2 rounded-lg border-slate-800">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-50">{shortenPubkey(formatPubkey(m))}</span>
                <span className="text-[8px] text-slate-500 font-mono">{m.slice(0, 32)}...</span>
              </div>
              {m !== creator && (
                <button onClick={() => removeMod(m)} className="p-1 hover:bg-red-500/20 text-red-500 rounded-md transition-colors">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input 
            value={newMod}
            onChange={(e) => setNewMod(e.target.value)}
            placeholder="Mod Pubkey (hex)..."
            className="flex-1 terminal-input rounded-lg"
          />
          <button onClick={addMod} className="terminal-button rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30">
            Add_Mod
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-bold uppercase opacity-50 flex items-center gap-2">
          <Globe size={14} /> Preferred_Relays
        </h3>
        <textarea 
          value={relays}
          onChange={(e) => setRelays(e.target.value)}
          className="w-full terminal-input rounded-lg min-h-[60px]"
          placeholder="wss://relay1..., wss://relay2..."
        />
        <p className="text-[8px] text-slate-600 font-mono uppercase">Comma separated list of nodes prioritizing community discovery</p>
      </section>

      <div className="pt-4 border-t border-slate-800 flex justify-end gap-4">
        <button 
          type="button" 
          onClick={popLayer}
          className="px-6 py-2 text-slate-500 hover:text-slate-300 font-bold uppercase text-xs transition-colors"
        >
          Discard
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="terminal-button rounded-lg flex items-center gap-2"
        >
          {isSaving ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isSaving ? 'Synchronizing...' : 'Save_Parameters'}
        </button>
      </div>
    </div>
  )
}

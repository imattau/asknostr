import React, { useState } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { Shield, X, Globe, Save, RefreshCw, User as UserIcon, AlertTriangle } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import { formatPubkey, shortenPubkey } from '../utils/nostr'
import { set } from 'idb-keyval'

interface CommunityAdminProps {
  communityId: string
  creator: string
}

export const CommunityAdmin: React.FC<CommunityAdminProps> = ({ communityId, creator }) => {
  const { data: community, isLoading, refetch } = useCommunity(communityId, creator)
  const { user } = useStore()
  const { popLayer } = useUiStore()
  
  const [newMod, setNewMod] = useState('')
  const [mods, setMods] = useState<string[]>([])
  const [relays, setRelays] = useState<string>('')
  const [mode, setMode] = useState<'open' | 'restricted'>('open')
  const [isSaving, setIsSaving] = useState(false)
  const [isRescueMode, setIsRescueMode] = useState(false)

  React.useEffect(() => {
    if (community) {
      setMods(community.moderators)
      setRelays(community.relays.join(', '))
      setMode(community.moderationMode || 'open')
      setIsRescueMode(false)
    } else if (!isLoading && user.pubkey === creator) {
      // If we are the creator but metadata didn't load, enable rescue mode
      setIsRescueMode(true)
      setMods([creator])
    }
  }, [community, isLoading, creator, user.pubkey])

  if (isLoading) return (
    <div className="p-20 flex flex-col items-center justify-center space-y-4">
      <RefreshCw size={32} className="animate-spin text-cyan-500" />
      <span className="font-mono text-[10px] uppercase opacity-50">Retrieving_Admin_Metadata...</span>
    </div>
  )
  
  if (user.pubkey !== creator) return (
    <div className="p-12 text-center text-red-500 font-mono space-y-4">
      <Shield size={48} className="mx-auto opacity-20" />
      <p className="uppercase font-bold tracking-widest">[ACCESS_DENIED: UNAUTHORIZED_ENTITY]</p>
    </div>
  )

  const addMod = () => {
    if (newMod && !mods.includes(newMod)) {
      setMods([...mods, newMod])
      setNewMod('')
      triggerHaptic(10)
    }
  }

  const removeMod = (pubkey: string) => {
    if (pubkey === creator) return // Cannot remove yourself
    setMods(mods.filter(m => m !== pubkey))
    triggerHaptic(10)
  }

  const handleSave = async () => {
    setIsSaving(true)
    console.log('[Admin] Commit button clicked')
    
    try {
      const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://'))
      
      const eventTemplate = {
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', communityId],
          ['name', community?.name || communityId],
          ['description', community?.description || 'Community Node'],
          ...(community?.rules ? [['rules', community.rules]] : []),
          ...(community?.image ? [['image', community.image]] : []),
          ['moderation_mode', mode],
          ...relayList.map(r => ['relay', r]),
          ...mods.map(m => ['p', m]),
          ...(community?.pinned || []).map(e => ['e', e])
        ],
        content: '',
      }

      console.log('[Admin] Requesting signature...')
      const signedEvent = await signerService.signEvent(eventTemplate)
      
      console.log('[Admin] Publishing...')
      await nostrService.publish(signedEvent)
      
      // Update local store and persistent cache
      const { addEvent } = useStore.getState()
      addEvent(signedEvent)
      
      const updatedDefinition = {
        id: communityId,
        creator: creator,
        name: community?.name || communityId,
        description: community?.description || 'Community Node',
        rules: community?.rules,
        image: community?.image,
        moderators: mods,
        relays: relayList,
        pinned: community?.pinned || [],
        moderationMode: mode
      }
      await set(`community-${creator}-${communityId}`, updatedDefinition)

      // Invalidate queries
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qc = (window as any).queryClient
      if (qc) {
        qc.invalidateQueries({ queryKey: ['community', communityId, creator] })
        qc.invalidateQueries({ queryKey: ['my-communities'] })
      }

      triggerHaptic(50)
      alert('Station parameters successfully committed to network.')
      popLayer()
    } catch (e) {
      console.error('[Admin] Update failure:', e)
      alert(`Commit failed: ${e instanceof Error ? e.message : 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="p-6 space-y-8 pb-20">
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30">
        <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2 tracking-tighter">
          <Shield size={24} /> Station_Administration: c/{communityId}
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
          Modifying community nodes and moderator authorizations
        </p>
      </header>

      {isRescueMode && (
        <div className="p-4 border border-orange-500/30 bg-orange-500/5 rounded-xl flex items-start gap-3">
          <AlertTriangle className="text-orange-500 shrink-0" size={18} />
          <div>
            <h4 className="text-[10px] font-bold text-orange-500 uppercase font-mono">Rescue_Mode_Active</h4>
            <p className="text-[9px] text-slate-400 font-sans leading-relaxed">
              Network metadata failed to load. Proceeding with local authority data. Committing will overwrite previous network definitions.
            </p>
            <button 
              onClick={() => refetch()}
              className="mt-2 text-[8px] font-mono text-cyan-500 uppercase underline decoration-cyan-500/30 hover:text-cyan-400"
            >
              [RETRY_DEEP_SCAN]
            </button>
          </div>
        </div>
      )}

      <section className="space-y-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Shield size={14} /> Moderation_Protocol
        </h3>
        
        <div className="flex gap-4 p-1 bg-slate-900 rounded-xl border border-slate-800">
          <button
            onClick={() => setMode('open')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'open' ? 'bg-cyan-500 text-black shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Open_Access
          </button>
          <button
            onClick={() => setMode('restricted')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'restricted' ? 'bg-purple-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
          >
            Restricted_Approval
          </button>
        </div>
        
        <p className="text-[9px] text-slate-500 font-sans px-2">
          {mode === 'open' 
            ? "OPEN: All posts are visible by default. Moderators act on reports or spam." 
            : "RESTRICTED: New authors require manual approval for their first post to be visible."}
        </p>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <UserIcon size={14} /> Authorized_Moderators
        </h3>
        
        <div className="grid gap-2">
          {mods.map(m => (
            <div key={m} className="flex justify-between items-center glassmorphism p-3 rounded-xl border-slate-800 hover:border-white/10 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <UserIcon size={16} className="text-slate-600" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-100 uppercase tracking-tight truncate">{shortenPubkey(formatPubkey(m))}</span>
                  <span className="text-[8px] text-slate-500 font-mono truncate max-w-[120px]">{m}</span>
                </div>
              </div>
              {m !== creator && (
                <button onClick={() => removeMod(m)} className="p-2 hover:bg-red-500/10 text-red-500/50 hover:text-red-500 rounded-lg transition-all active:scale-95">
                  <X size={16} />
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
            className="flex-1 terminal-input rounded-xl px-4"
          />
          <button onClick={addMod} className="px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold uppercase text-[10px] hover:bg-cyan-500/20 transition-all active:scale-95">
            Authorize_Mod
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Globe size={14} /> Preferred_Relays
        </h3>
        <textarea 
          value={relays}
          onChange={(e) => setRelays(e.target.value)}
          className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-mono text-xs"
          placeholder="wss://relay1..., wss://relay2..."
        />
      </section>

      <div className="pt-6 border-t border-slate-800 flex justify-end gap-4">
        <button 
          type="button" 
          onClick={popLayer}
          className="px-6 py-2 text-slate-500 hover:text-slate-300 font-bold uppercase text-[10px] transition-colors font-mono"
        >
          Discard_Changes
        </button>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="terminal-button rounded-xl flex items-center gap-2 px-8 py-2.5 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-50"
        >
          {isSaving ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {isSaving ? 'Synchronizing...' : 'Commit_Parameters'}
        </button>
      </div>
    </div>
  )
}

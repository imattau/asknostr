import React, { useState, useRef } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { mediaService } from '../services/mediaService'
import { Shield, X, Globe, Save, RefreshCw, User as UserIcon, Image as ImageIcon, FileText, Type } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import { formatPubkey, shortenPubkey } from '../utils/nostr'
import { set } from 'idb-keyval'

interface CommunityAdminProps {
  communityId: string
  creator: string
}

export const CommunityAdmin: React.FC<CommunityAdminProps> = ({ communityId, creator }) => {
  const { data: community, isLoading } = useCommunity(communityId, creator)
  const { user } = useStore()
  const { popLayer } = useUiStore()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [rules, setRules] = useState('')
  const [image, setImage] = useState('')
  const [banner, setBanner] = useState('')
  const [newMod, setNewMod] = useState('')
  const [mods, setMods] = useState<string[]>([])
  const [relays, setRelays] = useState<string>('')
  const [mode, setMode] = useState<'open' | 'restricted'>('open')
  const [isSaving, setIsSaving] = useState(false)
  const [isUploading, setIsUploading] = useState<'image' | 'banner' | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)
  const bannerInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (community) {
      setName(community.name || '')
      setDescription(community.description || '')
      setRules(community.rules || '')
      setImage(community.image || '')
      setBanner(community.banner || '')
      setMods(community.moderators)
      setRelays(community.relays.join(', '))
      setMode(community.moderationMode || 'open')
    } else if (!isLoading && user.pubkey === creator) {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'image' | 'banner') => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(target)
    try {
      const url = await mediaService.uploadFile(file)
      if (target === 'image') setImage(url)
      else setBanner(url)
      triggerHaptic(20)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(null)
    }
  }

  const addMod = () => {
    if (newMod && !mods.includes(newMod)) {
      setMods([...mods, newMod])
      setNewMod('')
      triggerHaptic(10)
    }
  }

  const removeMod = (pubkey: string) => {
    if (pubkey === creator) return 
    setMods(mods.filter(m => m !== pubkey))
    triggerHaptic(10)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://'))
      
      const eventTemplate = {
        kind: 34550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', communityId],
          ['name', name || communityId],
          ['description', description],
          ['rules', rules],
          ['image', image],
          ['banner', banner],
          ['moderation_mode', mode],
          ...relayList.map(r => ['relay', r]),
          ...mods.map(m => ['p', m]),
          ...(community?.pinned || []).map(e => ['e', e])
        ],
        content: '',
      }

      const signedEvent = await signerService.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      
      const { addEvent } = useStore.getState()
      addEvent(signedEvent)
      
      const updatedDefinition = {
        id: communityId,
        creator: creator,
        name: name || communityId,
        description,
        rules,
        image,
        banner,
        moderators: mods,
        relays: relayList,
        pinned: community?.pinned || [],
        moderationMode: mode
      }
      await set(`community-${creator}-${communityId}`, updatedDefinition)

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
    <div className="p-6 space-y-8 pb-20 overflow-y-auto">
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30">
        <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2 tracking-tighter">
          <Shield size={24} /> Station_Administration: c/{communityId}
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
          Modifying community nodes and moderator authorizations
        </p>
      </header>

      {/* Visual Identity Section */}
      <section className="space-y-6">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <ImageIcon size={14} /> Visual_Identity
        </h3>

        <div className="grid gap-6">
          {/* Banner Upload */}
          <div className="space-y-3">
            <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block px-1">Node_Banner_Image</label>
            <div 
              className="relative h-24 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer group"
              onClick={() => bannerInputRef.current?.click()}
            >
              {banner ? (
                <img src={banner} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-700">
                  <ImageIcon size={32} />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploading === 'banner' ? <RefreshCw className="animate-spin text-cyan-500" /> : <span className="text-[8px] font-bold text-cyan-400 uppercase font-mono">Update_Banner</span>}
              </div>
              <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'banner')} />
            </div>
          </div>

          <div className="flex gap-6 items-center">
            {/* Avatar Upload */}
            <div className="space-y-2">
              <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block px-1">Node_Avatar</label>
              <div 
                className="w-16 h-16 rounded-full border border-slate-800 bg-slate-900 overflow-hidden cursor-pointer group relative flex-shrink-0"
                onClick={() => imageInputRef.current?.click()}
              >
                {image ? (
                  <img src={image} className="w-full h-full object-cover group-hover:opacity-30 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-700">
                    <UserIcon size={24} />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUploading === 'image' ? <RefreshCw className="animate-spin text-cyan-500" size={16} /> : <ImageIcon size={16} className="text-cyan-400" />}
                </div>
                <input type="file" ref={imageInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'image')} />
              </div>
            </div>

            {/* Station Name */}
            <div className="flex-1 space-y-2">
              <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block px-1 flex items-center gap-2">
                <Type size={10} /> Node_Designation
              </label>
              <input 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Station name..."
                className="w-full terminal-input rounded-xl px-4 py-3"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Manifest Section */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} /> Node_Manifest
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest px-1 block">Description_String</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-sans text-xs"
              placeholder="What is this station for?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-mono text-slate-500 uppercase tracking-widest px-1 block">Operational_Rules</label>
            <textarea 
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-sans text-xs"
              placeholder="Enter community guidelines..."
            />
          </div>
        </div>
      </section>

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

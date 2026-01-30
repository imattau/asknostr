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
import { useQueryClient } from '@tanstack/react-query'

interface CommunityAdminProps {
  communityId: string
  creator: string
}

export const CommunityAdmin: React.FC<CommunityAdminProps> = ({ communityId, creator }) => {
  const { data: community, isLoading, refetch } = useCommunity(communityId, creator)
  const { user } = useStore()
  const { popLayer, theme } = useUiStore()
  const queryClient = useQueryClient()

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : ''
  const bgMuted = theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'
  
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
      console.log('[Admin] Hydrating state from community data')
      setName(community.name || '')
      setDescription(community.description || '')
      setRules(community.rules || '')
      setImage(community.image || '')
      setBanner(community.banner || '')
      setMods(community.moderators)
      setRelays(community.relays.join(', '))
      setMode(community.moderationMode || 'open')
    } else if (!isLoading) {
      console.log('[Admin] No data found, initializing with creator as mod')
      setMods([creator])
    }
  }, [community, isLoading, creator])

  if (isLoading) return (
    <div className={`p-20 flex flex-col items-center justify-center space-y-4 ${containerBg}`}>
      <RefreshCw size={32} className="animate-spin text-cyan-500" />
      <span className={`font-mono text-[10px] uppercase ${mutedText}`}>Retrieving_Admin_Metadata...</span>
    </div>
  )
  
  if (user.pubkey !== creator) return (
    <div className={`p-12 text-center text-red-500 font-mono space-y-4 ${containerBg}`}>
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
      const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://') || r.startsWith('ws://'))
      
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

      queryClient.invalidateQueries({ queryKey: ['community', communityId, creator] })
      queryClient.invalidateQueries({ queryKey: ['my-communities'] })

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
    <div className={`p-6 space-y-8 pb-20 overflow-y-auto ${containerBg}`}>
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30 flex justify-between items-start">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2 tracking-tighter truncate">
            <Shield size={24} className="shrink-0" /> Station_Administration: c/{communityId}
          </h2>
          <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
            Modifying community nodes and moderator authorizations
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className={`p-2 rounded-lg border ${borderClass} ${mutedText} hover:text-cyan-400 transition-all`}
          title="Force Refresh Metadata"
        >
          <RefreshCw size={16} />
        </button>
      </header>

      {/* Visual Identity Section */}
      <section className="space-y-6">
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <ImageIcon size={14} /> Visual_Identity
        </h3>

        <div className="grid gap-6">
          {/* Banner Upload */}
          <div className="space-y-3">
            <label className={`text-[9px] font-mono ${mutedText} uppercase tracking-widest block px-1`}>Node_Banner_Image</label>
            <div 
              className={`relative h-24 rounded-xl border ${borderClass} ${bgMuted} overflow-hidden cursor-pointer group`}
              onClick={() => bannerInputRef.current?.click()}
            >
              {banner ? (
                <img src={banner} className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition-opacity" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'}`}>
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
              <label className={`text-[9px] font-mono ${mutedText} uppercase tracking-widest block px-1`}>Node_Avatar</label>
              <div 
                className={`w-16 h-16 rounded-full border ${borderClass} ${bgMuted} overflow-hidden cursor-pointer group relative flex-shrink-0`}
                onClick={() => imageInputRef.current?.click()}
              >
                {image ? (
                  <img src={image} className="w-full h-full object-cover group-hover:opacity-30 transition-opacity" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${theme === 'light' ? 'text-slate-300' : 'text-slate-700'}`}>
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
              <label className={`text-[9px] font-mono ${mutedText} uppercase tracking-widest block px-1 flex items-center gap-2`}>
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
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <FileText size={14} /> Node_Manifest
        </h3>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className={`text-[9px] font-mono ${mutedText} uppercase tracking-widest px-1 block`}>Description_String</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-sans text-xs"
              placeholder="What is this station for?"
            />
          </div>

          <div className="space-y-2">
            <label className={`text-[9px] font-mono ${mutedText} uppercase tracking-widest px-1 block`}>Operational_Rules</label>
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
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <Shield size={14} /> Moderation_Protocol
        </h3>
        
        <div className={`flex gap-4 p-1 ${bgMuted} rounded-xl border ${borderClass}`}>
          <button
            onClick={() => setMode('open')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'open' ? 'bg-cyan-500 text-black shadow-lg' : `${theme === 'light' ? 'text-slate-400' : 'text-slate-500'} hover:text-slate-300`}`}
          >
            Open_Access
          </button>
          <button
            onClick={() => setMode('restricted')}
            className={`flex-1 py-3 rounded-lg text-[10px] font-bold uppercase transition-all ${mode === 'restricted' ? 'bg-purple-500 text-white shadow-lg' : `${theme === 'light' ? 'text-slate-400' : 'text-slate-500'} hover:text-slate-300`}`}
          >
            Restricted_Approval
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <UserIcon size={14} /> Authorized_Moderators
        </h3>
        
        <div className="grid gap-2">
          {mods.map(m => (
            <div key={m} className={`flex justify-between items-center glassmorphism p-3 rounded-xl ${borderClass} hover:border-white/10 transition-colors group`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full ${bgMuted} border ${borderClass} flex items-center justify-center`}>
                  <UserIcon size={16} className={theme === 'light' ? 'text-slate-300' : 'text-slate-600'} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-bold ${primaryText} uppercase tracking-tight truncate`}>{shortenPubkey(formatPubkey(m))}</span>
                  <span className={`text-[8px] ${mutedText} font-mono truncate max-w-[120px]`}>{m}</span>
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
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <Globe size={14} /> Preferred_Relays
        </h3>
        <textarea 
          value={relays}
          onChange={(e) => setRelays(e.target.value)}
          className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-mono text-xs"
          placeholder="wss://relay1..., wss://relay2..."
        />
      </section>

      <div className={`pt-6 border-t ${borderClass} flex justify-end gap-4`}>
        <button 
          type="button" 
          onClick={popLayer}
          className={`px-6 py-2 ${mutedText} hover:text-slate-300 font-bold uppercase text-[10px] transition-colors font-mono`}
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

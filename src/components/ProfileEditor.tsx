import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useStore } from '../store/useStore'
import type { UserProfile } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { User, Save, RefreshCw, Image as ImageIcon, Globe, Hash, Zap } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import { useProfile } from '../hooks/useProfile'

const profileSchema = z.object({
  name: z.string().min(2, 'Name too short').optional().or(z.literal('')),
  display_name: z.string().optional().or(z.literal('')),
  about: z.string().optional().or(z.literal('')),
  picture: z.string().url('Invalid image URL').optional().or(z.literal('')),
  banner: z.string().url('Invalid banner URL').optional().or(z.literal('')),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  lud16: z.string().optional().or(z.literal('')),
  nip05: z.string().optional().or(z.literal('')),
})

type ProfileFormData = z.infer<typeof profileSchema>

export const ProfileEditor: React.FC = () => {
  const { user, setProfile } = useStore()
  const { popLayer } = useUiStore()
  const { data: currentProfile, isLoading: isProfileLoading, refetch } = useProfile(user.pubkey || '')

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    // Use values prop for reactivity - this fixes fields not loading
    values: {
      name: currentProfile?.name || '',
      display_name: currentProfile?.display_name || '',
      about: currentProfile?.about || '',
      picture: currentProfile?.picture || '',
      banner: currentProfile?.banner || '',
      website: currentProfile?.website || '',
      lud16: currentProfile?.lud16 || '',
      nip05: currentProfile?.nip05 || '',
    }
  })

  const watchPicture = watch('picture')
  const watchBanner = watch('banner')

  const onSubmit = async (data: ProfileFormData) => {
    if (!user.pubkey || !window.nostr) {
      alert('Identity signature required.')
      return
    }

    try {
      const now = Math.floor(Date.now() / 1000)
      const eventTemplate = {
        kind: 0,
        pubkey: user.pubkey,
        created_at: now,
        tags: [],
        content: JSON.stringify(data),
      }

      const signedEvent = await window.nostr.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      
      setProfile(data as UserProfile)
      
      triggerHaptic(50)
      alert('Identity synchronized with the relay network.')
      popLayer()
    } catch (e) {
      console.error('Profile update failed', e)
      alert('Failed to broadcast identity update.')
    }
  }

  if (!user.pubkey) {
    return <div className="p-8 text-center text-red-500 font-mono">[ERROR: NO_LOCAL_IDENTITY_DETECTED]</div>
  }

  return (
    <div className="p-6 space-y-8 pb-20">
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2 tracking-tighter">
            <User size={24} /> Identity_Config_Panel
          </h2>
          <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
            NIP-01 STATION: {user.pubkey.slice(0, 16)}...
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-cyan-400 transition-all"
          title="Force Network Sync"
        >
          <RefreshCw size={16} className={isProfileLoading ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Visual Identity Mockup */}
      <div className="relative glassmorphism rounded-2xl border-slate-800 overflow-hidden shadow-2xl">
        <div className="h-24 bg-slate-900 relative overflow-hidden">
          {watchBanner ? (
            <img src={watchBanner} alt="" className="w-full h-full object-cover opacity-50" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950 opacity-50" />
          )}
          <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#05070A] to-transparent" />
        </div>
        
        <div className="px-6 pb-6 relative">
          <div className="flex justify-between items-end -mt-8">
            <div className="w-20 h-20 rounded-full bg-[#05070A] p-1 border-2 border-slate-800 shadow-xl overflow-hidden">
              <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                {watchPicture ? (
                  <img src={watchPicture} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={32} className="text-slate-700" />
                )}
              </div>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/20 px-3 py-1 rounded-full text-[9px] font-bold text-cyan-400 uppercase tracking-widest font-mono">
              Identity_Preview
            </div>
          </div>
          
          <div className="mt-3">
            <h3 className="text-lg font-black text-slate-50 tracking-tight leading-none">
              {watch('display_name') || watch('name') || 'Unnamed_Entity'}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-1 italic">
              {watch('about') || 'Manifest data pending...'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Hash size={12} /> Global_Username (name)
            </label>
            <input 
              {...register('name')}
              placeholder="e.g. sato"
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
            {errors.name && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <User size={12} /> Display_Name
            </label>
            <input 
              {...register('display_name')}
              placeholder="e.g. Satoshi Nakamoto"
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <ImageIcon size={12} /> Avatar_URL (picture)
            </label>
            <input 
              {...register('picture')}
              placeholder="https://..."
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
            {errors.picture && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.picture.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <ImageIcon size={12} /> Banner_Image_URL
            </label>
            <input 
              {...register('banner')}
              placeholder="https://..."
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
            {errors.banner && <p className="text-red-500 text-[9px] font-mono uppercase">{errors.banner.message}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
            Identity_Manifest (About)
          </label>
          <textarea 
            {...register('about')}
            placeholder="Tell the network about yourself..."
            className="w-full terminal-input rounded-xl px-4 py-3 min-h-[100px] font-sans"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Globe size={12} /> Verified_Domain (NIP-05)
            </label>
            <input 
              {...register('nip05')}
              placeholder="user@domain.com"
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Zap size={12} /> Lightning_Address (LUD-16)
            </label>
            <input 
              {...register('lud16')}
              placeholder="user@getalby.com"
              className="w-full terminal-input rounded-xl px-4 py-2.5"
            />
          </div>
        </div>

        <div className="pt-6 border-t border-slate-800 flex justify-end gap-4">
          <button 
            type="button" 
            onClick={popLayer}
            className="px-6 py-2 text-slate-500 hover:text-slate-300 font-bold uppercase text-[10px] transition-colors font-mono"
          >
            Abort_Config
          </button>
          <button 
            type="submit" 
            disabled={isSubmitting}
            className="terminal-button rounded-xl flex items-center gap-2 px-8 py-3 shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Synchronize_Identity
          </button>
        </div>
      </form>
    </div>
  )
}
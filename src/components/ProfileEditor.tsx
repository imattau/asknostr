import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useStore } from '../store/useStore'
import type { UserProfile } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { User, Save, RefreshCw, Image as ImageIcon, Globe, Hash, Zap, CloudOff, Cloud } from 'lucide-react'
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
  const { popLayer, theme } = useUiStore()
  const { data: currentProfile, isFetching, isLoading, refetch } = useProfile(user.pubkey || '')

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]'

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
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
    if (!user.pubkey) {
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

      const signedEvent = await signerService.signEvent(eventTemplate)
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
    return <div className={`p-8 text-center text-red-500 font-mono ${containerBg}`}>[ERROR: NO_LOCAL_IDENTITY_DETECTED]</div>
  }

  return (
    <div className={`p-6 space-y-8 pb-20 ${containerBg}`}>
      <header className={`terminal-border p-4 bg-cyan-500/10 border-cyan-500/30 flex justify-between items-start`}>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2 tracking-tighter">
            <User size={24} /> Identity_Config_Panel
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] opacity-70 uppercase font-mono ${theme === 'light' ? 'text-slate-600' : ''}`}>STATION: {user.pubkey.slice(0, 16)}...</span>
            <div className={`flex items-center gap-1 text-[8px] font-bold px-1.5 rounded ${isFetching ? 'text-yellow-500 bg-yellow-500/10 animate-pulse' : 'text-green-500 bg-green-500/10'}`}>
              {isFetching ? <Cloud size={10} /> : <CloudOff size={10} />}
              {isFetching ? 'SYNCING_LATEST' : 'LOCAL_CACHE_LOADED'}
            </div>
          </div>
        </div>
        <button 
          type="button"
          onClick={() => refetch()}
          className={`p-2 ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} rounded-lg text-slate-500 hover:text-cyan-400 transition-all flex flex-col items-center gap-1`}
          title="Force Network Sync"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          <span className="text-[7px] uppercase font-bold">Rescan</span>
        </button>
      </header>

      {isLoading && !currentProfile ? (
        <div className="p-20 flex flex-col items-center justify-center space-y-4 font-mono text-cyan-500/50">
          <div className="w-16 h-16 border-2 border-dashed border-cyan-500 rounded-full animate-spin-slow" />
          <p className="text-[10px] animate-pulse uppercase tracking-widest">Searching_Global_Identity_Logs...</p>
        </div>
      ) : (
        <>
          <div className={`relative glassmorphism rounded-2xl ${borderClass} overflow-hidden shadow-2xl`}>
            <div className={`h-24 ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-900'} relative overflow-hidden`}>
              {watchBanner ? (
                <img src={watchBanner} alt="" className="w-full h-full object-cover opacity-50" />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-br ${theme === 'light' ? 'from-slate-200 to-slate-300' : 'from-slate-900 to-slate-950'} opacity-50`} />
              )}
              <div className={`absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t ${theme === 'light' ? 'from-slate-50' : 'from-[#05070A]'} to-transparent`} />
            </div>
            
            <div className="px-6 pb-6 relative">
              <div className="flex justify-between items-end -mt-8">
                <div className={`w-20 h-20 rounded-full ${theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]'} p-1 border-2 ${borderClass} shadow-xl overflow-hidden`}>
                  <div className={`w-full h-full rounded-full ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'} flex items-center justify-center overflow-hidden`}>
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
                <h3 className={`text-lg font-black ${primaryText} tracking-tight leading-none`}>
                  {watch('display_name') || watch('name') || 'Unnamed_Entity'}
                </h3>
                <p className={`text-xs ${mutedText} font-mono mt-1 italic`}>
                  {watch('about') || 'Manifest data pending...'}
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
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
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
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
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
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
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
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
              <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest`}>
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
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
                  <Globe size={12} /> Verified_Domain (NIP-05)
                </label>
                <input 
                  {...register('nip05')}
                  placeholder="user@domain.com"
                  className="w-full terminal-input rounded-xl px-4 py-2.5"
                />
              </div>

              <div className="space-y-2">
                <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
                  <Zap size={12} /> Lightning_Address (LUD-16)
                </label>
                <input 
                  {...register('lud16')}
                  placeholder="user@getalby.com"
                  className="w-full terminal-input rounded-xl px-4 py-2.5"
                />
              </div>
            </div>

            <div className={`pt-6 border-t ${borderClass} flex justify-end gap-4`}>
              <button 
                type="button" 
                onClick={popLayer}
                className={`px-6 py-2 ${mutedText} hover:text-slate-300 font-bold uppercase text-[10px] transition-colors font-mono`}
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
        </>
      )}
    </div>
  )
}

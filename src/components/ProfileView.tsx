import React from 'react'
import { ArrowLeft, Globe, Hash, Zap, User, UserPlus, UserMinus, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { useSocialGraph } from '../hooks/useSocialGraph'
import { zapService } from '../services/zapService'
import { useStore } from '../store/useStore'
import { shortenPubkey } from '../utils/nostr'
import { useUiStore } from '../store/useUiStore'
import { triggerHaptic } from '../utils/haptics'

interface ProfileViewProps {
  pubkey?: string
}

type DetailItem = {
  label: string
  value?: string
  type: 'link' | 'text'
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export const ProfileView: React.FC<ProfileViewProps> = ({ pubkey }) => {
  const { popLayer, theme } = useUiStore()
  const { user } = useStore()
  const { data: profile, isLoading } = useProfile(pubkey || '')
  const { following, muted, toggleFollow, toggleMute, isUpdating } = useSocialGraph()

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-slate-300'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]'

  if (!pubkey) {
    return (
      <div className={`p-8 text-center text-red-500 font-mono uppercase text-[10px] ${containerBg}`}>[MISSING_PUBLIC_KEY]</div>
    )
  }

  const isFollowing = following.includes(pubkey)
  const isMuted = muted.includes(pubkey)
  const isSelf = user.pubkey === pubkey

  const handleZap = async (amount: number) => {
    if (!profile?.lud16) {
      alert('This user has no lightning address (LUD-16) configured.')
      return
    }
    triggerHaptic(30)
    try {
      await zapService.sendZap(pubkey, profile.lud16, amount)
    } catch (err) {
      console.error('Zap failed', err)
      alert(err instanceof Error ? err.message : 'Failed to initiate zap.')
    }
  }

  const displayName = profile?.display_name || profile?.name || shortenPubkey(pubkey)
  const detailCandidates: DetailItem[] = [
    { label: 'Website', value: profile?.website, type: 'link', icon: Globe },
    { label: 'LUD16', value: profile?.lud16, type: 'text', icon: Zap },
    { label: 'NIP-05', value: profile?.nip05, type: 'text', icon: Hash },
  ]
  const details = detailCandidates.filter((item): item is DetailItem & { value: string } => Boolean(item.value))

  return (
    <div className={`h-full flex flex-col ${containerBg}`}>
      <header className={`h-14 border-b ${borderClass} flex items-center px-4 gap-3`}>
        <button
          type="button"
          onClick={popLayer}
          className={`text-[10px] uppercase tracking-[0.3em] font-bold ${mutedText} border ${theme === 'light' ? 'border-slate-200' : 'border-white/5'} px-3 py-1 rounded ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} transition flex items-center gap-2`}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] ${mutedText}`}>Profile_View</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className={`glassmorphism p-6 rounded-2xl ${borderClass} shadow-2xl relative overflow-hidden`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-20 h-20 rounded-full ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'} border ${borderClass} overflow-hidden flex-shrink-0`}>
                {profile?.picture ? (
                  <img src={profile.picture} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600">
                    <User size={32} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className={`${mutedText} text-[9px] font-mono uppercase tracking-[0.4em]`}>Public key</p>
                <p className={`text-[11px] font-mono ${secondaryText} break-all`}>{shortenPubkey(pubkey, 12, 12)}</p>
              </div>
            </div>

            {!isSelf && user.pubkey && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { triggerHaptic(15); toggleFollow(pubkey); }}
                  disabled={isUpdating}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${isFollowing ? `${theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'} border-slate-700` : 'bg-purple-500 text-white shadow-lg shadow-purple-500/20'}`}
                >
                  {isUpdating ? <RefreshCw size={14} className="animate-spin" /> : isFollowing ? <UserMinus size={14} /> : <UserPlus size={14} />}
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </button>
                <button
                  onClick={() => { triggerHaptic(15); toggleMute(pubkey); }}
                  disabled={isUpdating}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all border ${isMuted ? 'bg-red-500/20 border-red-500/50 text-red-400' : `${borderClass} ${mutedText} hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30`}`}
                >
                  {isMuted ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                  {isMuted ? 'Unblock' : 'Block'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="space-y-1 min-w-0">
              <h3 className={`${primaryText} font-black text-3xl tracking-tight truncate`}>{displayName}</h3>
              <p className={`text-sm ${secondaryText} font-mono leading-relaxed whitespace-pre-wrap`}>{isLoading ? 'Syncing identity data...' : profile?.about || 'Bio not provided.'}</p>
            </div>

            {profile?.lud16 && !isSelf && (
              <div className="flex flex-col gap-2">
                <p className={`text-[8px] font-mono uppercase ${mutedText} tracking-widest text-right`}>Quick_Zap</p>
                <div className="flex gap-1">
                  {[21, 100, 1000].map(amt => (
                    <button
                      key={amt}
                      onClick={() => handleZap(amt)}
                      className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[10px] font-bold hover:bg-yellow-500 hover:text-black transition-all"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {details.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {details.map(({ label, value, type, icon: Icon }) => (
              <div key={label} className={`flex items-start gap-3 p-4 border ${borderClass} rounded-xl ${theme === 'light' ? 'bg-white' : 'bg-slate-950/40 hover:bg-slate-900/60'} transition-colors`}>
                <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <Icon size={16} className="text-cyan-400" />
                </div>
                <div className="min-w-0">
                  <p className={`text-[8px] uppercase tracking-[0.3em] ${mutedText} mb-1`}>{label}</p>
                  {type === 'link' ? (
                    <a
                      href={value.startsWith('http') ? value : `https://${value}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`text-[11px] ${theme === 'light' ? 'text-slate-700 hover:text-cyan-600' : 'text-slate-200 hover:text-cyan-300'} transition break-all block`}
                    >
                      {value}
                    </a>
                  ) : (
                    <p className={`text-[11px] ${theme === 'light' ? 'text-slate-700' : 'text-slate-200'} transition break-all`}>{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

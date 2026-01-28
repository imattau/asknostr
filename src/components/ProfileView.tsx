import React from 'react'
import { ArrowLeft, Globe, Hash, Zap, User } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { shortenPubkey } from '../utils/nostr'
import { useUiStore } from '../store/useUiStore'

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
  const { popLayer } = useUiStore()
  const { data: profile, isLoading } = useProfile(pubkey || '')

  if (!pubkey) {
    return (
      <div className="p-8 text-center text-red-500 font-mono uppercase text-[10px]">[MISSING_PUBLIC_KEY]</div>
    )
  }

  const displayName = profile?.display_name || profile?.name || shortenPubkey(pubkey)
  const detailCandidates: DetailItem[] = [
    { label: 'Website', value: profile?.website, type: 'link', icon: Globe },
    { label: 'LUD16', value: profile?.lud16, type: 'text', icon: Zap },
    { label: 'NIP-05', value: profile?.nip05, type: 'text', icon: Hash },
  ]
  const details = detailCandidates.filter((item): item is DetailItem & { value: string } => Boolean(item.value))

  return (
    <div className="h-full flex flex-col bg-[#05070A]">
      <header className="h-14 border-b border-slate-800 flex items-center px-4 gap-3">
        <button
          type="button"
          onClick={popLayer}
          className="text-[10px] uppercase tracking-[0.3em] font-bold text-slate-400 border border-white/5 px-3 py-1 rounded hover:bg-white/5 transition"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Profile_View</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="glassmorphism p-6 rounded-2xl border-slate-800 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              {profile?.picture ? (
                <img src={profile.picture} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-600">
                  <User size={32} />
                </div>
              )}
            </div>
            <div>
              <p className="text-slate-500 text-[9px] font-mono uppercase tracking-[0.4em]">Public key</p>
              <p className="text-[11px] font-mono text-slate-300 break-words w-48">{shortenPubkey(pubkey)}</p>
            </div>
          </div>
          <div className="mt-6 space-y-1">
            <h3 className="text-slate-50 font-black text-2xl tracking-tight">{displayName}</h3>
            <p className="text-sm text-slate-400 font-mono">{isLoading ? 'Syncing identity data...' : profile?.about || 'Bio not provided.'}</p>
          </div>
        </div>

        {details.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {details.map(({ label, value, type, icon: Icon }) => (
              <div key={label} className="flex items-start gap-2 p-4 border border-slate-800 rounded-xl bg-slate-950/40">
                <Icon size={16} className="text-cyan-400" />
                <div>
                  <p className="text-[8px] uppercase tracking-[0.3em] text-slate-500">{label}</p>
                  {type === 'link' ? (
                    <a
                      href={value}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-slate-200 hover:text-cyan-300 transition"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-[11px] text-slate-200 transition">{value}</p>
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

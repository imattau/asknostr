import React, { useState } from 'react'
import { Wallet, CheckCircle, XCircle, Info, Trash2, ArrowRight } from 'lucide-react'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { triggerHaptic } from '../utils/haptics'

export const NwcSettings: React.FC = () => {
  const { nwcUrl, setNwcUrl } = useStore()
  const { theme } = useUiStore()
  const [inputUrl, setInputUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : ''

  const handleConnect = (e: React.FormEvent) => {
    // ... (keep logic)
    e.preventDefault()
    setError(null)
    
    if (!inputUrl.startsWith('nostr+walletconnect:')) {
      setError('Invalid connection string. Must start with nostr+walletconnect:')
      return
    }

    setNwcUrl(inputUrl)
    setInputUrl('')
    triggerHaptic(30)
  }

  const handleDisconnect = () => {
    // ... (keep logic)
    if (window.confirm('Disconnect your wallet? This will disable automated zaps.')) {
      setNwcUrl(null)
      triggerHaptic(10)
    }
  }

  return (
    <div className={`p-6 space-y-8 pb-20 ${containerBg}`}>
      <header className={`flex items-center justify-between border-b ${borderClass} pb-4`}>
        <div>
          <h2 className={`text-xl font-bold ${primaryText} uppercase flex items-center gap-2`}>
            <Wallet size={24} className="text-yellow-500" /> Wallet_Connect
          </h2>
          <p className={`text-[10px] ${mutedText} font-mono mt-1 uppercase`}>
            NIP-47 Authorization Interface
          </p>
        </div>
      </header>

      {nwcUrl ? (
        <div className="space-y-6">
          <div className={`p-6 glassmorphism border-emerald-500/20 ${theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/5'} rounded-2xl flex items-center gap-4`}>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <CheckCircle size={24} />
            </div>
            <div>
              <h3 className={`font-bold ${primaryText} uppercase text-sm tracking-tight`}>Active_Authorization</h3>
              <p className="text-[10px] text-emerald-500 font-mono uppercase mt-0.5">Secure Tunnel established</p>
            </div>
          </div>

          <div className={`p-4 ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900/50'} border ${borderClass} rounded-xl overflow-hidden`}>
            <p className={`text-[8px] font-mono ${theme === 'light' ? 'text-slate-500' : 'text-slate-600'} uppercase tracking-widest mb-2 px-1`}>Node_ID_Mask</p>
            <p className={`text-[10px] font-mono ${mutedText} truncate opacity-50 px-1`}>{nwcUrl}</p>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-full p-4 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-3 font-bold uppercase text-[10px] tracking-widest"
          >
            <Trash2 size={16} /> Disconnect_Internal_Wallet
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className={`p-4 glassmorphism border-amber-500/20 ${theme === 'light' ? 'bg-amber-50' : ''} rounded-xl flex items-start gap-3`}>
            <Info size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <p className={`text-[10px] leading-relaxed ${theme === 'light' ? 'text-slate-600' : 'text-slate-400'} uppercase font-mono`}>
              Paste your <span className="text-amber-400 font-bold">NWC Connection String</span> (from Alby, Mutiny, or Amethyst) below to enable seamless, one-tap zapping. Your keys never leave your device.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-4">
            <div className="relative">
              <input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="nostr+walletconnect://..."
                className="w-full terminal-input rounded-xl px-4 py-4 pr-12 text-xs font-mono placeholder:opacity-30"
              />
              <button
                type="submit"
                disabled={!inputUrl}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-all disabled:opacity-30"
              >
                <ArrowRight size={18} />
              </button>
            </div>
            {error && (
              <p className="text-[9px] text-red-400 uppercase font-mono px-2 animate-pulse">{error}</p>
            )}
          </form>

          <div className="pt-8 opacity-20 text-center">
            <XCircle size={48} className={`mx-auto mb-4 ${theme === 'light' ? 'text-slate-400' : ''}`} />
            <p className={`text-[9px] font-mono uppercase tracking-[0.3em] ${mutedText}`}>Status: Disconnected</p>
          </div>
        </div>
      )}
    </div>
  )
}

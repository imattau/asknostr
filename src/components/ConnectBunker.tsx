import React, { useState } from 'react'
import { Shield, Key, RefreshCw, AlertCircle, Cpu, Info } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import { useStore } from '../store/useStore'
import { signerService } from '../services/signer'
import { triggerHaptic } from '../utils/haptics'

export const ConnectBunker: React.FC = () => {
  const [uri, setUri] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { popLayer } = useUiStore()
  const { setRemoteSigner, setLoginMethod, setUser } = useStore()

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uri.trim()) return

    setIsConnecting(true)
    setError(null)
    triggerHaptic(15)

    try {
      const userPubkey = await signerService.connect(uri)
      
      const url = new URL(uri)
      const bunkerPubkey = url.host
      const relay = url.searchParams.get('relay')
      const secret = url.searchParams.get('secret')

      setRemoteSigner({ pubkey: bunkerPubkey, relay, secret })
      setLoginMethod('nip46')
      setUser(userPubkey)

      triggerHaptic(50)
      popLayer()
    } catch (err: unknown) {
      console.error('Nostr Connect failed', err)
      const message = err instanceof Error ? err.message : 'Connection failed. Verify URI and relay connectivity.'
      setError(message)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className="p-6 space-y-8">
      <header className="terminal-border p-4 bg-purple-500/10 border-purple-500/30">
        <h2 className="text-xl font-bold text-purple-400 uppercase flex items-center gap-2 tracking-tighter">
          <Cpu size={24} /> Remote_Signer_Handshake
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
          Initializing NIP-46 Nostr Connect Session
        </p>
      </header>

      <form onSubmit={handleConnect} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Key size={12} /> Connection_URI (bunker://)
          </label>
          <textarea 
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="bunker://<pubkey>?relay=wss://...&secret=..."
            className="w-full terminal-input rounded-xl p-4 min-h-[100px] font-mono text-xs shadow-2xl"
          />
          <p className="text-[8px] text-slate-600 font-mono uppercase">Obtain this string from your bunker provider (e.g. NSigner, Amber, or private bunker)</p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex gap-3 text-red-500 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-[10px] font-bold uppercase font-mono">{error}</p>
          </div>
        )}

        <div className="pt-4 flex flex-col gap-3">
          <button 
            type="submit" 
            disabled={isConnecting || !uri.trim()}
            className="w-full terminal-button rounded-xl py-4 flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
          >
            {isConnecting ? <RefreshCw size={18} className="animate-spin" /> : <Shield size={18} />}
            {isConnecting ? 'ESTABLISHING_LINK...' : 'AUTHORIZE_REMOTE_SIGNER'}
          </button>
          
          <button 
            type="button" 
            onClick={popLayer}
            className="w-full py-2 text-[10px] font-mono font-bold text-slate-600 hover:text-slate-400 transition-colors uppercase"
          >
            Abort_Handshake
          </button>
        </div>
      </form>

      <section className="p-4 glassmorphism rounded-xl border-slate-800 space-y-3">
        <h3 className="text-[10px] font-bold text-slate-50 uppercase tracking-widest flex items-center gap-2">
          <Info size={12} className="text-cyan-500" /> Protocol_Notice
        </h3>
        <p className="text-[9px] text-slate-500 font-sans leading-relaxed">
          Nostr Connect (NIP-46) allows you to maintain your private keys on a separate device or server. This application will never see your keys; it only sends authorization requests to your bunker via an encrypted channel.
        </p>
      </section>
    </div>
  )
}
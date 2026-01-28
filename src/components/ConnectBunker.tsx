import React, { useState, useEffect, useRef } from 'react'
import { Shield, Key, RefreshCw, AlertCircle, Cpu, Smartphone } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import { useStore } from '../store/useStore'
import { signerService } from '../services/signer'
import { nostrService } from '../services/nostr'
import { triggerHaptic } from '../utils/haptics'
import QRCode from 'react-qr-code'

export const ConnectBunker: React.FC = () => {
  const [uri, setUri] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Client-Initiated Flow (NIP-46)
  const [generatedUri, setGeneratedUri] = useState<string>('')
  const generatedRelayRef = useRef<string>('')
  const generatedSecretRef = useRef<string>('')
  
  const { popLayer } = useUiStore()
  const { setRemoteSigner, setLoginMethod, setUser } = useStore()

  useEffect(() => {
    // Generate a nostrconnect:// URI for this client session
    // This allows the user to scan this QR with Amber/Amethyst to initiate the connection "backwards"
    const clientPubkey = signerService.clientPubkey
    // Use a high-availability relay for the handshake
    const relay = 'wss://relay.damus.io' 
    const secret = Math.random().toString(36).substring(2, 15)
    generatedRelayRef.current = relay
    generatedSecretRef.current = secret
    
    // Metadata for the signer app
    const metadata = {
      name: 'AskNostr',
      url: window.location.origin,
      description: 'A Miller Column Nostr Client'
    }
    
    const relayParam = encodeURIComponent(relay)
    const connectUri = `nostrconnect://${clientPubkey}?relay=${relayParam}&r=${relayParam}&secret=${secret}&metadata=${encodeURIComponent(JSON.stringify(metadata))}`
    setGeneratedUri(connectUri)

    // Listen for the "connect" ACK from the signer app
    const sub = nostrService.subscribe(
      [{ kinds: [24133], '#p': [clientPubkey], limit: 1 }],
      async (event) => {
        const relayFromRef = generatedRelayRef.current
        const secretFromRef = generatedSecretRef.current
        if (!relayFromRef || !secretFromRef) return
        try {
          const decrypted = await signerService.decryptFrom(event.pubkey, event.content)
          const request = JSON.parse(decrypted)
          if (request?.method !== 'connect') return
          const [client, secret] = request.params || []
          if (client !== clientPubkey || secret !== secretFromRef) return

          setIsConnecting(true)
          await signerService.acknowledgeConnect(event.pubkey, relayFromRef, request.id)
          const userPubkey = await signerService.fetchRemotePublicKey(event.pubkey, relayFromRef)

          setRemoteSigner({ pubkey: event.pubkey, relay: relayFromRef, secret: secretFromRef })
          setLoginMethod('nip46')
          setUser(userPubkey)
          triggerHaptic(50)
          popLayer()
        } catch (err) {
          console.error('Failed to complete reverse connect', err)
          const message = err instanceof Error ? err.message : 'Reverse connect failed.'
          setError(message)
          setIsConnecting(false)
        }
      },
      [relay]
    )

    return () => {
      sub.then(s => s.close())
    }
  }, [])

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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUri)
    triggerHaptic(10)
    alert('Connection URI copied to clipboard')
  }

  return (
    <div className="p-6 space-y-8 pb-20">
      <header className="terminal-border p-4 bg-purple-500/10 border-purple-500/30">
        <h2 className="text-xl font-bold text-purple-400 uppercase flex items-center gap-2 tracking-tighter">
          <Cpu size={24} /> Remote_Signer_Handshake
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
          NIP-46: Connect to Amber, NSigner, or Bunker
        </p>
      </header>

      {/* Tab 1: Scan Client (Reverse Flow) - Popular for Mobile */}
      <section className="space-y-4">
        <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Smartphone size={14} /> Connect_via_Mobile_App
        </h3>
        
        {generatedUri ? (
          <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-2xl">
            <QRCode value={generatedUri} size={180} />
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center border border-dashed border-slate-800 rounded-xl">
            <RefreshCw className="animate-spin text-slate-600" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              triggerHaptic(10)
              window.location.href = generatedUri
            }}
            className="flex items-center justify-center gap-2 bg-purple-500 text-white p-3 rounded-xl font-bold uppercase text-[10px] shadow-lg shadow-purple-500/20 active:scale-95 transition-all text-center"
          >
            <Smartphone size={16} /> Open_App
          </button>
          <button 
            onClick={copyToClipboard}
            className="flex items-center justify-center gap-2 bg-slate-800 text-slate-300 p-3 rounded-xl font-bold uppercase text-[10px] active:scale-95 transition-all border border-slate-700 hover:border-slate-600"
          >
            <Key size={16} /> Copy_URI
          </button>
        </div>
        <p className="text-[9px] text-slate-500 text-center font-mono uppercase">
          Scan with Amber, Amethyst, or NSigner to authorize AskNostr
        </p>
      </section>

      <div className="relative flex items-center justify-center">
        <div className="absolute w-full h-px bg-slate-800"></div>
        <span className="relative bg-[#05070A] px-2 text-[10px] font-bold text-slate-600 uppercase">OR_ENTER_BUNKER_URI</span>
      </div>

      {/* Tab 2: Manual Entry (Standard Flow) */}
      <form onSubmit={handleConnect} className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Key size={12} /> Manual_Connection_String
          </label>
          <textarea 
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="bunker://<pubkey>?relay=wss://...&secret=..."
            className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-mono text-xs shadow-2xl"
          />
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex gap-3 text-red-500 animate-in fade-in slide-in-from-top-1">
            <AlertCircle size={18} className="shrink-0" />
            <p className="text-[10px] font-bold uppercase font-mono">{error}</p>
          </div>
        )}

        <div className="pt-2 flex flex-col gap-3">
          <button 
            type="submit" 
            disabled={isConnecting || !uri.trim()}
            className="w-full terminal-button rounded-xl py-4 flex items-center justify-center gap-3 shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50"
          >
            {isConnecting ? <RefreshCw size={18} className="animate-spin" /> : <Shield size={18} />}
            {isConnecting ? 'ESTABLISHING_LINK...' : 'CONNECT_TO_BUNKER'}
          </button>
          
          <button 
            type="button" 
            onClick={popLayer}
            className="w-full py-2 text-[10px] font-mono font-bold text-slate-600 hover:text-slate-400 transition-colors uppercase"
          >
            Cancel_Operation
          </button>
        </div>
      </form>
    </div>
  )
}

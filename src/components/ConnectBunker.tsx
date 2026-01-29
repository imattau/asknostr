import React, { useState, useEffect, useRef } from 'react'
import { Shield, Key, RefreshCw, AlertCircle, Cpu, Smartphone } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { useUiStore } from '../store/useUiStore'
import { useStore } from '../store/useStore'
import { signerService } from '../services/signer'
import { nostrService } from '../services/nostr'
import { DEFAULT_RELAYS } from '../services/nostr'
import { errorReporter } from '../services/errorReporter'
import { triggerHaptic } from '../utils/haptics'
import { normalizeHexPubkey, normalizeRelayUrl } from '../utils/nostr'
import QRCode from 'qrcode'

export const ConnectBunker: React.FC = () => {
  const [uri, setUri] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nsecInput, setNsecInput] = useState('')
  const [nsecWarning, setNsecWarning] = useState<string | null>(null)
  
  // Client-Initiated Flow (NIP-46)
  const [generatedUri, setGeneratedUri] = useState<string>('')
  const [qrCodeData, setQrCodeData] = useState<string>('')
  const generatedRelaysRef = useRef<string[]>([])
  const generatedSecretRef = useRef<string>('')
  
  const { popLayer, theme } = useUiStore()
  const { setRemoteSigner, setLoginMethod, setUser } = useStore()

  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : ''

  // ... (keep logic)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleNativeError = (event: ErrorEvent) => {
      if (event.error) {
        console.error('[ConnectBunker] native error captured', event.error)
        errorReporter.reportError(event.error, 'ConnectBunker:global error')
      } else {
        console.error('[ConnectBunker] native error event', event.message, event)
      }
    }
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('[ConnectBunker] unhandled rejection', event.reason)
      errorReporter.reportError(event.reason, 'ConnectBunker:unhandled rejection')
    }
    window.addEventListener('error', handleNativeError)
    window.addEventListener('unhandledrejection', handleRejection)

    return () => {
      window.removeEventListener('error', handleNativeError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  useEffect(() => {
    console.log('[ConnectBunker] component mounted, generating URI')
    // Generate a nostrconnect:// URI for this client session
    // This allows the user to scan this QR with Amber/Amethyst to initiate the connection "backwards"
    const clientPubkey = signerService.clientPubkey
    // Use multiple high-availability relays for the handshake
    const relays = DEFAULT_RELAYS.slice(0, 3)
    const secret = Math.random().toString(36).substring(2, 15)
    generatedRelaysRef.current = relays
    generatedSecretRef.current = secret
    
    // Metadata for the signer app
    const metadata = {
      name: 'AskNostr',
      url: window.location.origin,
      description: 'A Miller Column Nostr Client'
    }
    
    const params = new URLSearchParams()
    relays.forEach(r => params.append('relay', r))
    params.append('secret', secret)
    params.append('metadata', JSON.stringify(metadata))
    
    const connectUri = `nostrconnect://${clientPubkey}?${params.toString()}`
    setGeneratedUri(connectUri)

    QRCode.toDataURL(connectUri, { margin: 2, scale: 6 })
      .then(url => setQrCodeData(url))
      .catch(err => console.error('[ConnectBunker] QR gen failed', err))

    // Listen for the "connect" ACK from the signer app
    const handleError = (err: unknown, context: string) => {
      console.error('[ConnectBunker] initialization failed', context, err)
      errorReporter.reportError(err, `ConnectBunker:${context}`)
      setError('Failed to prepare remote signer. Retry or refresh.')
    }

    let subscriptionPromise = Promise.resolve({ close: () => {} })
    try {
      subscriptionPromise = nostrService.subscribe(
      [{ kinds: [24133], '#p': [clientPubkey], limit: 1 }],
      async (event) => {
        const relaysFromRef = generatedRelaysRef.current
        const secretFromRef = generatedSecretRef.current
        if (relaysFromRef.length === 0 || !secretFromRef) return
        try {
        console.log('[ConnectBunker] received subscription event', { pubkey: event.pubkey, kind: event.kind })
        const decrypted = await signerService.decryptFrom(event.pubkey, event.content)
          const request = JSON.parse(decrypted)
          if (request?.method !== 'connect') return
          const [client, secret] = request.params || []
          if (client !== clientPubkey || secret !== secretFromRef) return

          const allow = window.confirm('Allow this signer to connect to AskNostr?')
          if (!allow) {
            setError('Connection rejected.')
            return
          }

          setIsConnecting(true)
          await signerService.acknowledgeConnect(event.pubkey, relaysFromRef, request.id)
          const userPubkey = await signerService.fetchRemotePublicKey(event.pubkey, relaysFromRef)

          setRemoteSigner({ pubkey: event.pubkey, relays: relaysFromRef, secret: secretFromRef })
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
      relays // Listen on all handshake relays
      ).catch((err) => {
        handleError(err, 'subscribe')
        return { close: () => {} }
      })
    } catch (err) {
      handleError(err, 'subscribe-sync')
    }

    return () => {
      subscriptionPromise.then(s => s.close()).catch((err) => {
        console.warn('[ConnectBunker] subscription close failed', err)
      })
    }
  }, [])

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uri.trim()) return

    setIsConnecting(true)
    setError(null)
    triggerHaptic(15)

    console.log('[ConnectBunker] handleConnect start', { uri })
    try {
      const userPubkey = await signerService.connect(uri)
      
    const url = new URL(uri.trim())
    const bunkerPubkey = normalizeHexPubkey(url.host)
    if (!bunkerPubkey) {
      throw new Error('Invalid bunker public key')
    }

    const rawRelays = url.searchParams.getAll('relay')
    const rRelays = url.searchParams.getAll('r')
    let relays = [...rawRelays, ...rRelays].map(normalizeRelayUrl).filter(r => !!r) as string[]
    
    if (relays.length === 0) {
      relays = [DEFAULT_RELAYS[0]]
    }

    const secretParam = url.searchParams.get('secret')?.trim()
    const secret = secretParam || null

      setRemoteSigner({ pubkey: bunkerPubkey, relays, secret })
      console.info('[ConnectBunker] remote signer stored', { bunkerPubkey, relays, secret })
      setLoginMethod('nip46')
      setUser(userPubkey)

      triggerHaptic(50)
      popLayer()
    } catch (err: unknown) {
      console.error('[ConnectBunker] Nostr Connect failed', err)
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

  const handleUseNsec = () => {
    if (!nsecInput.trim()) return
    setIsConnecting(true)
    setError(null)
    setNsecWarning(null)
    try {
      const decoded = nip19.decode(nsecInput.trim())
      let hexKey = ''
      
      if (decoded.type === 'nsec') {
        if (decoded.data instanceof Uint8Array) {
          hexKey = Array.from(decoded.data).map(b => b.toString(16).padStart(2, '0')).join('')
        } else if (typeof decoded.data === 'string') {
          hexKey = decoded.data
        }
      }

      if (!hexKey) {
        throw new Error('Invalid nsec key.')
      }

      signerService.setSecretKey(hexKey)
      const userPubkey = signerService.clientPubkey
      
      setRemoteSigner({ pubkey: null, relays: [], secret: null })
      setLoginMethod('local')
      setUser(userPubkey)
      triggerHaptic(50)
      setNsecWarning('Local key imported—treat this session as sensitive.')
      popLayer()
    } catch (err: unknown) {
      console.error(err)
      const message = err instanceof Error ? err.message : 'Invalid nsec string'
      setError(message)
    } finally {
      setIsConnecting(false)
    }
  }

  return (
    <div className={`p-6 space-y-8 pb-20 ${containerBg}`}>
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
        <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-2`}>
          <Smartphone size={14} /> Connect_via_Mobile_App
        </h3>
        
        {qrCodeData ? (
          <div className="bg-white p-4 rounded-xl flex items-center justify-center shadow-2xl">
            <img src={qrCodeData} alt="Scan to connect" className="w-[180px] h-[180px]" />
          </div>
        ) : (
          <div className={`h-48 flex items-center justify-center border border-dashed ${borderClass} rounded-xl`}>
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
            className={`flex items-center justify-center gap-2 ${theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'} p-3 rounded-xl font-bold uppercase text-[10px] active:scale-95 transition-all border ${theme === 'light' ? 'border-slate-200' : 'border-slate-700 hover:border-slate-600'}`}
          >
            <Key size={16} /> Copy_URI
          </button>
        </div>
        <p className={`text-[9px] ${mutedText} text-center font-mono uppercase`}>
          Scan with Amber, Amethyst, or NSigner to authorize AskNostr
        </p>
      </section>

      <div className="relative flex items-center justify-center">
        <div className={`absolute w-full h-px ${borderClass}`}></div>
        <span className={`relative ${theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]'} px-2 text-[10px] font-bold ${mutedText} uppercase`}>OR_ENTER_BUNKER_URI</span>
      </div>

      {/* Tab 2: Manual Entry (Standard Flow) */}
      <form onSubmit={handleConnect} className="space-y-6">
        <div className="space-y-2">
          <label className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest flex items-center gap-1`}>
            <Key size={12} /> Manual_Connection_String
          </label>
          <textarea 
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="bunker://<pubkey>?relay=wss://...&secret=..."
            className="w-full terminal-input rounded-xl p-4 min-h-[80px] font-mono text-xs shadow-2xl"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
            <Shield size={12} /> Paste_NSEC_Fallback
          </label>
          <input
            value={nsecInput}
            onChange={(e) => setNsecInput(e.target.value)}
            placeholder="nsec1..."
            className="w-full terminal-input rounded-xl px-4 py-3 text-xs font-mono border-amber-500/40 focus:border-amber-300"
          />
          <p className="text-[8px] uppercase font-mono tracking-[0.3em] text-amber-400">
            Warning: Pastable nsec is stored locally. Only use this on a trusted device.
          </p>
          <button
            type="button"
            disabled={!nsecInput.trim() || isConnecting}
            onClick={handleUseNsec}
            className="w-full bg-amber-500/10 border border-amber-500/40 text-amber-200 uppercase py-3 rounded-xl text-[10px] font-bold tracking-[0.4em] disabled:opacity-40"
          >
            Use pasted nsec
          </button>
          {nsecWarning && (
            <p className="text-[9px] font-mono text-amber-300 uppercase">{nsecWarning}</p>
          )}
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
            className={`w-full py-2 text-[10px] font-mono font-bold ${mutedText} hover:text-slate-400 transition-colors uppercase`}
          >
            Cancel_Operation
          </button>
        </div>
      </form>
    </div>
  )
}

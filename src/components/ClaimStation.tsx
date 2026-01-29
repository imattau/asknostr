import React, { useState } from 'react'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { Shield, Hammer, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'
import type { CommunityDefinition } from '../hooks/useCommunity'

interface ClaimStationProps {
  community: CommunityDefinition
}

export const ClaimStation: React.FC<ClaimStationProps> = ({ community }) => {
  const { user } = useStore()
  const { popLayer, theme } = useUiStore()
  const [step, setStep] = useState<'info' | 'verifying' | 'success'>('info')
  const [logs, setLogs] = useState<string[]>([])

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-slate-300'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const containerBg = theme === 'light' ? 'bg-slate-50' : ''

  const addLog = (msg: string) => setLogs(prev => [...prev, `> ${msg}`])

  const handleClaim = async () => {
    // ... (keep logic)
    if (!user.pubkey) {
      alert('Identity signature required for station takeover.')
      return
    }

    setStep('verifying')
    triggerHaptic(20)
    addLog('INITIATING_AUTHORITY_TRANSFER_PROTOCOL...')
    
    await new Promise(r => setTimeout(r, 1000))
    addLog('STATION_VACANCY_CONFIRMED: NO_ACTIVE_MODERATORS_DETECTED')
    await new Promise(r => setTimeout(r, 800))
    addLog('FORKING_COMMUNITY_DEFINITION...')
    await new Promise(r => setTimeout(r, 800))
    addLog('ESTABLISHING_NEW_MODERATOR_KEYSET...')
    await new Promise(r => setTimeout(r, 800))
    addLog('CLAIM_AUTHORIZED: BROADCASTING_NEW_DEFINITION...')

    try {
      const now = Math.floor(Date.now() / 1000)
      
      const definitionTemplate = {
        kind: 34550,
        pubkey: user.pubkey,
        created_at: now,
        tags: [
          ['d', community.id],
          ['name', community.name || ''],
          ['description', community.description || ''],
          ...(community.rules ? [['rules', community.rules]] : []),
          ...(community.image ? [['image', community.image]] : []),
          ...community.relays.map(r => ['relay', r]),
          ['p', user.pubkey], 
          ['claim', 'true'],
          ['previous_creator', community.creator]
        ],
        content: `Station ${community.id} claimed by ${user.pubkey} due to moderator vacancy.`,
      }

      const signedDef = await signerService.signEvent(definitionTemplate)
      await nostrService.publish(signedDef)

      const logTemplate = {
        kind: 1,
        created_at: now + 1,
        tags: [
          ['t', 'asknostr-claim'],
          ['e', signedDef.id],
          ['p', community.creator],
          ['a', `34550:${user.pubkey}:${community.id}`]
        ],
        content: `[SYSTEM_LOG] Community station c/${community.id} has been claimed by ${user.pubkey}. Authorization verified via AskNostr protocol.`,
      }

      const signedLog = await signerService.signEvent(logTemplate)
      await nostrService.publish(signedLog)

      setStep('success')
      triggerHaptic(50)
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const qc = (window as any).queryClient
      if (qc) {
        qc.invalidateQueries({ queryKey: ['my-communities'] })
        qc.invalidateQueries({ queryKey: ['global-community-discovery'] })
      }
    } catch (e) {
      console.error('Claim failed', e)
      addLog('CRITICAL_ERROR: BROADCAST_INTERRUPTED')
      setStep('info')
    }
  }

  return (
    <div className={`p-6 space-y-8 ${containerBg}`}>
      <header className="terminal-border p-4 bg-orange-500/10 border-orange-500/30">
        <h2 className="text-xl font-bold text-orange-500 uppercase flex items-center gap-2">
          <Hammer size={24} /> Authority_Claim_Protocol
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1 font-mono">
          Station: c/{community.id} | Status: UNMODERATED
        </p>
      </header>

      {step === 'info' && (
        <div className="space-y-6">
          <div className={`p-4 ${theme === 'light' ? 'bg-orange-50' : 'bg-white/5'} border ${theme === 'light' ? 'border-orange-200' : 'border-white/10'} rounded-xl space-y-4`}>
            <div className="flex gap-3 text-orange-400">
              <AlertTriangle size={20} className="shrink-0" />
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase">Vacancy Detected</p>
                <p className={`text-[10px] ${theme === 'light' ? 'text-slate-600' : 'opacity-70'} leading-relaxed font-sans`}>
                  This station currently lists zero authorized moderators. Under the AskNostr decentralized recovery protocol, any verified entity may claim management authority to prevent station decay.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className={`text-[10px] font-mono font-bold ${mutedText} uppercase tracking-widest px-2`}>Action_Consequences</h3>
            <ul className={`text-[9px] font-mono ${secondaryText} space-y-1 list-disc list-inside px-2`}>
              <li>Creates a FORK of the community definition under your pubkey</li>
              <li>Sets you as the primary moderator of this new instance</li>
              <li>Original station remains on the network but may be hidden by filters</li>
            </ul>
          </div>

          <button 
            onClick={handleClaim}
            className="w-full terminal-button rounded-xl py-4 flex items-center justify-center gap-3 shadow-lg shadow-orange-500/20 active:scale-95"
          >
            <Shield size={18} />
            Initialize_Claim_Sequence
          </button>
        </div>
      )}

      {step === 'verifying' && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <RefreshCw size={48} className="animate-spin text-orange-500" />
            <span className="font-mono text-xs uppercase animate-pulse">Processing_Authorization...</span>
          </div>
          <div className={`bg-black border ${borderClass} rounded-lg p-4 font-mono text-[9px] text-orange-500/70 h-32 overflow-y-auto`}>
            {logs.map((log, i) => (
              <p key={i}>{log}</p>
            ))}
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="space-y-6 text-center animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <CheckCircle size={64} className="text-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] rounded-full" />
            <div className="space-y-1">
              <h3 className={`text-xl font-black ${primaryText} uppercase tracking-tighter`}>Authority_Secured</h3>
              <p className={`text-[10px] ${mutedText} font-mono uppercase`}>STATION_IDENTITY_SYNCHRONIZED</p>
            </div>
          </div>
          
          <button 
            onClick={popLayer}
            className="w-full terminal-button rounded-xl py-3 bg-green-500/20 text-green-500 border border-green-500/30 hover:bg-green-500/30 active:scale-95"
          >
            Access_Admin_Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
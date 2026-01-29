import React from 'react'
import type { Event } from 'nostr-tools'
import { useFeed } from '../hooks/useFeed'
import { useUiStore } from '../store/useUiStore'
import { Shield, Clock, AlertTriangle, CheckCircle, Trash2, User } from 'lucide-react'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'

interface ModerationLogProps {
  communityId: string
  creator: string
}

export const ModerationLog: React.FC<ModerationLogProps> = ({ communityId, creator }) => {
  const communityATag = `34550:${creator}:${communityId}`
  const { data: events = [], isLoading } = useFeed({
    filters: [{ kinds: [4550, 1984], '#a': [communityATag], limit: 100 }]
  })
  const { theme } = useUiStore()

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-slate-300'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const headerBg = theme === 'light' ? 'bg-white/80' : 'bg-slate-900/50'

  // Sort events
  const allModEvents = React.useMemo(() => {
    return [...events].sort((a, b) => b.created_at - a.created_at)
  }, [events])

  const renderLogEntry = (log: Event) => {
    const targetId = log.tags.find(t => t[0] === 'e')?.[1]
    const targetAuthor = log.tags.find(t => t[0] === 'p')?.[1]
    
    if (log.kind === 4550) {
      const status = log.tags.find(t => t[0] === 'status')?.[1] || 'approved'
      const isNegative = status === 'spam' || status === 'rejected'
      
      return (
        <div key={log.id} className={`glassmorphism p-4 text-[10px] font-mono border-l-2 ${isNegative ? 'border-l-red-500 bg-red-500/5' : 'border-l-green-500 bg-green-500/5'}`}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {isNegative ? <Trash2 size={14} className="text-red-500" /> : <CheckCircle size={14} className="text-green-500" />}
              <span className={`font-bold uppercase ${isNegative ? 'text-red-500' : 'text-green-500'}`}>
                MODERATION_{status.toUpperCase()}
              </span>
            </div>
            <span className="opacity-50 flex items-center gap-1"><Clock size={10} /> {formatDate(log.created_at)}</span>
          </div>
          <div className="space-y-1 opacity-70">
            <div className="flex items-center gap-2">
              <User size={10} />
              <span>MODERATOR: {shortenPubkey(formatPubkey(log.pubkey))}</span>
            </div>
            <p className="pl-4 border-l border-white/5">TARGET_ID: {targetId || 'UNKNOWN'}</p>
            {targetAuthor && <p className="pl-4 border-l border-white/5">AUTHOR: {shortenPubkey(formatPubkey(targetAuthor))}</p>}
          </div>
          {log.content && <p className={`mt-3 p-2 ${theme === 'light' ? 'bg-slate-100' : 'bg-black/20'} rounded italic ${secondaryText}`}>"{log.content}"</p>}
        </div>
      )
    }

    if (log.kind === 1984) {
      return (
        <div key={log.id} className="glassmorphism p-4 text-[10px] font-mono border-l-2 border-l-orange-500 bg-orange-500/5">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2 text-orange-500">
              <AlertTriangle size={14} />
              <span className="font-bold uppercase">REPORT_LOGGED</span>
            </div>
            <span className="opacity-50 flex items-center gap-1"><Clock size={10} /> {formatDate(log.created_at)}</span>
          </div>
          <div className="space-y-1 opacity-70">
            <span>REPORTER: {shortenPubkey(formatPubkey(log.pubkey))}</span>
            <p className="pl-4 border-l border-white/5">TARGET_ID: {targetId || 'UNKNOWN'}</p>
          </div>
          {log.content && <p className={`mt-3 p-2 ${theme === 'light' ? 'bg-slate-100' : 'bg-black/20'} rounded italic ${theme === 'light' ? 'text-orange-700' : 'text-orange-400/70'}`}>REASON: "{log.content}"</p>}
        </div>
      )
    }

    return null
  }

  return (
    <div className="p-6 space-y-6">
      <header className={`terminal-border p-4 ${headerBg} ${borderClass}`}>
        <h3 className={`text-sm font-black uppercase ${primaryText} flex items-center gap-3`}>
          <Shield size={20} className="text-cyan-500" /> Audit_Trail: {communityId}
        </h3>
        <p className="text-[10px] opacity-50 uppercase mt-1 font-mono tracking-widest">
          Transparent record of all administrative actions and network reports
        </p>
      </header>

      {allModEvents.length === 0 && !isLoading ? (
        <div className={`py-20 text-center opacity-20 italic font-mono text-xs border border-dashed ${borderClass} rounded-xl`}>
          [STATION_RECORDS_EMPTY_NO_ADMIN_ACTIONS_DETECTED]
        </div>
      ) : (
        <div className="space-y-3">
          {allModEvents.map(log => renderLogEntry(log))}
          {isLoading && (
            <div className="p-12 flex flex-col items-center justify-center space-y-3 opacity-50">
              <RefreshCw size={24} className="animate-spin text-cyan-500" />
              <span className="text-[9px] font-mono uppercase tracking-[0.2em]">Synchronizing_Archive...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const RefreshCw = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
  </svg>
)
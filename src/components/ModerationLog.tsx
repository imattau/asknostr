import React, { useEffect, useState } from 'react'
import type { Event } from 'nostr-tools'
import { nostrService } from '../services/nostr'
import { Shield, Clock } from 'lucide-react'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'

interface ModerationLogProps {
  communityId: string
  creator: string
}

export const ModerationLog: React.FC<ModerationLogProps> = ({ communityId, creator }) => {
  const [approvals, setApprovals] = useState<Event[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let sub: { close: () => void } | undefined
    const communityATag = `34550:${creator}:${communityId}`

    const fetchLog = async () => {
      setIsLoading(true)
      sub = await nostrService.subscribe(
        [{ kinds: [4550], '#a': [communityATag], limit: 50 }],
        (event: Event) => {
          setApprovals(prev => {
            if (prev.find(e => e.id === event.id)) return prev
            return [event, ...prev].sort((a, b) => b.created_at - a.created_at)
          })
        }
      )
      setTimeout(() => setIsLoading(false), 2000)
    }

    fetchLog()
    return () => sub?.close()
  }, [communityId, creator])

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-center justify-between border-b border-[#00ff41]/20 pb-2">
        <h3 className="text-xs font-bold uppercase text-[#00ff41] flex items-center gap-2">
          <Shield size={14} /> Audit_Trail: {communityId}
        </h3>
        {isLoading && <Clock size={12} className="animate-spin text-[#00ff41]/50" />}
      </header>

      {approvals.length === 0 && !isLoading ? (
        <div className="p-8 text-center opacity-30 italic text-[10px]">
          [NO_MODERATION_HISTORY_LOGGED]
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map(log => {
            const targetId = log.tags.find(t => t[0] === 'e')?.[1]
            const targetAuthor = log.tags.find(t => t[0] === 'p')?.[1]
            
            return (
              <div key={log.id} className="glassmorphism p-3 text-[10px] font-mono border-slate-800">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-green-500 font-bold">EVENT_AUTHORIZED</span>
                  <span className="opacity-50">{formatDate(log.created_at)}</span>
                </div>
                <div className="grid gap-1 opacity-70">
                  <p>MODERATOR: {shortenPubkey(formatPubkey(log.pubkey))}</p>
                  <p>TARGET_ID: {targetId?.slice(0, 16)}...</p>
                  <p>TARGET_AUTHOR: {targetAuthor ? shortenPubkey(formatPubkey(targetAuthor)) : 'UNKNOWN'}</p>
                </div>
                {log.content && (
                  <p className="mt-2 p-1 bg-white/5 border-l border-[#00ff41]/30 italic">
                    "{log.content}"
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

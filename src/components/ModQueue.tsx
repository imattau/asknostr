import React, { useState, useEffect, useMemo } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useFeed } from '../hooks/useFeed'
import { Post } from './Post'
import { useUiStore } from '../store/useUiStore'
import { Shield, AlertCircle, AlertTriangle } from 'lucide-react'
import { nostrService } from '../services/nostr'
import type { Event } from 'nostr-tools'

interface ModQueueProps {
  communityId: string
  creator: string
}

export const ModQueue: React.FC<ModQueueProps> = ({ communityId, creator }) => {
  const { data: community } = useCommunity(communityId, creator)
  const communityATag = `34550:${creator}:${communityId}`
  const { data: events = [] } = useFeed({ filters: [{ '#a': [communityATag] }] })
  const [reports, setReports] = useState<Event[]>([])
  const { theme } = useUiStore()
  
  // Get all events for this community
  const communityEvents = events.filter(e => 
    e.tags.some(t => t[0] === 'a' && t[1] === communityATag)
  )

  const moderators = community?.moderators || []
  const eventIds = communityEvents.map(e => e.id)
  const { data: approvals = [] } = useApprovals(eventIds, moderators, community?.relays)

  // Advanced Status Logic for filtering
  const eventStatusMap = useMemo(() => {
    const map: Record<string, string> = {}
    approvals.forEach(a => {
      const eTarget = a.tags.find(t => t[0] === 'e')?.[1]
      const status = a.tags.find(t => t[0] === 'status')?.[1] || 'approved'
      if (eTarget) {
        if (!map[eTarget] || a.created_at > (approvals.find(old => old.id === eTarget)?.created_at || 0)) {
          map[eTarget] = status
        }
      }
    })
    return map
  }, [approvals])

  // Pending posts = posts with community tag but no approval/status from a moderator
  const pendingPosts = communityEvents.filter(e => !eventStatusMap[e.id])

  useEffect(() => {
    if (eventIds.length === 0) return
    let sub: { close: () => void } | undefined

    const fetchReports = async () => {
      sub = await nostrService.subscribe(
        [{ kinds: [1984], '#e': eventIds }],
        (event: Event) => {
          setReports(prev => {
            if (prev.find(e => e.id === event.id)) return prev
            return [...prev, event]
          })
        }
      )
    }

    fetchReports()
    return () => sub?.close()
  }, [eventIds]) // Use eventIds to refetch when posts change

  const headerClass = theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-red-500/10 border-red-500/30';
  const reasonText = theme === 'light' ? 'text-slate-600' : 'text-slate-400';

  return (
    <div className="p-4 space-y-6">
      <header className={`terminal-border p-4 ${headerClass}`}>
        <h2 className="text-xl font-bold text-red-500 uppercase flex items-center gap-2">
          <Shield size={24} /> Mod_Queue: c/{communityId}
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1">
          {pendingPosts.length} Entries awaiting authorization
        </p>
      </header>

      {pendingPosts.length === 0 ? (
        <div className="text-center p-12 terminal-border border-dashed opacity-30 italic">
          <AlertCircle size={48} className="mx-auto mb-4" />
          [QUEUE_IS_EMPTY]
        </div>
      ) : (
        <div className="space-y-6">
          {pendingPosts.map(event => {
            const postReports = reports.filter(r => r.tags.some(t => t[0] === 'e' && t[1] === event.id))
            return (
              <div key={event.id} className="space-y-2">
                {postReports.length > 0 && (
                  <div className="flex items-center gap-2 text-orange-500 text-[10px] font-bold uppercase animate-pulse">
                    <AlertTriangle size={14} /> Reported_{postReports.length}_Times
                  </div>
                )}
                <Post 
                  event={event} 
                  isModerator={moderators.includes(event.pubkey)} 
                />
                {postReports.length > 0 && (
                  <div className="ml-4 p-2 border-l border-orange-500/30 bg-orange-500/5 space-y-1">
                    <p className="text-[8px] opacity-50 uppercase font-mono tracking-widest mb-1">Report_Reasons:</p>
                    {postReports.map(r => (
                      <p key={r.id} className={`text-[9px] ${reasonText} italic font-sans`}>
                        - "{r.content}"
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
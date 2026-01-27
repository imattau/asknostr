import React, { useState, useEffect, useMemo } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useStore } from '../store/useStore'
import { Post } from './Post'
import { Shield, Info, Filter, RefreshCw, ListFilter, ListChecks, Pin, Settings } from 'lucide-react'
import { nostrService } from '../services/nostr'
import { triggerHaptic } from '../utils/haptics'
import { useUiStore } from '../store/useUiStore'
import { useDeletions } from '../hooks/useDeletions'
import { useSubscriptions } from '../hooks/useSubscriptions'

interface CommunityFeedProps {
  communityId: string
  creator: string
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ communityId, creator }) => {
  const { data: community, isLoading: isCommLoading } = useCommunity(communityId, creator)
  const { events, user } = useStore()
  const [isModeratedOnly, setIsModeratedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'hot' | 'top' | 'new'>('new')
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const { pushLayer } = useUiStore()
  const { subscribedCommunities, toggleSubscription, isUpdating } = useSubscriptions()

  const communityATag = `34550:${creator}:${communityId}`
  const isSubscribed = subscribedCommunities.includes(communityATag)

  const communityEvents = events.filter(e => 
    e.tags.some(t => t[0] === 'a' && t[1] === communityATag) ||
    e.tags.some(t => t[0] === 't' && t[1].toLowerCase() === communityId.toLowerCase())
  )

  const eventIds = communityEvents.map(e => e.id)
  const moderators = community?.moderators || []
  const { data: approvals = [] } = useApprovals(eventIds, moderators, community?.relays)
  const { data: deletedIds = [] } = useDeletions(eventIds)

  // Advanced Status Logic: Group approvals by event ID and find the latest one
  const eventStatusMap = useMemo(() => {
    const map: Record<string, string> = {}
    approvals.forEach(a => {
      const eTarget = a.tags.find(t => t[0] === 'e')?.[1]
      const status = a.tags.find(t => t[0] === 'status')?.[1] || 'approved'
      if (eTarget) {
        // Only override if this approval is newer
        if (!map[eTarget] || a.created_at > (approvals.find(old => old.id === eTarget)?.created_at || 0)) {
          map[eTarget] = status
        }
      }
    })
    return map
  }, [approvals])

  const filteredEvents = (isModeratedOnly
    ? communityEvents.filter(e => !!eventStatusMap[e.id] && eventStatusMap[e.id] !== 'spam')
    : communityEvents).filter(e => !deletedIds.includes(e.id) && eventStatusMap[e.id] !== 'spam')

  const pinnedEvents = filteredEvents.filter(e => community?.pinned.includes(e.id) || eventStatusMap[e.id] === 'pinned')
  const regularEvents = filteredEvents.filter(e => !community?.pinned.includes(e.id) && eventStatusMap[e.id] !== 'pinned')

  const isUserModerator = moderators.includes(user.pubkey || '') || creator === user.pubkey
  const isCreator = creator === user.pubkey

  useEffect(() => {
    if (community?.relays && community.relays.length > 0) {
      nostrService.addRelays(community.relays)
    }
    
    const sub = nostrService.subscribe(
      [{ kinds: [34550], authors: [creator], '#d': [communityId], limit: 1 }],
      () => {},
      community?.relays
    )

    return () => {
      sub.then(s => s.close())
    }
  }, [communityId, creator, community?.relays])

  const handlePublish = async () => {
    if (!postContent.trim() || !user.pubkey) return
    setIsPublishing(true)
    try {
      const tags = [
        ['a', communityATag, '', 'root'],
        ['t', communityId]
      ]
      
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: postContent,
      }

      const signedEvent = await window.nostr?.signEvent(eventTemplate)
      if (signedEvent) {
        await nostrService.publish(signedEvent)
        setPostContent('')
        triggerHaptic(20)
      }
    } catch (e) {
      console.error('Failed to publish', e)
    } finally {
      setIsPublishing(false)
    }
  }

  if (isCommLoading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 font-mono text-[10px] uppercase tracking-widest">
        <RefreshCw size={16} className="animate-spin mr-2" />
        Synchronizing_Node_Data...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#05070A]">
      <div className="glassmorphism m-4 p-6 rounded-xl border-slate-800 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full -mr-16 -mt-16 group-hover:bg-purple-500/20 transition-all duration-700" />
        
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 neon-bloom-violet">
              {community?.image ? (
                <img src={community.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-purple-500 font-mono font-bold text-xl">
                  {communityId[0].toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-50 tracking-tighter uppercase leading-none mb-1">
                {community?.name || communityId}
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-mono text-[9px] font-bold border border-purple-500/20">
                  REF://34550
                </span>
                <span className="text-[10px] text-slate-500 font-mono">ID: {communityId.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 bg-green-500/5 px-2 py-1 rounded-full border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]">
              <Shield size={10} /> MODS:{moderators.length}
            </div>
            {user.pubkey && (
              <button 
                onClick={() => toggleSubscription(communityATag)}
                disabled={isUpdating}
                className={`text-[10px] font-bold uppercase px-3 py-1 rounded border transition-all ${isSubscribed ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]'}`}
              >
                {isUpdating ? 'SYNCING...' : isSubscribed ? 'LEAVE_NODE' : 'JOIN_STATION'}
              </button>
            )}
          </div>
        </div>

        {community?.description && (
          <p className="mt-4 text-sm text-slate-400 font-sans leading-relaxed max-w-2xl opacity-80 group-hover:opacity-100 transition-opacity">
            {community.description}
          </p>
        )}

        <div className="mt-6 flex items-center gap-4 border-t border-white/5 pt-4">
          <button 
            onClick={() => setIsModeratedOnly(!isModeratedOnly)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono text-[10px] font-bold transition-all border ${isModeratedOnly ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]' : 'bg-white/5 text-slate-500 border-white/5 hover:text-slate-300'}`}
          >
            <Filter size={14} /> {isModeratedOnly ? 'ACTIVE_MODERATION' : 'RAW_NETWORK_FEED'}
          </button>

          <div className="flex bg-white/5 rounded-lg border border-white/5 p-0.5">
            {(['new', 'hot', 'top'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-3 py-1 rounded-md text-[9px] font-bold uppercase transition-all ${sortBy === s ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'text-slate-500 hover:text-slate-300'}`}
              >
                {s}
              </button>
            ))}
          </div>
          
          {isUserModerator && (
            <button 
              onClick={() => pushLayer({ 
                id: `mod-queue-${communityId}`, 
                type: 'modqueue',
                title: 'Moderator_Control_Panel',
                params: { communityId, creator, moderators }
              })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 font-mono text-[10px] font-bold hover:bg-red-500/20 transition-all ml-auto"
            >
              <ListFilter size={14} /> ACCESS_MOD_QUEUE
            </button>
          )}
          <button 
            onClick={() => pushLayer({ 
              id: `mod-log-${communityId}`, 
              type: 'modlog',
              title: 'Transparency_Log',
              params: { communityId, creator }
            })}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-slate-500 border border-white/5 font-mono text-[10px] font-bold hover:text-slate-300 transition-all ${!isUserModerator ? 'ml-auto' : ''}`}
          >
            <ListChecks size={14} /> AUDIT_TRAIL
          </button>
          {isCreator && (
            <button 
              onClick={() => pushLayer({ 
                id: `admin-${communityId}`, 
                type: 'communityadmin',
                title: 'Station_Admin',
                params: { communityId, creator }
              })}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono text-[10px] font-bold hover:bg-cyan-500/20 transition-all"
            >
              <Settings size={14} /> ADMIN_PANEL
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4">
        <div className="h-full flex flex-col space-y-4">
          <div className="glassmorphism p-4 rounded-xl border-slate-800/50 mb-2 shrink-0">
            <textarea 
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={!user.pubkey || isPublishing}
              className="w-full bg-transparent text-slate-200 border-none focus:ring-0 p-0 text-sm resize-none h-12 font-sans placeholder:text-slate-600"
              placeholder={`Share data with c/${communityId.toLowerCase()}...`}
            ></textarea>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <span className="text-[9px] font-mono text-slate-600 uppercase">Input_Mode: Secure_NIP07</span>
              <button 
                onClick={handlePublish}
                disabled={!user.pubkey || !postContent.trim() || isPublishing}
                className="terminal-button rounded-lg py-1.5 px-4 shadow-lg shadow-purple-500/20"
              >
                {isPublishing ? 'Transmitting...' : 'Transmit_Entry'}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pb-8">
            {community?.rules && (
              <div className="glassmorphism p-4 rounded-xl border-yellow-500/20 bg-yellow-500/5 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500/30" />
                <h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-yellow-500 uppercase mb-2 tracking-widest">
                  <Info size={14} /> Community_Directives
                </h4>
                <div className="text-[11px] text-slate-400 font-sans leading-relaxed italic">{community.rules}</div>
              </div>
            )}

            {pinnedEvents.length > 0 && (
              <div className="space-y-4 mb-8">
                <h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-purple-500 uppercase tracking-widest px-2">
                  <Pin size={12} className="rotate-45" /> Pinned_By_Moderators
                </h4>
                <div className="space-y-4">
                  {pinnedEvents.map(event => (
                    <Post 
                      key={event.id} 
                      event={event} 
                      isModerator={moderators.includes(event.pubkey)}
                      isApproved={true}
                    />
                  ))}
                </div>
                <div className="h-px bg-slate-800 mx-4" />
              </div>
            )}

            <div className="space-y-4">
              {regularEvents.length === 0 ? (
                <div className="text-center p-12 opacity-30 italic text-[10px]">
                  {pinnedEvents.length === 0 ? '[NO_POSTS_MATCHING_CRITERIA]' : '[END_OF_TRANSMISSION]'}
                </div>
              ) : (
                regularEvents.map(event => (
                  <Post 
                    key={event.id} 
                    event={event} 
                    isModerator={moderators.includes(event.pubkey)}
                    isApproved={approvals.some(a => a.tags.some(t => t[0] === 'e' && t[1] === event.id))}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useEffect, useMemo } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useStore } from '../store/useStore'
import { Post } from './Post'
import { Shield, Info, Filter, RefreshCw, Pin } from 'lucide-react'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { triggerHaptic } from '../utils/haptics'
import { useUiStore } from '../store/useUiStore'
import { useDeletions } from '../hooks/useDeletions'
import { useSubscriptions } from '../hooks/useSubscriptions'
import type { Event } from 'nostr-tools'

interface CommunityFeedProps {
  communityId: string
  creator: string
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ communityId, creator }) => {
  const { data: community, isLoading: isCommLoading } = useCommunity(communityId, creator)
  const { events, user, addEvent } = useStore()
  const [isModeratedOnly, setIsModeratedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'hot' | 'top' | 'new'>('new')
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const { pushLayer } = useUiStore()
  const { subscribedCommunities, toggleSubscription, isUpdating } = useSubscriptions()
  const [optimisticSub, setOptimisticSub] = useState<boolean | null>(null)
  
  const communityATag = `34550:${creator}:${communityId}`

  // Dedicated Community Post Fetching
  useEffect(() => {
    let sub: { close: () => void } | undefined
    
    const fetchCommunityPosts = async () => {
      sub = await nostrService.subscribe(
        [{ kinds: [1, 4550], '#a': [communityATag], limit: 100 }],
        (event: Event) => {
          addEvent(event)
        },
        community?.relays
      )
    }

    fetchCommunityPosts()
    return () => {
      sub?.close()
    }
  }, [communityATag, community?.relays, addEvent])

  const isSubscribed = optimisticSub !== null ? optimisticSub : subscribedCommunities.includes(communityATag)

  const handleToggle = () => {
    const nextState = !isSubscribed
    setOptimisticSub(nextState)
    toggleSubscription(communityATag)
    setTimeout(() => setOptimisticSub(null), 5000)
  }

  const communityEvents = events.filter(e => 
    e.tags.some(t => t[0] === 'a' && t[1] === communityATag) ||
    e.tags.some(t => t[0] === 't' && t[1].toLowerCase() === communityId.toLowerCase())
  )

  const eventIds = communityEvents.map(e => e.id)
  const moderators = community?.moderators || []
  const { data: approvals = [] } = useApprovals(eventIds, moderators, community?.relays)
  const { data: deletedIds = [] } = useDeletions(eventIds)

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

  // Whitelist: Authors who have at least one approved post
  const approvedAuthors = useMemo(() => {
    const authors = new Set<string>()
    approvals.forEach(a => {
      const pTag = a.tags.find(t => t[0] === 'p')?.[1]
      const status = a.tags.find(t => t[0] === 'status')?.[1] || 'approved'
      if (pTag && status === 'approved') {
        authors.add(pTag)
      }
    })
    return authors
  }, [approvals])

  const filteredEvents = communityEvents.filter(e => {
    if (deletedIds.includes(e.id)) return false
    if (eventStatusMap[e.id] === 'spam') return false

    const mode = community?.moderationMode || 'open'
    
    if (mode === 'restricted') {
      const isApproved = eventStatusMap[e.id] === 'approved' || eventStatusMap[e.id] === 'pinned'
      const isTrustedAuthor = approvedAuthors.has(e.pubkey) || moderators.includes(e.pubkey) || e.pubkey === creator
      return isApproved || isTrustedAuthor
    } else {
      if (isModeratedOnly) {
        return eventStatusMap[e.id] === 'approved' || eventStatusMap[e.id] === 'pinned'
      }
      return true
    }
  })

  const pinnedEvents = filteredEvents.filter(e => community?.pinned.includes(e.id) || eventStatusMap[e.id] === 'pinned')
  const regularEvents = filteredEvents.filter(e => !community?.pinned.includes(e.id) && eventStatusMap[e.id] !== 'pinned')

  const isUserModerator = moderators.includes(user.pubkey || '') || creator === user.pubkey
  const isCreator = creator === user.pubkey
  const isUnmoderated = moderators.length === 0

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

      const signedEvent = await signerService.signEvent(eventTemplate)
      const success = await nostrService.publish(signedEvent)
      
      if (success) {
        setPostContent('')
        addEvent(signedEvent)
        triggerHaptic(20)
      } else {
        alert('Broadcast failed: Could not reach any relays.')
      }
    } catch (e) {
      console.error('Failed to publish', e)
      alert(`Publish error: ${e instanceof Error ? e.message : 'Unknown'}`)
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
      <div className="shrink-0 z-10 bg-[#05070A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 neon-bloom-violet shadow-lg shadow-purple-500/20">
                {community?.image ? (
                  <img src={community.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-purple-500 font-mono font-bold text-lg">
                    {communityId[0].toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-50 tracking-tighter uppercase leading-none mb-0.5 truncate">
                  {community?.name || communityId}
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-slate-500 font-mono">c/{communityId}</span>
                  <div className="flex items-center gap-1 text-[8px] font-bold text-green-500 bg-green-500/5 px-1.5 py-0.5 rounded border border-green-500/20">
                    <Shield size={8} /> {moderators.length}
                  </div>
                </div>
              </div>
            </div>
            
            {user.pubkey && (
              <button 
                onClick={handleToggle}
                disabled={isUpdating}
                className={`flex-shrink-0 text-[9px] font-bold uppercase px-3 py-1.5 rounded border transition-all ${isSubscribed ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-red-500/10 hover:text-red-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}
              >
                {isUpdating ? '...' : isSubscribed ? 'Leave' : 'Join'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-4 px-4">
            <button 
              onClick={() => setIsModeratedOnly(!isModeratedOnly)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold transition-all border ${isModeratedOnly ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-slate-500 border-white/5'}`}
            >
              <Filter size={10} /> {isModeratedOnly ? 'MODERATED' : 'RAW'}
            </button>

            <div className="flex-shrink-0 flex bg-white/5 rounded border border-white/5 p-0.5">
              {(['new', 'hot', 'top'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${sortBy === s ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            
            <div className="w-px h-4 bg-slate-800 mx-1 flex-shrink-0" />

            {isUserModerator && (
              <button 
                onClick={() => pushLayer({ 
                  id: `mod-queue-${communityId}`, 
                  type: 'modqueue',
                  title: 'Mod_Queue',
                  params: { communityId, creator, moderators }
                })}
                className="flex-shrink-0 px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[9px] font-bold uppercase hover:bg-red-500/20"
              >
                Queue
              </button>
            )}
            <button 
              onClick={() => pushLayer({ 
                id: `mod-log-${communityId}`, 
                type: 'modlog',
                title: 'Log',
                params: { communityId, creator }
              })}
              className="flex-shrink-0 px-2 py-1 rounded bg-white/5 text-slate-500 border border-white/5 text-[9px] font-bold uppercase hover:text-slate-300"
            >
              Log
            </button>
            {isCreator && (
              <button 
                onClick={() => pushLayer({ 
                  id: `admin-${communityId}`, 
                  type: 'communityadmin',
                  title: 'Admin',
                  params: { communityId, creator }
                })}
                className="flex-shrink-0 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold uppercase hover:bg-cyan-500/20"
              >
                Settings
              </button>
            )}
            {isUnmoderated && community && (
              <button 
                onClick={() => pushLayer({ 
                  id: `claim-${communityId}`, 
                  type: 'claimstation',
                  title: 'Authority_Claim',
                  params: { community }
                })}
                className="flex-shrink-0 px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[9px] font-bold uppercase hover:bg-orange-500/20"
              >
                Claim
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className="glassmorphism p-3 rounded-xl border-slate-800/50">
            <textarea 
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={!user.pubkey || isPublishing}
              className="w-full bg-transparent text-slate-200 border-none focus:ring-0 p-0 text-xs resize-none h-10 font-sans placeholder:text-slate-600"
              placeholder={`Post to c/${communityId}...`}
            ></textarea>
            <div className="flex justify-end mt-2 pt-2 border-t border-white/5">
              <button 
                onClick={handlePublish}
                disabled={!user.pubkey || !postContent.trim() || isPublishing}
                className="terminal-button rounded py-1 px-3 text-[9px]"
              >
                {isPublishing ? '...' : 'Post'}
              </button>
            </div>
          </div>

          {community?.rules && (
            <div className="glassmorphism p-3 rounded-xl border-yellow-500/20 bg-yellow-500/5">
              <h4 className="flex items-center gap-2 font-mono font-bold text-[9px] text-yellow-500 uppercase mb-1 tracking-widest">
                <Info size={10} /> Rules
              </h4>
              <div className="text-[10px] text-slate-400 font-sans leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer">
                {community.rules}
              </div>
            </div>
          )}

          {pinnedEvents.length > 0 && (
            <div className="space-y-4 mb-8">
              <h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-purple-500 uppercase tracking-widest px-2">
                <Pin size={12} className="rotate-45" /> Pinned
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
  )
}
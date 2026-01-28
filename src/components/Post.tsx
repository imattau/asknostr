import React, { useState } from 'react'
import type { Event } from 'nostr-tools'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'
import { Heart, Repeat2, Zap, Trash2, Maximize2, Shield, CheckCircle, AlertTriangle, Share2 } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useProfile } from '../hooks/useProfile'
import { useReactions } from '../hooks/useReactions'
import { useZaps } from '../hooks/useZaps'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { zapService } from '../services/zapService'
import { triggerHaptic } from '../utils/haptics'

interface PostProps {
  event: Event
  isThreadView?: boolean
  isModerator?: boolean
  isApproved?: boolean
  opPubkey?: string
}

const PostComponent: React.FC<PostProps> = ({
  event,
  isThreadView = false,
  isModerator = false,
  isApproved = false,
  opPubkey
}) => {
  const { data: profile, isLoading: isProfileLoading } = useProfile(event.pubkey)
  const { data: reactionData, isLoading: isReactionsLoading } = useReactions(event.id)
  const { data: zapData, isLoading: isZapsLoading } = useZaps(event.id)
  const { user, addOptimisticReaction, optimisticReactions, addOptimisticApproval, optimisticApprovals, addEvent } = useStore()
  const { subscribedCommunities } = useSubscriptions()
  const { layout, stack, pushLayer } = useUiStore()
  
  const npub = formatPubkey(event.pubkey)
  const displayPubkey = profile?.display_name || profile?.name || shortenPubkey(npub)
  const isOwnPost = user.pubkey === event.pubkey
  const isOP = opPubkey === event.pubkey
  const contentWarning = event.tags.find(t => t[0] === 'content-warning')
  const isNsfw = !!contentWarning || event.tags.some(t => t[0] === 't' && t[1]?.toLowerCase() === 'nsfw')
  const warningLabel = contentWarning?.[1] || 'NSFW'
  const [isRevealed, setIsRevealed] = useState(false)
  const isHidden = isNsfw && !isRevealed

  const isOptimisticallyApproved = optimisticApprovals.includes(event.id)
  const effectiveApproved = isApproved || isOptimisticallyApproved

  const eventReactions = reactionData?.reactions || []
  const aggregatedReactions = reactionData?.aggregated || {}

  const postOptimistic = optimisticReactions[event.id] || {}
  
  const hasUserReacted = (emoji: string) => {
    if (!user.pubkey) return false
    const real = eventReactions.some(r => r.pubkey === user.pubkey && r.content === emoji)
    const optimistic = postOptimistic[emoji]?.includes(user.pubkey)
    return real || optimistic
  }

  const getReactionCount = (emoji: string, baseCount: number) => {
    if (!user.pubkey) return baseCount
    const real = eventReactions.some(r => r.pubkey === user.pubkey && r.content === emoji)
    const optimistic = postOptimistic[emoji]?.includes(user.pubkey)
    return baseCount + (optimistic && !real ? 1 : 0)
  }

  const mediaRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov))/gi
  const mediaMatches = event.content.match(mediaRegex)

  const openThread = (e: React.MouseEvent, options?: { force?: boolean }) => {
    if (!options?.force && (e.target as HTMLElement).closest('button')) return

    pushLayer({
      id: `thread-${event.id}`,
      type: 'thread',
      title: 'Thread_Context',
      params: { eventId: event.id, rootEvent: event }
    })
  }

  const openProfile = (e: React.MouseEvent) => {
    e.stopPropagation()
    pushLayer({
      id: `profile-${event.pubkey}-${Date.now()}`,
      type: 'profile-view',
      title: `Profile_${shortenPubkey(npub)}`,
      params: { pubkey: event.pubkey }
    })
  }

  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)

  const handleLike = async (emoji: string = '+') => {
    if (!user.pubkey) {
      alert('Please login to react.')
      return
    }
    
    const alreadyReacted = eventReactions.some(r => r.pubkey === user.pubkey && r.content === emoji)
    if (alreadyReacted || hasUserReacted(emoji)) return

    triggerHaptic(15)
    addOptimisticReaction(event.id, user.pubkey, emoji)

    try {
      const likeEvent = {
        kind: 7,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id],
          ['p', event.pubkey]
        ],
        content: emoji,
      }
      const signedEvent = await signerService.signEvent(likeEvent)
      await nostrService.publish(signedEvent)
    } catch (e) {
      console.error('Like failed', e)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Broadcast deletion request for this entry?')) return
    try {
      const deleteEvent = {
        kind: 5,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', event.id]],
        content: 'Deletion requested by user.',
      }
      const signedEvent = await signerService.signEvent(deleteEvent)
      await nostrService.publish(signedEvent)
      alert('Deletion broadcasted.')
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  const handleApprove = async (forcedStatus?: string) => {
    let status = forcedStatus
    if (!status) {
      status = window.prompt('Specify status (approved, pinned, spam):', 'approved') || ''
    }
    if (!status) return
    
    if (status === 'approved') addOptimisticApproval(event.id)
    triggerHaptic(30)

    try {
      // Find the community tag from the original post
      const communityTag = event.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
      if (!communityTag) {
        console.warn('Cannot approve: Post is not tagged with a community "a" tag.')
        return
      }

      const approveEvent = {
        kind: 4550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
          ['status', status],
          communityTag // Critical for the Moderation Log (Audit Trail)
        ],
        content: `Post marked as ${status} by moderator.`,
      }
      const signedEvent = await signerService.signEvent(approveEvent)
      await nostrService.publish(signedEvent)
    } catch (e) {
      console.error('Approval failed', e)
    }
  }

  const handleReport = async () => {
    const reason = window.prompt('Specify reason for report (Kind 1984):')
    if (!reason) return

    try {
      const communityTag = event.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
      const tags = [
        ['e', event.id, reason],
        ['p', event.pubkey]
      ]
      if (communityTag) tags.push(communityTag)

      const reportEvent = {
        kind: 1984,
        created_at: Math.floor(Date.now() / 1000),
        tags: tags,
        content: reason,
      }
      const signedEvent = await signerService.signEvent(reportEvent)
      await nostrService.publish(signedEvent)
      triggerHaptic(10)
      alert('Report broadcasted to the network.')
    } catch (e) {
      console.error('Report failed', e)
    }
  }

  const shareToCommunity = async (aTag: string) => {
    if (shareLoading) return
    setShareLoading(true)
    try {
      const tags: string[][] = [
        ['e', event.id, '', 'root'],
        ['a', aTag, '', 'root']
      ]
      const eventTemplate = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags,
        content: `Shared post from ${shortenPubkey(npub)}`
      }
      const signedEvent = await signerService.signEvent(eventTemplate)
      await nostrService.publish(signedEvent)
      addEvent(signedEvent)
      triggerHaptic(30)
    } catch (e) {
      console.error('Share failed', e)
      alert('Unable to share at this time.')
    } finally {
      setShareLoading(false)
      setIsShareOpen(false)
    }
  }

  const handleZap = async (amount: number) => {
    if (!profile?.lud16) {
      alert('Recipient has no lightning address (LUD-16) configured.')
      return
    }

    triggerHaptic(25)
    try {
      await zapService.sendZap(event, profile.lud16, amount)
    } catch (err) {
      console.error('Zap failed', err)
      alert(err instanceof Error ? err.message : 'Failed to initiate zap.')
    }
  }

  const currentLayer = stack[stack.length - 1]
  const layerParams = currentLayer?.params as { moderators?: string[] } | undefined
  const isUserModerator = currentLayer?.type === 'community' && 
                         layerParams?.moderators?.includes(user.pubkey || '')

  return (
    <div 
      onClick={openThread}
      className={`glassmorphism p-4 group transition-all duration-300 relative ${!isThreadView ? 'hover:bg-white/10 cursor-pointer' : ''} ${effectiveApproved ? 'border-l-4 border-l-green-500' : 'border-l border-slate-800'}`}
    >
      {effectiveApproved && !isThreadView && (
        <div className="absolute -top-2 -left-2 bg-slate-950 text-green-500 border border-green-500/50 p-0.5 rounded-full z-10 shadow-[0_0_10px_rgba(34,197,94,0.4)]">
          <CheckCircle size={14} />
        </div>
      )}

      <div className="flex justify-between mb-3 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openProfile}
            className="flex items-center gap-2 focus-visible:outline focus-visible:ring focus-visible:ring-cyan-500 rounded-lg"
          >
            <div className="w-6 h-6 rounded-full border border-slate-800 overflow-hidden bg-slate-900 flex items-center justify-center">
              {isProfileLoading ? (
                <div className="w-full h-full animate-pulse bg-slate-800" />
              ) : profile?.picture ? (
                <img src={profile.picture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-[8px] text-slate-400">?</span>
              )}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className={`font-bold tracking-tight text-slate-50 ${isProfileLoading ? 'animate-pulse' : ''}`} title={npub}>
                  {displayPubkey}
                </span>
                {isOP && (
                  <span className="text-[8px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 rounded font-mono font-bold uppercase ml-1">
                    OP
                  </span>
                )}
                {isModerator && (
                  <Shield size={12} className="text-green-500 fill-green-500/10" />
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono lowercase opacity-70">{formatDate(event.created_at)}</span>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-3">
          {isUserModerator && !effectiveApproved && (
            <div className="flex gap-1">
              <button 
                onClick={(e) => { e.stopPropagation(); handleApprove('approved'); }}
                className="text-green-500 hover:text-green-400 bg-green-500/10 px-2 py-0.5 rounded transition-all flex items-center gap-1 font-mono hover:bg-green-500/20"
                title="Approve Post"
              >
                <Shield size={10} /> <span className="text-[9px] font-bold uppercase">OK</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleApprove('spam'); }}
                className="text-red-500 hover:text-red-400 bg-red-500/10 px-2 py-0.5 rounded transition-all flex items-center gap-1 font-mono hover:bg-red-500/20"
                title="Reject/Spam"
              >
                <Trash2 size={10} /> <span className="text-[9px] font-bold uppercase">BAN</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); handleApprove('pinned'); }}
                className="text-purple-500 hover:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded transition-all flex items-center gap-1 font-mono hover:bg-purple-500/20"
                title="Pin Post"
              >
                <Maximize2 size={10} className="rotate-45" /> <span className="text-[9px] font-bold uppercase">PIN</span>
              </button>
            </div>
          )}
          {isOwnPost && (
            <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="text-red-500/50 hover:text-red-500 transition-all">
              <Trash2 size={12} />
            </button>
          )}
          {!isThreadView && layout === 'swipe' && (
            <Maximize2 size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-500" />
          )}
          <span className="text-slate-500 font-mono text-[9px] uppercase tracking-widest bg-slate-900/50 px-1 rounded border border-slate-800">k:{event.kind}</span>
        </div>
      </div>
      
      <div className="relative mb-4">
        <div className={`whitespace-pre-wrap break-words text-slate-300 leading-relaxed font-sans ${isThreadView ? 'text-lg text-slate-50' : 'text-sm'} ${isHidden ? 'blur-sm select-none pointer-events-none' : ''}`}>
          {event.content}
        </div>
        {isHidden && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 border border-red-500/30 rounded-lg">
            <div className="flex flex-col items-center gap-2 text-center px-4">
              <span className="text-[10px] font-mono uppercase text-red-400 tracking-widest">{warningLabel}</span>
              <button
                onClick={(e) => { e.stopPropagation(); setIsRevealed(true) }}
                className="text-[10px] font-bold uppercase px-3 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                View
              </button>
            </div>
          </div>
        )}
      </div>

      {mediaMatches && mediaMatches.length > 0 && (
        <div className="mt-4 space-y-2 mb-4 overflow-hidden rounded-lg relative">
          {mediaMatches.map((url, idx) => {
            const isVideo = url.match(/\.(mp4|webm|mov)$/i)
            return (
              <div key={idx} className={`relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group/media ${isHidden ? 'blur-sm' : ''}`}>
                {isVideo ? (
                  <video 
                    src={url} 
                    controls 
                    className="max-h-[400px] w-full"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <img 
                    src={url} 
                    alt="Media content" 
                    className="max-h-[500px] w-full object-contain cursor-zoom-in"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(url, '_blank')
                    }}
                  />
                )}
              </div>
            )
          })}
          {isHidden && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 border border-red-500/30 rounded-lg">
              <button
                onClick={(e) => { e.stopPropagation(); setIsRevealed(true) }}
                className="text-[10px] font-bold uppercase px-3 py-1 rounded border border-red-500/40 text-red-300 hover:bg-red-500/10"
              >
                View NSFW Media
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(aggregatedReactions).map(([emoji, data]) => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); handleLike(emoji); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] transition-all ${hasUserReacted(emoji) ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
          >
            <span>{emoji === '+' ? '❤️' : emoji}</span>
            <span className="font-bold">{getReactionCount(emoji, data.count)}</span>
          </button>
        ))}
        {user.pubkey && (
          <div className="flex gap-1">
            {['🔥', '🤙', '🫡', '⚡'].map(emoji => (
              <button
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleLike(emoji); }}
                className={`opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 p-0.5 ${hasUserReacted(emoji) ? '' : 'grayscale hover:grayscale-0'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-8 text-[10px] uppercase font-bold text-slate-400">
        {user.pubkey && (
          <div className="relative overflow-visible">
            <button
              onClick={(e) => { e.stopPropagation(); setIsShareOpen(prev => !prev) }}
              className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn"
            >
              <Share2 size={12} className="group-hover/btn:scale-110 transition-transform" />
              <span>{shareLoading ? 'Sharing...' : 'Share'}</span>
            </button>
            {isShareOpen && (
              <div className="absolute left-0 top-full mt-2 w-48 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-[9999]">
                {subscribedCommunities.length === 0 ? (
                  <div className="p-3 text-[10px] font-mono uppercase text-slate-500">Join a community to share</div>
                ) : (
                  subscribedCommunities.map(aTag => {
                    const parts = aTag.split(':')
                    const communityId = parts[2] || aTag
                    return (
                      <button
                        key={aTag}
                        onClick={async (e) => {
                          e.stopPropagation()
                          await shareToCommunity(aTag)
                        }}
                        disabled={shareLoading}
                        className="w-full text-left px-3 py-2 text-[10px] uppercase tracking-[0.2em] hover:bg-slate-900/80 transition-colors disabled:opacity-40"
                      >
                        {communityId}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )}
        <button className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn">
          <Repeat2 size={12} className="group-hover/btn:scale-110 transition-transform" />
          <span>Repost</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className={`flex items-center gap-1.5 transition-colors group/btn ${hasUserReacted('+') ? 'text-red-500' : 'hover:text-red-500 text-slate-400'}`}
        >
          <Heart size={12} className={`group-hover/btn:scale-110 transition-transform ${isReactionsLoading ? 'animate-pulse' : ''} ${hasUserReacted('+') ? 'fill-red-500/20' : ''}`} />
          <span>{getReactionCount('+', eventReactions.filter(r => r.content === '+' || r.content === '').length)} Like</span>
        </button>
        <div className="relative group/zap">
          <button 
            onClick={(e) => { e.stopPropagation(); triggerHaptic(20); }}
            className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors group/btn"
          >
            <Zap size={12} className={`group-hover/btn:scale-110 transition-transform ${isZapsLoading ? 'animate-pulse' : ''} ${zapData?.total ? 'text-yellow-500 fill-yellow-500/20' : ''}`} />
            <span>{zapData?.total ? `${zapData.total} sats` : 'Zap'}</span>
          </button>
          
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover/zap:flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg shadow-2xl z-50">
            {[21, 100, 1000].map(amt => (
              <button
                key={amt}
                onClick={(e) => { e.stopPropagation(); handleZap(amt); }}
                className="text-[8px] font-bold px-2 py-1 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-black rounded transition-all"
              >
                {amt}
              </button>
            ))}
          </div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); handleReport(); }}
          className="flex items-center gap-1.5 hover:text-orange-500 transition-colors group/btn ml-auto opacity-30 hover:opacity-100"
        >
          <AlertTriangle size={12} />
          <span>Report</span>
        </button>
      </div>
    </div>
  )
}

export const Post = React.memo(
  PostComponent,
  (prev, next) =>
    prev.event.id === next.event.id &&
    prev.event.content === next.event.content &&
    prev.event.created_at === next.event.created_at &&
    prev.isThreadView === next.isThreadView &&
    prev.isModerator === next.isModerator &&
    prev.isApproved === next.isApproved &&
    prev.opPubkey === next.opPubkey
)

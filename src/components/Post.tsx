import React from 'react'
import type { Event } from 'nostr-tools'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'
import { Heart, MessageSquare, Repeat2, Zap, Trash2, Maximize2, Shield, CheckCircle, AlertTriangle } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { useReactions } from '../hooks/useReactions'
import { useZaps } from '../hooks/useZaps'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { triggerHaptic } from '../utils/haptics'

interface PostProps {
  event: Event
  isThreadView?: boolean
  isModerator?: boolean
  isApproved?: boolean
  opPubkey?: string
}

export const Post: React.FC<PostProps> = ({
  event,
  isThreadView = false,
  isModerator = false,
  isApproved = false,
  opPubkey
}) => {
  const { data: profile, isLoading: isProfileLoading } = useProfile(event.pubkey)
  const { data: reactionData, isLoading: isReactionsLoading } = useReactions(event.id)
  const { data: zapData, isLoading: isZapsLoading } = useZaps(event.id)
  const { user, addOptimisticReaction, optimisticReactions, addOptimisticApproval, optimisticApprovals } = useStore()
  const { layout, stack, pushLayer } = useUiStore()
  
  const npub = formatPubkey(event.pubkey)
  const displayPubkey = profile?.display_name || profile?.name || shortenPubkey(npub)
  const isOwnPost = user.pubkey === event.pubkey
  const isOP = opPubkey === event.pubkey

  const isOptimisticallyApproved = optimisticApprovals.includes(event.id)
  const effectiveApproved = isApproved || isOptimisticallyApproved

  const eventReactions = reactionData?.reactions || []
  const aggregatedReactions = reactionData?.aggregated || {}

  const optimisticLikes = optimisticReactions[event.id] || []
  const hasOptimisticLike = user.pubkey && optimisticLikes.includes(user.pubkey)
  const hasRealLike = user.pubkey && eventReactions.some(r => r.pubkey === user.pubkey)
  
  const totalLikes = eventReactions.length + (hasOptimisticLike && !hasRealLike ? 1 : 0)

  const mediaRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov))/gi
  const mediaMatches = event.content.match(mediaRegex)

  const openThread = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    
    if (layout === 'swipe') {
      pushLayer({
        id: `thread-${event.id}`,
        type: 'thread',
        title: 'Thread_Context',
        params: { eventId: event.id, rootEvent: event }
      })
    }
  }

  const handleLike = async (emoji: string = '+') => {
    if (!user.pubkey || !window.nostr) {
      alert('Please login to react.')
      return
    }
    
    const alreadyReacted = eventReactions.some(r => r.pubkey === user.pubkey && r.content === emoji)
    if (alreadyReacted || (emoji === '+' && hasOptimisticLike)) return

    triggerHaptic(15)
    if (emoji === '+') addOptimisticReaction(event.id, user.pubkey)

    try {
      // eslint-disable-next-line react-hooks/purity
      const now = Math.floor(Date.now() / 1000)
      const likeEvent = {
        kind: 7,
        created_at: now,
        tags: [
          ['e', event.id],
          ['p', event.pubkey]
        ],
        content: emoji,
      }
      const signedEvent = await window.nostr.signEvent(likeEvent)
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
      const signedEvent = await window.nostr?.signEvent(deleteEvent)
      if (signedEvent) {
        await nostrService.publish(signedEvent)
        alert('Deletion broadcasted.')
      }
    } catch (e) {
      console.error('Delete failed', e)
    }
  }

  const handleApprove = async () => {
    const status = window.prompt('Specify status (approved, pinned, spam):', 'approved')
    if (status === null) return
    
    addOptimisticApproval(event.id)
    triggerHaptic(30)

    try {
      const communityTag = event.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
      if (!communityTag) return

      const approveEvent = {
        kind: 4550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
          ['status', status],
          communityTag
        ],
        content: `Post marked as ${status} by moderator.`,
      }
      const signedEvent = await window.nostr?.signEvent(approveEvent)
      if (signedEvent) {
        await nostrService.publish(signedEvent)
      }
    } catch (e) {
      console.error('Approval failed', e)
    }
  }

  const handleReport = async () => {
    const reason = window.prompt('Specify reason for report (Kind 1984):')
    if (!reason || !window.nostr) return

    try {
      const reportEvent = {
        kind: 1984,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id, reason],
          ['p', event.pubkey]
        ],
        content: reason,
      }
      const signedEvent = await window.nostr.signEvent(reportEvent)
      await nostrService.publish(signedEvent)
      triggerHaptic(10)
      alert('Report broadcasted to the network.')
    } catch (e) {
      console.error('Report failed', e)
    }
  }

  const handleZap = (amount: number) => {
    triggerHaptic(25)
    alert(`Initiating lightning payment for ${amount} sats to ${shortenPubkey(npub)}... [SIMULATED]`)
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
          {isProfileLoading ? (
            <div className="w-6 h-6 bg-slate-800 animate-pulse rounded-full" />
          ) : profile?.picture ? (
            <img src={profile.picture} alt="" className="w-6 h-6 rounded-full border border-slate-800 object-cover" />
          ) : (
            <div className="w-6 h-6 border border-slate-800 rounded-full flex items-center justify-center text-[8px] bg-slate-900 text-slate-400">?</div>
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className={`font-bold tracking-tight text-slate-50 ${isProfileLoading ? 'animate-pulse' : ''}`} title={npub}>
                {displayPubkey}
              </span>
              {isOP && (
                <span className="text-[8px] bg-purple-500/20 text-purple-400 border border-purple-500/30 px-1 rounded font-mono font-bold uppercase ml-1">OP</span>
              )}
              {isModerator && (
                <Shield size={12} className="text-green-500 fill-green-500/10" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono lowercase opacity-70">{formatDate(event.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isUserModerator && !effectiveApproved && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleApprove(); }}
              className="text-cyan-500 hover:text-cyan-400 px-1 rounded transition-all flex items-center gap-1 font-mono"
            >
              <Shield size={12} /> <span className="text-[10px] font-bold uppercase">[APPROVE]</span>
            </button>
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
      
      <div className={`whitespace-pre-wrap break-words text-slate-300 leading-relaxed mb-4 font-sans ${isThreadView ? 'text-lg text-slate-50' : 'text-sm'}`}>
        {event.content}
      </div>

      {mediaMatches && mediaMatches.length > 0 && (
        <div className="mt-4 space-y-2 mb-4 overflow-hidden rounded-lg">
          {mediaMatches.map((url, idx) => {
            const isVideo = url.match(/\.(mp4|webm|mov)$/i)
            return (
              <div key={idx} className="relative bg-slate-900 border border-slate-800 rounded-lg overflow-hidden group/media">
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
        </div>
      )}
      
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(aggregatedReactions).map(([emoji, data]) => (
          <button
            key={emoji}
            onClick={(e) => { e.stopPropagation(); handleLike(emoji); }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] transition-all ${user.pubkey && data.pubkeys.includes(user.pubkey) ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'}`}
          >
            <span>{emoji === '+' ? '❤️' : emoji}</span>
            <span className="font-bold">{data.count}</span>
          </button>
        ))}
        {user.pubkey && (
          <div className="flex gap-1">
            {['🔥', '🤙', '🫡', '⚡'].map(emoji => (
              <button
                key={emoji}
                onClick={(e) => { e.stopPropagation(); handleLike(emoji); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity hover:scale-125 p-0.5 grayscale hover:grayscale-0"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-8 text-[10px] uppercase font-bold text-slate-400">
        <button className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn">
          <MessageSquare size={12} className="group-hover/btn:scale-110 transition-transform" />
          <span>Reply</span>
        </button>
        <button className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn">
          <Repeat2 size={12} className="group-hover/btn:scale-110 transition-transform" />
          <span>Repost</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className={`flex items-center gap-1.5 transition-colors group/btn ${(hasOptimisticLike || hasRealLike) ? 'text-red-500' : 'hover:text-red-500 text-slate-400'}`}
        >
          <Heart size={12} className={`group-hover/btn:scale-110 transition-transform ${isReactionsLoading ? 'animate-pulse' : ''} ${(hasOptimisticLike || hasRealLike) ? 'fill-red-500/20' : ''}`} />
          <span>{totalLikes} Like</span>
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
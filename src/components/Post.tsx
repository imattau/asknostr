import React from 'react'
import type { Event } from 'nostr-tools'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'
import { Heart, MessageSquare, Repeat2, Zap, Trash2, Maximize2, Shield, CheckCircle } from 'lucide-react'
import { useProfile } from '../hooks/useProfile'
import { useReactions } from '../hooks/useReactions'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { triggerHaptic } from '../utils/haptics'

interface PostProps {
  event: Event
  isThreadView?: boolean
  isModerator?: boolean
  isApproved?: boolean
}

export const Post: React.FC<PostProps> = ({ event, isThreadView = false, isModerator = false, isApproved = false }) => {
  const { data: profile, isLoading: isProfileLoading } = useProfile(event.pubkey)
  const { data: eventReactions = [], isLoading: isReactionsLoading } = useReactions(event.id)
  const { user } = useStore()
  const { pushLayer, layout, stack } = useUiStore()
  
  const npub = formatPubkey(event.pubkey)
  const displayPubkey = profile?.display_name || profile?.name || shortenPubkey(npub)
  const isOwnPost = user.pubkey === event.pubkey

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
    if (!window.confirm('Approve this post for the community?')) return
    try {
      const communityTag = event.tags.find(t => t[0] === 'a' && t[1].startsWith('34550:'))
      if (!communityTag) return

      const approveEvent = {
        kind: 4550,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['e', event.id],
          ['p', event.pubkey],
          communityTag
        ],
        content: 'Post approved by moderator.',
      }
      const signedEvent = await window.nostr?.signEvent(approveEvent)
      if (signedEvent) {
        await nostrService.publish(signedEvent)
        triggerHaptic(30)
      }
    } catch (e) {
      console.error('Approval failed', e)
    }
  }

  const currentLayer = stack[stack.length - 1]
  const layerParams = currentLayer?.params as { moderators?: string[] } | undefined
  const isUserModerator = currentLayer?.type === 'community' && 
                         layerParams?.moderators?.includes(user.pubkey || '')

  return (
    <div 
      onClick={openThread}
      className={`glassmorphism p-4 group transition-all duration-300 relative ${!isThreadView ? 'hover:bg-white/10 cursor-pointer' : ''} ${isApproved ? 'border-l-4 border-l-green-500' : 'border-l border-slate-800'}`}
    >
      {isApproved && !isThreadView && (
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
              {isModerator && (
                <Shield size={12} className="text-green-500 fill-green-500/10" title="Community Moderator" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 font-mono lowercase opacity-70">{formatDate(event.created_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isUserModerator && !isApproved && (
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
          onClick={(e) => { e.stopPropagation(); triggerHaptic(15); }}
          className="flex items-center gap-1.5 hover:text-red-500 transition-colors group/btn"
        >
          <Heart size={12} className={`${eventReactions.length > 0 ? 'text-red-500 fill-red-500/20' : ''} group-hover/btn:scale-110 transition-transform ${isReactionsLoading ? 'animate-pulse' : ''}`} />
          <span>{eventReactions.length} Like</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); triggerHaptic(20); }}
          className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors group/btn"
        >
          <Zap size={12} className="group-hover/btn:scale-110 transition-transform" />
          <span>Zap</span>
        </button>
      </div>
    </div>
  )
}
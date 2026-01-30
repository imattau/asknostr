import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { nip19, type Event } from 'nostr-tools'
import { formatPubkey, shortenPubkey, formatDate } from '../utils/nostr'
import { Heart, Repeat2, Zap, Trash2, Maximize2, Shield, CheckCircle, AlertTriangle, Share2, Hash, MessageSquare } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useProfile } from '../hooks/useProfile'
import { useReactions } from '../hooks/useReactions'
import { useZaps } from '../hooks/useZaps'
import { useReplyCount } from '../hooks/useReplyCount'
import { useStore } from '../store/useStore'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { zapService } from '../services/zapService'
import { torrentService } from '../services/torrentService'
import { triggerHaptic } from '../utils/haptics'
import { TorrentMedia } from './TorrentMedia'

interface PostProps {
  event: Event
  isThreadView?: boolean
  isModerator?: boolean
  isApproved?: boolean
  opPubkey?: string
  depth?: number
}

const NostrLink: React.FC<{ link: string; onClick: (link: string) => void }> = ({ link, onClick }) => {
  const { theme } = useUiStore()
  const entity = link.replace('nostr:', '')
  let pubkey = ''
  let type: 'profile' | 'other' = 'other'

  try {
    const decoded = nip19.decode(entity)
    if (decoded.type === 'npub') {
      pubkey = decoded.data as string
      type = 'profile'
    } else if (decoded.type === 'nprofile') {
      pubkey = (decoded.data as { pubkey: string }).pubkey // More specific type
      type = 'profile'
    }
  } catch (error) { // Changed 'e' to 'error' and will log
    console.error('Failed to decode nostr entity in NostrLink', error)
  }

  const { data: profile } = useProfile(pubkey)
  const label = type === 'profile' && profile 
    ? (profile.display_name || profile.name || shortenPubkey(entity))
    : shortenPubkey(entity)

  const textColor = theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'

  return (
    <button 
      onClick={(e) => {
        e.stopPropagation()
        onClick(link)
      }}
      className={`${textColor} hover:underline font-mono text-[11px] bg-cyan-500/10 px-1 rounded mx-0.5 inline-flex items-center gap-1`}
    >
      <Hash size={10} className="opacity-50" />
      {label}
    </button>
  )
}

const PostComponent: React.FC<PostProps> = ({
  event,
  isThreadView = false,
  isModerator = false,
  isApproved = false,
  opPubkey,
  depth = 0
}) => {
  const { data: profile, isLoading: isProfileLoading } = useProfile(event.pubkey)
  const { data: reactionData, isLoading: isReactionsLoading } = useReactions(event.id)
  const { data: zapData, isLoading: isZapsLoading } = useZaps(event.id)
  const { data: replyCount = 0, isLoading: isReplyCountLoading } = useReplyCount(event.id)
  const { user, addOptimisticReaction, optimisticReactions, addOptimisticApproval, optimisticApprovals, optimisticDeletions, addOptimisticDeletion } = useStore()
  const { subscribedCommunities } = useSubscriptions()
  const { layout, stack, pushLayer, theme } = useUiStore()
  
  const [isSeedingLocally, setIsSeedingLocally] = useState(false)

  useEffect(() => {
    const checkSeeding = () => {
      const active = torrentService.getActiveTorrents()
      const magnetRegex = /magnet:\?xt=urn:btih:([a-zA-Z0-9]+)/gi
      const matches = [...event.content.matchAll(magnetRegex)]
      const infoHashes = matches.map(m => m[1].toLowerCase())
      
      const isSeeding = active.some((t: any) => infoHashes.includes(t.infoHash.toLowerCase()))
      setIsSeedingLocally(isSeeding)
    }

    checkSeeding()
    const interval = setInterval(checkSeeding, 10000)
    return () => clearInterval(interval)
  }, [event.content])

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-slate-300'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const bgHover = theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/10'
  const accentPurple = theme === 'light' ? 'text-purple-600' : 'text-purple-400'
  const accentCyan = theme === 'light' ? 'text-cyan-600' : 'text-cyan-400'
  const reactionBtnClass = theme === 'light' 
    ? 'bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300' 
    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'

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

  const eventReactions = (reactionData?.reactions || []).filter(r => !optimisticDeletions.includes(r.id))
  const aggregatedReactions = reactionData?.aggregated || {}

  const postOptimistic = optimisticReactions[event.id] || {}
  
  const hasUserReacted = (emoji: string) => {
    if (!user.pubkey) return false
    const real = eventReactions.some(r => r.pubkey === user.pubkey && r.content === emoji)
    const optimistic = postOptimistic[emoji]?.includes(user.pubkey)
    return (real || optimistic)
  }

  const getReactionCount = (emoji: string, baseCount: number) => {
    if (!user.pubkey) return baseCount
    
    // Count real reactions that aren't deleted
    const realCount = (reactionData?.reactions || [])
      .filter(r => r.content === emoji && !optimisticDeletions.includes(r.id))
      .length
    
    const optimistic = postOptimistic[emoji]?.includes(user.pubkey)
    const alreadyHasReal = (reactionData?.reactions || [])
      .some(r => r.pubkey === user.pubkey && r.content === emoji && !optimisticDeletions.includes(r.id))

    return realCount + (optimistic && !alreadyHasReal ? 1 : 0)
  }

  const mediaRegex = /(https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov))/gi
  const mediaMatches = event.content.match(mediaRegex)

  const magnetRegex = /(magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s]*)/gi
  const magnetMatches = event.content.match(magnetRegex)

  const openThread = (e: React.MouseEvent, options?: { force?: boolean }) => {
    if (!options?.force && (e.target as HTMLElement).closest('button')) return

    const currentLayer = stack[stack.length - 1]
    const isRoot = !event.tags.some(t => t[0] === 'e')
    const fromFeed = currentLayer?.type === 'feed'

    pushLayer({
      id: `thread-${event.id}-${Date.now()}`,
      type: 'thread',
      title: (isRoot || fromFeed) ? 'Thread_Context' : 'Context_Drill_Down',
      params: { 
        eventId: event.id, 
        rootEvent: event,
        forceFullThread: isRoot || fromFeed
      }
    })
  }

  const openProfile = (e: React.MouseEvent) => {
    e.stopPropagation()
    pushLayer({
      id: `profile-${event.pubkey}-${Date.now()}`,
      type: 'profile-view',
      title: `Profile_${shortenPubkey(formatPubkey(event.pubkey))}`,
      params: { pubkey: event.pubkey }
    })
  }

  const [isShareOpen, setIsShareOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const shareBtnRef = React.useRef<HTMLButtonElement>(null)

  const handleLike = async (emoji: string = '+') => {
    if (!user.pubkey) {
      alert('Please login to react.')
      return
    }
    
    const existingReaction = (reactionData?.reactions || []).find(
      r => r.pubkey === user.pubkey && r.content === emoji && !optimisticDeletions.includes(r.id)
    )

    const isOptimistic = postOptimistic[emoji]?.includes(user.pubkey)

    triggerHaptic(15)

    if (existingReaction || isOptimistic) {
      // Toggle off: Send deletion request if we have a real event ID
      if (existingReaction) {
        addOptimisticDeletion(existingReaction.id)
        try {
          const deleteEvent = {
            kind: 5,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['e', existingReaction.id]],
            content: 'Removing reaction.',
          }
          const signedEvent = await signerService.signEvent(deleteEvent)
          await nostrService.publish(signedEvent)
        } catch (e) {
          console.error('Failed to remove reaction', e)
        }
      }
      return
    }

    // Toggle on: Add reaction
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
      await zapService.sendZap(event.pubkey, profile.lud16, amount, { eventId: event.id })
    } catch (err) {
      console.error('Zap failed', err)
      alert(err instanceof Error ? err.message : 'Failed to initiate zap.')
    }
  }

  const handleNostrLink = (link: string) => {
    const entity = link.replace('nostr:', '')
    try {
      const decoded = nip19.decode(entity)
      if (decoded.type === 'npub' || decoded.type === 'nprofile') {
        const pubkey = decoded.type === 'npub' ? decoded.data : (decoded.data as { pubkey: string }).pubkey // More specific type
        pushLayer({
          id: `profile-${pubkey}-${Date.now()}`,
          type: 'profile-view',
          title: `Profile_${shortenPubkey(formatPubkey(pubkey))}`,
          params: { pubkey }
        })
      } else if (decoded.type === 'note' || decoded.type === 'nevent') {
        const id = decoded.type === 'note' ? decoded.data : (decoded.data as { id: string }).id // More specific type
        pushLayer({
          id: `thread-${id}`,
          type: 'thread',
          title: 'Thread_Context',
          params: { 
            eventId: id,
            forceFullThread: true
          }
        })
      }
    } catch (error) { // Changed 'e' to 'error'
      console.error('Failed to decode nostr entity', error)
    }
  }

  const contentBody = useMemo(() => {
    const mediaRegexNoCapture = /https?:\/\/[^\s]+?\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov)/gi
    const magnetRegexNoCapture = /magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s]*/gi
    
    const textParts = event.content.split(new RegExp(`${mediaRegexNoCapture.source}|${magnetRegexNoCapture.source}`, 'gi'))
    const linkRegex = /(https?:\/\/[^\s]+|nostr:(?:npub|nprofile|note|nevent|naddr|nrelay)1[a-z0-9]+|#\w+|magnet:\?xt=urn:btih:[a-zA-Z0-9]+[^\s]*)/gi

    const elements: (string | React.ReactNode)[] = []

    textParts.forEach((part, i) => {
      const subParts = part.split(linkRegex)
      const matches = part.match(linkRegex)

      if (!matches) {
        elements.push(part)
        return
      }

      let matchIndex = 0
      subParts.forEach((subPart, j) => {
        if (matches.includes(subPart)) {
          const match = matches[matchIndex++]
          if (match.startsWith('nostr:')) {
            elements.push(
              <NostrLink 
                key={`${i}-${j}`}
                link={match}
                onClick={handleNostrLink}
              />
            )
          } else if (match.startsWith('#')) {
            elements.push(
              <button
                key={`${i}-${j}`}
                onClick={(e) => {
                  e.stopPropagation()
                  pushLayer({
                    id: `search-${match}-${Date.now()}`,
                    type: 'search',
                    title: 'Tag_Search',
                    params: { initialQuery: match }
                  })
                }}
                className={`${accentPurple} hover:underline font-mono text-[11px] bg-purple-500/10 px-1 rounded mx-0.5`}
              >
                {match}
              </button>
            )
          } else if (match.startsWith('magnet:')) {
            elements.push(
              <span key={`${i}-${j}`} className="text-purple-400 font-mono text-[10px] bg-purple-500/10 px-1 rounded mx-0.5 inline-flex items-center gap-1">
                <Share2 size={10} /> TORRENT_ENCODED
              </span>
            )
          } else {
            elements.push(
              <a 
                key={`${i}-${j}`}
                href={match}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`${accentPurple} hover:underline break-all`}
              >
                {match}
              </a>
            )
          }
        } else {
          elements.push(subPart)
        }
      })
    })

    const finalContent = elements.filter(e => e !== '')
    if (finalContent.length === 0 && ((mediaMatches && mediaMatches.length > 0) || (magnetMatches && magnetMatches.length > 0))) return null

    return (
      <div className={`whitespace-pre-wrap break-words ${secondaryText} leading-relaxed font-sans ${isThreadView ? `text-lg ${primaryText}` : 'text-sm'} ${isHidden ? 'blur-sm select-none pointer-events-none' : ''}`}>
        {finalContent}
      </div>
    )
  }, [event.content, isThreadView, isHidden, theme]) // Re-run if content or vital display state changes

  const currentLayer = stack[stack.length - 1]
  const layerParams = currentLayer?.params as { moderators?: string[] } | undefined
  const isUserModerator = currentLayer?.type === 'community' && 
                         layerParams?.moderators?.includes(user.pubkey || '')

  if (event.kind === 4550) {
    const status = event.tags.find(t => t[0] === 'status')?.[1] || 'approved'
    const targetEventId = event.tags.find(t => t[0] === 'e')?.[1]
    
    const getStatusColor = () => {
      switch (status) {
        case 'approved': return 'text-green-400 border-green-500/30 bg-green-500/10'
        case 'pinned': return 'text-purple-400 border-purple-500/30 bg-purple-500/10'
        case 'spam': return 'text-red-400 border-red-500/30 bg-red-500/10'
        default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10'
      }
    }

    return (
      <div 
        className={`p-3 rounded-xl border flex items-center justify-between gap-4 transition-all hover:bg-white/5 cursor-pointer ${getStatusColor()}`}
        onClick={(e) => {
          if (targetEventId) {
            e.stopPropagation()
            pushLayer({
              id: `thread-${targetEventId}`,
              type: 'thread',
              title: 'Moderated_Content',
              params: { eventId: targetEventId }
            })
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-shrink-0 p-1.5 rounded-lg bg-black/20">
            <Shield size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-tight truncate">
              {displayPubkey} {status} a post
            </p>
            {event.content && (
              <p className="text-[9px] opacity-70 italic truncate">"{event.content}"</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[8px] font-mono opacity-40">{formatDate(event.created_at)}</span>
          <Maximize2 size={12} className="opacity-40" />
        </div>
      </div>
    )
  }

  if (event.kind === 1063) {
    const url = event.tags.find(t => t[0] === 'url')?.[1]
    const mime = event.tags.find(t => t[0] === 'm')?.[1]
    const alt = event.tags.find(t => t[0] === 'alt')?.[1]
    const dim = event.tags.find(t => t[0] === 'dim')?.[1]
    const size = event.tags.find(t => t[0] === 'size')?.[1]
    const isVideo = mime?.startsWith('video/')
    const isAudio = mime?.startsWith('audio/')

    return (
      <div className="glassmorphism p-4 rounded-xl border-slate-800 space-y-3">
        <div className="flex justify-between items-center mb-2">
          <button onClick={openProfile} className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-900 border border-slate-800">
              {profile?.picture && <img src={profile.picture} className="w-full h-full object-cover" />}
            </div>
            <span className="text-[10px] font-bold text-slate-400">{displayPubkey}</span>
          </button>
          <span className="text-[8px] font-mono opacity-30 uppercase tracking-widest">NIP-94 File_Metadata</span>
        </div>

        {url && (
          <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950/50">
            {isVideo ? (
              <video src={url} controls className="max-h-[400px] w-full" />
            ) : isAudio ? (
              <audio src={url} controls className="w-full p-2" />
            ) : (
              <img src={url} alt={alt || 'Media'} className="max-h-[500px] w-full object-contain" />
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-center pt-2 border-t border-white/5">
          {mime && <span className="text-[9px] font-mono text-cyan-500 bg-cyan-500/5 px-1.5 py-0.5 rounded border border-cyan-500/20">{mime.toUpperCase()}</span>}
          {dim && <span className="text-[9px] font-mono text-slate-500">{dim}</span>}
          {size && <span className="text-[9px] font-mono text-slate-500">{(parseInt(size) / 1024 / 1024).toFixed(2)} MB</span>}
          {event.content && <p className="text-[11px] text-slate-300 italic w-full mt-1">"{event.content}"</p>}
        </div>
      </div>
    )
  }

  const bgColorClass = theme === 'light' ? 'bg-white' : depth % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950';

  return (
    <div 
      onClick={openThread}
      data-event-id={event.id}
      className={`glassmorphism p-4 group transition-all duration-300 relative ${bgColorClass} ${!isThreadView ? `${bgHover} cursor-pointer` : ''} ${effectiveApproved ? 'border-l-4 border-l-green-500' : `border-l ${borderClass}`}`}
    >
      {effectiveApproved && !isThreadView && (
        <div className={`${theme === 'light' ? 'bg-white' : 'bg-slate-950'} text-green-500 border border-green-500/50 p-0.5 rounded-full z-10 shadow-[0_0_10px_rgba(34,197,94,0.4)] absolute -top-2 -left-2`}>
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
            <div className={`w-6 h-6 rounded-full border ${borderClass} overflow-hidden ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'} flex items-center justify-center`}>
              {isProfileLoading ? (
                <div className={`w-full h-full animate-pulse ${theme === 'light' ? 'bg-slate-200' : 'bg-slate-800'}`} />
              ) : profile?.picture ? (
                <img src={profile.picture} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className={`text-[8px] ${mutedText}`}>?</span>
              )}
            </div>
            <div className="flex flex-col min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className={`font-bold tracking-tight ${primaryText} ${isProfileLoading ? 'animate-pulse' : ''}`} title={npub}>
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
                {isSeedingLocally && (
                  <div className="flex items-center gap-1 ml-1" title="You are seeding this content">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shadow-[0_0_5px_rgba(168,85,247,0.5)]" />
                    <span className="text-[7px] font-bold text-purple-400 uppercase">Seeding</span>
                  </div>
                )}
              </div>
              <span className={`text-[10px] ${mutedText} font-mono lowercase opacity-70`}>{formatDate(event.created_at)}</span>
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
          <div className="flex gap-1 items-center">
            {(() => {
              const isReply = event.tags.some(t => t[0] === 'e')
              return isReply ? (
                <span className={`${accentPurple} font-mono text-[8px] uppercase tracking-wider bg-purple-500/10 px-1 rounded border border-purple-500/20`}>REPLY</span>
              ) : (
                <span className={`${accentCyan} font-mono text-[8px] uppercase tracking-wider bg-cyan-500/10 px-1 rounded border border-cyan-500/20`}>ROOT</span>
              )
            })()}
            <span className={`${mutedText} font-mono text-[9px] uppercase tracking-widest ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900/50'} px-1 rounded border ${borderClass}`}>k:{event.kind}</span>
          </div>
        </div>
      </div>
      
      <div className="relative mb-4">
        {contentBody}
        {isHidden && (
          <div className={`absolute inset-0 flex items-center justify-center ${theme === 'light' ? 'bg-white/90' : 'bg-slate-950/70'} border border-red-500/30 rounded-lg`}>
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
          {mediaMatches.map((url, idx) => (
            <div key={idx} className={`relative ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'} border ${borderClass} rounded-lg overflow-hidden group/media ${isHidden ? 'blur-sm' : ''} min-h-[100px] flex items-center justify-center`}>
              {url.match(/\.(mp4|webm|mov)$/i) ? (
                <video 
                  src={url} 
                  preload="metadata"
                  controls 
                  className="max-h-[500px] w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img 
                  src={url} 
                  alt="Media content" 
                  loading="lazy"
                  decoding="async"
                  className="max-h-[500px] w-full object-contain cursor-zoom-in transition-opacity duration-300 opacity-0"
                  onLoad={(e) => {
                    (e.target as HTMLImageElement).classList.remove('opacity-0');
                    (e.target as HTMLImageElement).classList.add('opacity-100');
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(url, '_blank')
                  }}
                />
              )}
            </div>
          ))}
          {isHidden && (
            <div className={`absolute inset-0 flex items-center justify-center ${theme === 'light' ? 'bg-white/90' : 'bg-slate-950/70'} border border-red-500/30 rounded-lg`}>
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

      {magnetMatches && magnetMatches.length > 0 && (
        <div className="mt-4 space-y-2 mb-4 overflow-hidden rounded-lg relative">
          {magnetMatches.map((uri, idx) => {
            // Try to find a corresponding fallback URL tag
            const fallbackUrl = event.tags.find(t => t[0] === 'url')?.[1]
            return (
              <div key={idx} className={isHidden ? 'blur-md' : ''} onClick={(e) => e.stopPropagation()}>
                <TorrentMedia magnetUri={uri} fallbackUrl={fallbackUrl} />
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
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] transition-all ${hasUserReacted(emoji) ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' : reactionBtnClass}`}
          >
            <span className="flex items-center leading-none">{emoji === '+' ? '❤️' : emoji}</span>
            <span className="font-bold leading-none">{getReactionCount(emoji, data.count)}</span>
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

      <div className={`flex gap-8 text-[10px] uppercase font-bold ${mutedText}`}>
        <button 
          onClick={openThread}
          className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn"
        >
          <MessageSquare size={12} className={`group-hover/btn:scale-110 transition-transform ${isReplyCountLoading ? 'animate-pulse' : ''}`} />
          <span className="leading-none">{replyCount || 0} Replies</span>
        </button>
        {user.pubkey && (
          <div className="relative overflow-visible">
            <button
              ref={shareBtnRef}
              onClick={(e) => { e.stopPropagation(); setIsShareOpen(prev => !prev) }}
              className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn"
            >
              <Share2 size={12} className="group-hover/btn:scale-110 transition-transform" />
              <span>{shareLoading ? 'Sharing...' : 'Share'}</span>
            </button>
            {isShareOpen && createPortal(
              <>
                <div 
                  className="fixed inset-0 z-[10000]" 
                  onClick={(e) => { e.stopPropagation(); setIsShareOpen(false); }} 
                />
                <div 
                  className={`fixed ${theme === 'light' ? 'bg-white' : 'bg-slate-950'} border ${borderClass} rounded-xl shadow-2xl z-[10001] w-48 animate-in fade-in zoom-in-95 duration-100`}
                  style={{
                    top: (shareBtnRef.current?.getBoundingClientRect().top || 0) - 10,
                    left: (shareBtnRef.current?.getBoundingClientRect().left || 0),
                    transform: 'translateY(-100%)'
                  }}
                >
                  <div className={`p-2 border-b ${theme === 'light' ? 'border-slate-100' : 'border-white/5'} text-[8px] opacity-40 tracking-widest text-center uppercase`}>Target_Station</div>
                  <div className="max-h-60 overflow-y-auto custom-scrollbar">
                    {subscribedCommunities.length === 0 ? (
                      <div className={`p-3 text-[9px] font-mono uppercase ${mutedText} text-center italic`}>Join a community first</div>
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
                            className={`w-full text-left px-3 py-2 text-[10px] uppercase tracking-[0.2em] ${bgHover} transition-colors disabled:opacity-40 border-b ${theme === 'light' ? 'border-slate-50' : 'border-white/5'} last:border-0`}
                          >
                            <span className={secondaryText}>{communityId}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </>,
              document.body
            )}
          </div>
        )}
        <button className="flex items-center gap-1.5 hover:text-cyan-500 transition-colors group/btn">
          <Repeat2 size={12} className="group-hover/btn:scale-110 transition-transform" />
          <span className="leading-none">Repost</span>
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className={`flex items-center gap-1.5 transition-colors group/btn ${hasUserReacted('+') ? 'text-red-500' : `hover:text-red-500 ${mutedText}`}`}
        >
          <Heart size={12} className={`group-hover/btn:scale-110 transition-transform ${isReactionsLoading ? 'animate-pulse' : ''} ${hasUserReacted('+') ? 'fill-red-500/20' : ''}`} />
          <span className="leading-none">{getReactionCount('+', eventReactions.filter(r => r.content === '+' || r.content === '').length)} Like</span>
        </button>
        <div className="relative group/zap">
          <button 
            onClick={(e) => { e.stopPropagation(); triggerHaptic(20); }}
            className="flex items-center gap-1.5 hover:text-yellow-500 transition-colors group/btn"
          >
            <Zap size={12} className={`group-hover/btn:scale-110 transition-transform ${isZapsLoading ? 'animate-pulse' : ''} ${zapData?.total ? 'text-yellow-500 fill-yellow-500/20' : ''}`} />
            <span className="leading-none">{zapData?.total ? `${zapData.total} sats` : 'Zap'}</span>
          </button>
          
          <div className={`absolute bottom-full left-0 mb-2 hidden group-hover/zap:flex gap-1 ${theme === 'light' ? 'bg-white' : 'bg-slate-900'} border ${borderClass} p-1 rounded-lg shadow-2xl z-50`}>
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
          <span className="leading-none">Report</span>
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
    prev.opPubkey === next.opPubkey &&
    prev.depth === next.depth &&
    // Check for deep equality or simplified markers if needed, but for now ID is enough
    // since we memoized the hooks themselves
    true
)

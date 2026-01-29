import React, { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useStore } from '../store/useStore'
import { Post } from './Post'
import { VirtualFeed } from './VirtualFeed'
import { Shield, Info, Filter, RefreshCw, Pin, Paperclip, Loader2, User } from 'lucide-react'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { mediaService } from '../services/mediaService'
import { triggerHaptic } from '../utils/haptics'
import { useUiStore } from '../store/useUiStore'
import { useDeletions } from '../hooks/useDeletions'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useLabels } from '../hooks/useLabels'
import { useSocialGraph } from '../hooks/useSocialGraph'
import { useUserSearch } from '../hooks/useUserSearch'
import { formatPubkey, shortenPubkey } from '../utils/nostr'
import { nip19, type Event } from 'nostr-tools'

// Defined outside to prevent focus loss
const HashtagTextarea = ({ 
  value, 
  onChange, 
  placeholder, 
  disabled, 
  mentionQuery, 
  setMentionQuery, 
  userSuggestions, 
  onInsertMention 
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null)

  const renderHighlighted = (text: string) => {
    const parts = text.split(/(#\w+|nostr:(?:npub|nprofile)1[a-z0-9]+)/gi)
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return <span key={i} className="text-purple-400 font-bold">{part}</span> 
      }
      if (part.startsWith('nostr:')) {
        return <span key={i} className="text-cyan-400 font-bold">{part.slice(0, 15)}...</span>
      }
      return part
    })
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    const cursor = e.target.selectionStart
    onChange(e)

    const textBeforeCursor = val.slice(0, cursor)
    const lastAt = textBeforeCursor.lastIndexOf('@')
    if (lastAt !== -1 && !textBeforeCursor.slice(lastAt).includes(' ')) {
      const query = textBeforeCursor.slice(lastAt + 1)
      if (query.length >= 2) {
        setMentionQuery(query)
      } else {
        setMentionQuery('')
      }
    } else {
      setMentionQuery('')
    }
  }

  const rect = containerRef.current?.getBoundingClientRect()
  const showBelow = rect ? rect.top < 300 : false

  return (
    <div ref={containerRef} className="relative w-full min-h-[2.5rem] mt-1 font-sans text-xs leading-5">
      {mentionQuery && userSuggestions.length > 0 && rect && createPortal(
        <div 
          className="fixed bg-slate-950 border border-slate-800 rounded-xl overflow-y-auto z-[999999] shadow-2xl animate-in slide-in-from-bottom-2 w-64 max-h-48"
          style={{
            top: showBelow ? rect.bottom + 10 : rect.top - 10,
            left: rect.left,
            transform: showBelow ? 'none' : 'translateY(-100%)'
          }}
        >
          {userSuggestions.map((res: any) => (
            <button
              key={res.pubkey}
              onClick={() => onInsertMention(res.pubkey)}
              className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left border-b border-white/5 last:border-0"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10">
                {res.profile?.picture ? <img src={res.profile.picture} className="w-full h-full object-cover" /> : <User size={16} className="m-auto text-slate-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-100 truncate">{res.profile?.display_name || res.profile?.name || shortenPubkey(formatPubkey(res.pubkey))}</p>
                <p className="text-[9px] text-slate-500 font-mono truncate">{res.pubkey}</p>
              </div>
            </button>
          ))}
        </div>,
        document.body
      )}
      <div 
        className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-transparent p-0 m-0 border-none"
        style={{ lineHeight: '1.25rem', font: 'inherit', padding: '0', wordBreak: 'break-word' }}
        aria-hidden="true"
      >
        {renderHighlighted(value)}
      </div>
      <textarea
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className="w-full bg-transparent text-slate-200 border-none focus:ring-0 p-0 m-0 resize-none h-10 min-h-[2.5rem] relative z-10 font-inherit"
        style={{ lineHeight: '1.25rem', font: 'inherit', wordBreak: 'break-word' }}
        placeholder={placeholder}
      />
    </div>
  )
}

interface CommunityFeedProps {
  communityId: string
  creator: string
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ communityId, creator }) => {
  const { data: community, isLoading: isCommLoading } = useCommunity(communityId, creator)
  const { events, user, addEvent, markAsRead } = useStore()
  const { muted } = useSocialGraph()
  const [isModeratedOnly, setIsModeratedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'hot' | 'top' | 'new'>('new')
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isNsfw, setIsNsfw] = useState(false)
  const { pushLayer } = useUiStore()
  const { subscribedCommunities, toggleSubscription, isUpdating } = useSubscriptions()
  const [optimisticSub, setOptimisticSub] = useState<boolean | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [mentionQuery, setMentionQuery] = useState('')
  const { data: userSuggestions = [] } = useUserSearch(mentionQuery)

  const communityATag = `34550:${creator}:${communityId}`
  const { data: labels = [] } = useLabels(communityATag)

  // Mark as read on mount
  useEffect(() => {
    if (user.pubkey) {
      markAsRead(communityATag)
    }
  }, [communityATag, user.pubkey, markAsRead])

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

  const filteredEvents = useMemo(() => communityEvents.filter(e => {
    if (deletedIds.includes(e.id)) return false
    if (eventStatusMap[e.id] === 'spam') return false
    if (muted.includes(e.pubkey)) return false
    const isReply = e.tags.some(t => t[0] === 'e')
    if (isReply) return false
    const mode = community?.moderationMode || 'open'
    if (mode === 'restricted') {
      const isApproved = eventStatusMap[e.id] === 'approved' || eventStatusMap[e.id] === 'pinned'
      const authors = new Set<string>()
      approvals.forEach(a => {
        const pTag = a.tags.find(t => t[0] === 'p')?.[1]
        if (pTag && (a.tags.find(t => t[0] === 'status')?.[1] || 'approved') === 'approved') authors.add(pTag)
      })
      const isTrustedAuthor = authors.has(e.pubkey) || moderators.includes(e.pubkey) || e.pubkey === creator
      return isApproved || isTrustedAuthor
    } else {
      if (isModeratedOnly) return eventStatusMap[e.id] === 'approved' || eventStatusMap[e.id] === 'pinned'
      return true
    }
  }), [communityEvents, deletedIds, eventStatusMap, isModeratedOnly, community, moderators, creator, approvals])

  const computeEngagement = (event: Event) => {
    return event.tags.reduce((score, tag) => {
      if (['p', 'e', 'r', 'a'].includes(tag[0])) return score + 1
      return score
    }, 0)
  }

  const hotScore = (event: Event) => {
    const ageSeconds = Math.max(1, Math.floor(Date.now() / 1000) - event.created_at)
    return (computeEngagement(event) + 1) / ageSeconds
  }

  const sortedEvents = useMemo(() => {
    const copy = [...filteredEvents]
    switch (sortBy) {
      case 'hot':
        return copy.sort((a, b) => (hotScore(b) - hotScore(a)) || b.created_at - a.created_at)
      case 'top':
        return copy.sort((a, b) => (computeEngagement(b) - computeEngagement(a)) || b.created_at - a.created_at)
      case 'new':
      default:
        return copy.sort((a, b) => b.created_at - a.created_at)
    }
  }, [filteredEvents, sortBy])

  const pinnedEvents = sortedEvents.filter(e => community?.pinned.includes(e.id) || eventStatusMap[e.id] === 'pinned')
  const regularEvents = sortedEvents.filter(e => !community?.pinned.includes(e.id) && eventStatusMap[e.id] !== 'pinned')

  const isUserModerator = moderators.includes(user.pubkey || '') || creator === user.pubkey
  const isCreator = creator === user.pubkey
  const isUnmoderated = moderators.length === 0

  useEffect(() => {
    if (community?.relays && community.relays.length > 0) nostrService.addRelays(community.relays)
    const sub = nostrService.subscribe([{ kinds: [34550], authors: [creator], '#d': [communityId], limit: 1 }], () => {}, community?.relays)
    return () => { sub.then(s => s.close()) }
  }, [communityId, creator, community?.relays])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingMedia(true)
    try {
      const url = await mediaService.uploadFile(file)
      setPostContent(prev => prev ? `${prev}\n${url}` : url)
    } catch (err) {
      console.error('Upload failed', err)
      alert(err instanceof Error ? err.message : 'Failed to upload media')
    } finally {
      setIsUploadingMedia(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePublish = async () => {
    if (!postContent.trim() || !user.pubkey) return
    setIsPublishing(true)
    try {
      const tags = [['a', communityATag, '', 'root'], ['t', communityId]]
      if (isNsfw) tags.push(['content-warning', 'nsfw'])
      const hashtags = postContent.match(/#\w+/g)
      if (hashtags) {
        hashtags.forEach(tag => {
          const cleanTag = tag.replace('#', '').toLowerCase()
          if (!tags.some(t => t[0] === 't' && t[1] === cleanTag)) tags.push(['t', cleanTag])
        })
      }
      const mentions = postContent.match(/nostr:(npub1[a-z0-9]+|nprofile1[a-z0-9]+)/gi)
      if (mentions) {
        mentions.forEach(m => {
          try {
            const entity = m.replace('nostr:', '')
            const decoded = nip19.decode(entity)
            if (decoded.type === 'npub') tags.push(['p', decoded.data as string])
            else if (decoded.type === 'nprofile') tags.push(['p', (decoded.data as any).pubkey])
          } catch (e) {}
        })
      }
      const eventTemplate = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content: postContent }
      const signedEvent = await signerService.signEvent(eventTemplate)
      const success = await nostrService.publish(signedEvent)
      if (success) {
        setPostContent(''); setIsNsfw(false); addEvent(signedEvent); triggerHaptic(20)
      } else { alert('Broadcast failed') }
    } catch (e) {
      console.error('Failed to publish', e); alert('Publish error')
    } finally { setIsPublishing(false) }
  }

  const onInsertMention = (pubkey: string) => {
    const npub = nip19.npubEncode(pubkey)
    const lastAt = postContent.lastIndexOf('@')
    const before = postContent.slice(0, lastAt)
    const after = postContent.slice(lastAt + 1 + mentionQuery.length)
    setPostContent(`${before}nostr:${npub}${after}`)
    setMentionQuery('')
  }

  if (isCommLoading) return <div className="flex items-center justify-center h-full text-slate-500 font-mono text-[10px] uppercase tracking-widest"><RefreshCw size={16} className="animate-spin mr-2" />Synchronizing_Node_Data...</div>

  return (
    <div className="flex flex-col h-full bg-[#05070A]">
      <div className="shrink-0 z-10 bg-[#05070A]/95 backdrop-blur-xl border-b border-slate-800">
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 overflow-hidden flex-shrink-0 neon-bloom-violet shadow-lg shadow-purple-500/20">
                {community?.image ? <img src={community.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-purple-500 font-mono font-bold text-lg">{communityId[0].toUpperCase()}</div>}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-50 tracking-tighter uppercase leading-none mb-0.5 truncate">{community?.name || communityId}</h2>
                <div className="flex items-center gap-2"><span className="text-[9px] text-slate-500 font-mono">c/{communityId}</span><div className="flex items-center gap-1 text-[8px] font-bold text-green-500 bg-green-500/5 px-1.5 py-0.5 rounded border border-green-500/20"><Shield size={8} /> {moderators.length}</div></div>
                {labels.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{labels.slice(0, 6).map(label => <span key={label} className="text-[7px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">{label}</span>)}</div>}
              </div>
            </div>
            {user.pubkey && <button onClick={handleToggle} disabled={isUpdating} className={`flex-shrink-0 text-[9px] font-bold uppercase px-3 py-1.5 rounded border transition-all ${isSubscribed ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-red-500/10 hover:text-red-500' : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}>{isUpdating ? '...' : isSubscribed ? 'Leave' : 'Join'}</button>}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-4 px-4"><button onClick={() => setIsModeratedOnly(!isModeratedOnly)} className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold transition-all border ${isModeratedOnly ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-white/5 text-slate-500 border-white/5'}`}><Filter size={10} /> {isModeratedOnly ? 'MODERATED' : 'RAW'}</button><div className="flex-shrink-0 flex bg-white/5 rounded border border-white/5 p-0.5">{(['new', 'hot', 'top'] as const).map((s) => <button key={s} onClick={() => setSortBy(s)} className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${sortBy === s ? 'bg-purple-500 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{s}</button>)}</div><div className="w-px h-4 bg-slate-800 mx-1 flex-shrink-0" />{isUserModerator && <button onClick={() => pushLayer({ id: `mod-queue-${communityId}`, type: 'modqueue', title: 'Mod_Queue', params: { communityId, creator, moderators } })} className="flex-shrink-0 px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[9px] font-bold uppercase hover:bg-red-500/20">Queue</button>}<button onClick={() => pushLayer({ id: `mod-log-${communityId}`, type: 'modlog', title: 'Log', params: { communityId, creator } })} className="flex-shrink-0 px-2 py-1 rounded bg-white/5 text-slate-500 border border-white/5 text-[9px] font-bold uppercase hover:text-slate-300">Log</button>{isCreator && <button onClick={() => pushLayer({ id: `admin-${communityId}`, type: 'communityadmin', title: 'Admin', params: { communityId, creator } })} className="flex-shrink-0 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold uppercase hover:bg-cyan-500/20">Settings</button>}{isUnmoderated && community && <button onClick={() => pushLayer({ id: `claim-${communityId}`, type: 'claimstation', title: 'Authority_Claim', params: { community } })} className="flex-shrink-0 px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[9px] font-bold uppercase hover:bg-orange-500/20">Claim</button>}</div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <VirtualFeed events={regularEvents} isLoadingMore={false} onLoadMore={() => {}} header={
          <div className="p-4 space-y-4">
            <div className="glassmorphism p-3 rounded-xl border-slate-800/50">
              <HashtagTextarea value={postContent} onChange={(e: any) => setPostContent(e.target.value)} disabled={!user.pubkey || isPublishing} placeholder={`Post to c/${communityId}...`} mentionQuery={mentionQuery} setMentionQuery={setMentionQuery} userSuggestions={userSuggestions} onInsertMention={onInsertMention} />
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                <label className="flex items-center gap-2 text-[8px] font-mono uppercase text-slate-500"><input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-red-500" /> NSFW</label>
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
                  <button type="button" disabled={isUploadingMedia || !user.pubkey} onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 transition-colors disabled:opacity-50" title="Attach Media">{isUploadingMedia ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}</button>
                  <button onClick={handlePublish} disabled={!user.pubkey || !postContent.trim() || isPublishing} className="terminal-button rounded py-1 px-3 text-[9px]">{isPublishing ? '...' : 'Post'}</button>
                </div>
              </div>
            </div>
            {community?.rules && <div className="glassmorphism p-3 rounded-xl border-yellow-500/20 bg-yellow-500/5"><h4 className="flex items-center gap-2 font-mono font-bold text-[9px] text-yellow-500 uppercase mb-1 tracking-widest"><Info size={10} /> Rules</h4><div className="text-[10px] text-slate-400 font-sans leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer">{community.rules}</div></div>}
            {pinnedEvents.length > 0 && <div className="space-y-4 mb-8"><h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-purple-500 uppercase tracking-widest px-2"><Pin size={12} className="rotate-45" /> Pinned</h4><div className="space-y-4">{pinnedEvents.map(event => <Post key={event.id} event={event} isModerator={moderators.includes(event.pubkey)} isApproved={true} />)}</div><div className="h-px bg-slate-800 mx-4" /></div>}
          </div>
        } />
      </div>
    </div>
  )
}
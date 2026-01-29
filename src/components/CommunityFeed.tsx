import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useCommunity } from '../hooks/useCommunity'
import { useApprovals } from '../hooks/useApprovals'
import { useStore } from '../store/useStore'
import { Post } from './Post'
import { VirtualFeed } from './VirtualFeed'
import { Shield, Info, Filter, RefreshCw, Pin, Paperclip, Loader2, Share2 } from 'lucide-react'
import { nostrService } from '../services/nostr'
import { signerService } from '../services/signer'
import { mediaService } from '../services/mediaService'
import { torrentService } from '../services/torrentService'
import { triggerHaptic } from '../utils/haptics'
import { useUiStore } from '../store/useUiStore'
import { useDeletions } from '../hooks/useDeletions'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useLabels } from '../hooks/useLabels'
import { useSocialGraph } from '../hooks/useSocialGraph'
import { nip19, type Event } from 'nostr-tools'
import { MentionsInput, Mention } from 'react-mentions'
import { useFeed } from '../hooks/useFeed'


const mentionStyle = {
  control: {
    backgroundColor: 'transparent',
    fontSize: 12,
    lineHeight: '1.25rem',
    fontFamily: 'inherit',
  },
  '&multiLine': {
    control: {
      minHeight: 40,
    },
    highlighter: {
      padding: 0,
      border: 'none',
    },
    input: {
      padding: 0,
      margin: 0,
      border: 'none',
      outline: 'none',
      color: 'inherit',
    },
  },
  suggestions: {
    list: {
      backgroundColor: 'var(--background)',
      border: '1px solid var(--border-slate)',
      fontSize: 11,
      borderRadius: 12,
      overflow: 'hidden',
    },
    item: {
      padding: '6px 10px',
      borderBottom: '1px solid var(--border-slate)',
      color: 'var(--muted)',
      '&focused': {
        backgroundColor: 'rgba(255,255,255,0.05)',
        color: 'var(--accent-cyan)',
      },
    },
  },
}

const HashtagTextarea = ({
  value,
  onChange,
  placeholder,
  disabled,
  onUserSearch
}: {
  value: string;
  onChange: (event: { target: { value: string; }; }, newValue: string, newPlainTextValue: string, mentions: any[]) => void;
  placeholder?: string;
  disabled?: boolean;
  onUserSearch: (query: string, callback: (data: { id: string; display: string }[]) => void) => void;
}) => {
  return (
    <div className="relative w-full min-h-[2.5rem] mt-1 font-sans text-xs leading-5">
      <MentionsInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={mentionStyle}
        classNames={{
          input: 'focus:ring-0 w-full',
        }}
      >
        <Mention
          trigger="@"
          data={onUserSearch}
          displayTransform={(_id: string, display: string) => `@${display}`}
          markup="nostr:[id]"
          className="text-cyan-400 font-bold bg-cyan-500/10 px-0.5 rounded"
          appendSpaceOnAdd
        />
        <Mention
          trigger="#"
          data={(query: string) => [{ id: query, display: query }]}
          displayTransform={(_id: string, display: string) => `#${display}`}
          markup="#[id]"
          className="text-purple-400 font-bold bg-purple-500/10 px-0.5 rounded"
          appendSpaceOnAdd
        />
      </MentionsInput>
    </div>
  )
}

interface CommunityFeedProps {
  communityId: string
  creator: string
}

export const CommunityFeed: React.FC<CommunityFeedProps> = ({ communityId, creator }) => {
  const { data: community, isLoading: isCommLoading } = useCommunity(communityId, creator)
  
  const communityATag = `34550:${creator}:${communityId}`
  const { data: events = [] } = useFeed({
    filters: [{ kinds: [1, 4550], '#a': [communityATag], limit: 100 }],
    customRelays: community?.relays
  })

  const { user, markAsRead } = useStore()
  const { muted } = useSocialGraph()
  const [isModeratedOnly, setIsModeratedOnly] = useState(false)
  const [sortBy, setSortBy] = useState<'hot' | 'top' | 'new'>('new')
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isNsfw, setIsNsfw] = useState(false)
  const { pushLayer, theme } = useUiStore()
  const { subscribedCommunities, toggleSubscription, isUpdating } = useSubscriptions()
  const [optimisticSub, setOptimisticSub] = useState<boolean | null>(null)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const torrentInputRef = useRef<HTMLInputElement>(null)

  const primaryText = theme === 'light' ? 'text-slate-900' : 'text-slate-50'
  const secondaryText = theme === 'light' ? 'text-slate-600' : 'text-slate-300'
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400'
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800'
  const headerBg = theme === 'light' ? 'bg-white/95' : 'bg-[#05070A]/95'
  const containerBg = theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]'

  const { data: labels = [] } = useLabels(communityATag)

  useEffect(() => {
    if (user.pubkey) markAsRead(communityATag)
  }, [communityATag, user.pubkey, markAsRead])

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
  const moderators = useMemo(() => community?.moderators || [], [community?.moderators])
  const { data: approvals = [] } = useApprovals(eventIds, moderators, community?.relays)
  const { data: deletedIds = [] } = useDeletions(communityEvents) // Updated to pass events, not ids? Wait, useDeletions expects events now.

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
      return isApproved || authors.has(e.pubkey) || moderators.includes(e.pubkey) || e.pubkey === creator
    } else {
      return !isModeratedOnly || eventStatusMap[e.id] === 'approved' || eventStatusMap[e.id] === 'pinned'
    }
  }), [communityEvents, deletedIds, eventStatusMap, isModeratedOnly, community, moderators, creator, approvals, muted])

  const computeEngagement = (event: Event) => {
    return event.tags.reduce((score, tag) => ['p', 'e', 'r', 'a'].includes(tag[0]) ? score + 1 : score, 0)
  }

  const sortedEvents = useMemo(() => {
    const copy = [...filteredEvents]
    switch (sortBy) {
      case 'hot':
        return copy.sort((a, b) => {
          const ageA = Math.max(1, Math.floor(Date.now() / 1000) - a.created_at)
          const ageB = Math.max(1, Math.floor(Date.now() / 1000) - b.created_at)
          return ((computeEngagement(b) + 1) / ageB) - ((computeEngagement(a) + 1) / ageA) || b.created_at - a.created_at
        })
      case 'top':
        return copy.sort((a, b) => computeEngagement(b) - computeEngagement(a) || b.created_at - a.created_at)
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

  const handleTorrentSeed = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsSeeding(true)
    try {
      const magnetUri = await torrentService.seedFile(file)
      setPostContent(prev => prev ? `${prev}\n${magnetUri}` : magnetUri)
    } catch (err) {
      console.error('Seeding failed', err)
      alert(err instanceof Error ? err.message : 'Failed to seed file')
    } finally {
      setIsSeeding(false)
      if (torrentInputRef.current) torrentInputRef.current.value = ''
    }
  }

  const handlePublish = async () => {
    if (!postContent.trim() || !user.pubkey) return
    setIsPublishing(true)
    try {
      const tags = [['a', communityATag, '', 'root'], ['t', communityId]]
      if (isNsfw) tags.push(['content-warning', 'nsfw'])

      const hashtags = postContent.match(/#\[(\w+)\]/g)
      if (hashtags) {
        hashtags.forEach(match => {
          const tag = match.slice(2, -1).toLowerCase()
          if (!tags.some(t => t[0] === 't' && t[1] === tag)) tags.push(['t', tag])
        })
      }

      const mentionRegex = /nostr:\[(npub1[a-z0-9]+|nprofile1[a-z0-9]+)\]/gi
      const mentions = postContent.match(mentionRegex)
      if (mentions) {
        mentions.forEach(m => {
          try {
            const entity = m.slice(7, -1)
            const decoded = nip19.decode(entity)
            if (decoded.type === 'npub') tags.push(['p', decoded.data as string])
            else if (decoded.type === 'nprofile') tags.push(['p', (decoded.data as { pubkey: string }).pubkey])
          } catch (e) {
            console.error('Failed to decode mention', e)
          }
        })
      }

      const cleanContent = postContent
        .replace(/#\[(\w+)\]/g, '#$1')
        .replace(/nostr:\[(npub1[a-z0-9]+|nprofile1[a-z0-9]+)\]/gi, 'nostr:$1')

      const eventTemplate = { kind: 1, created_at: Math.floor(Date.now() / 1000), tags, content: cleanContent }
      const signedEvent = await signerService.signEvent(eventTemplate)
      const success = await nostrService.publish(signedEvent)
      if (success) {
        setPostContent(''); setIsNsfw(false); triggerHaptic(20)
      } else { alert('Broadcast failed') }
    } catch (e) {
      console.error('Failed to publish', e); alert('Publish error')
    } finally { setIsPublishing(false) }
  }

  const handleUserSearch = async (query: string, callback: (data: { id: string; display: string }[]) => void) => {
    if (query.length < 2) return
    const sub = await nostrService.subscribe(
      [{ kinds: [0], search: query, limit: 10 }],
      (event: Event) => {
        try {
          const profile = JSON.parse(event.content)
          callback([
            {
              id: nip19.npubEncode(event.pubkey),
              display: profile.display_name || profile.name || event.pubkey.slice(0, 8)
            }
          ])
        } catch (e) {
          console.error('Failed to parse profile in user search', e)
        }
      },
      nostrService.getSearchRelays()
    )
    setTimeout(() => sub.close(), 2000)
  }

  if (isCommLoading) return <div className={`flex items-center justify-center h-full ${mutedText} font-mono text-[10px] uppercase tracking-widest`}><RefreshCw size={16} className="animate-spin mr-2" />Synchronizing_Node_Data...</div>

  return (
    <div className={`flex flex-col h-full ${containerBg}`}>
      <div className={`shrink-0 z-10 ${headerBg} backdrop-blur-xl border-b ${borderClass}`}>
        <div className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-full ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-900'} border ${borderClass} overflow-hidden flex-shrink-0 neon-bloom-violet shadow-lg shadow-purple-500/20`}>
                {community?.image ? <img src={community.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-purple-500 font-mono font-bold text-lg">{communityId[0].toUpperCase()}</div>}
              </div>
              <div className="min-w-0">
                <h2 className={`text-lg font-black ${primaryText} tracking-tighter uppercase leading-none mb-0.5 truncate`}>{community?.name || communityId}</h2>
                <div className="flex items-center gap-2"><span className={`text-[9px] ${mutedText} font-mono`}>c/{communityId}</span><div className="flex items-center gap-1 text-[8px] font-bold text-green-500 bg-green-500/5 px-1.5 py-0.5 rounded border border-green-500/20"><Shield size={8} /> {moderators.length}</div></div>
                {labels.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{labels.slice(0, 6).map(label => <span key={label} className="text-[7px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">{label}</span>)}</div>}
              </div>
            </div>
            {user.pubkey && <button onClick={handleToggle} disabled={isUpdating} className={`flex-shrink-0 text-[9px] font-bold uppercase px-3 py-1.5 rounded border transition-all ${isSubscribed ? `${theme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'} border-slate-700 hover:bg-red-500/10 hover:text-red-500` : 'bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20'}`}>{isUpdating ? '...' : isSubscribed ? 'Leave' : 'Join'}</button>}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 -mx-4 px-4"><button onClick={() => setIsModeratedOnly(!isModeratedOnly)} className={`flex-shrink-0 flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-bold transition-all border ${isModeratedOnly ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : `${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'} ${mutedText} border-slate-800`}`}><Filter size={10} /> {isModeratedOnly ? 'MODERATED' : 'RAW'}</button><div className={`flex-shrink-0 flex ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'} rounded border ${borderClass} p-0.5`}>{(['new', 'hot', 'top'] as const).map((s) => <button key={s} onClick={() => setSortBy(s)} className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${sortBy === s ? 'bg-purple-500 text-white' : `${mutedText} hover:text-slate-300`}`}>{s}</button>)}</div><div className={`w-px h-4 ${borderClass} mx-1 flex-shrink-0`} />{isUserModerator && <button onClick={() => pushLayer({ id: `mod-queue-${communityId}`, type: 'modqueue', title: 'Mod_Queue', params: { communityId, creator, moderators } })} className="flex-shrink-0 px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[9px] font-bold uppercase hover:bg-red-500/20">Queue</button>}<button onClick={() => pushLayer({ id: `mod-log-${communityId}`, type: 'modlog', title: 'Log', params: { communityId, creator } })} className={`flex-shrink-0 px-2 py-1 rounded ${theme === 'light' ? 'bg-slate-100' : 'bg-white/5'} ${mutedText} border ${borderClass} text-[9px] font-bold uppercase hover:text-slate-300`}>Log</button>{isCreator && <button onClick={() => pushLayer({ id: `admin-${communityId}`, type: 'communityadmin', title: 'Admin', params: { communityId, creator } })} className="flex-shrink-0 px-2 py-1 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[9px] font-bold uppercase hover:bg-cyan-500/20">Settings</button>}{isUnmoderated && community && <button onClick={() => pushLayer({ id: `claim-${communityId}`, type: 'claimstation', title: 'Authority_Claim', params: { community } })} className="flex-shrink-0 px-2 py-1 rounded bg-orange-500/10 text-orange-400 border border-orange-500/30 text-[9px] font-bold uppercase hover:bg-orange-500/20">Claim</button>}</div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <VirtualFeed events={regularEvents} isLoadingMore={false} onLoadMore={() => {}} header={
          <div className="p-4 space-y-4">
            <div className={`glassmorphism p-3 rounded-xl ${theme === 'light' ? 'border-slate-300' : 'border-slate-800/50'}`}>
                                  <HashtagTextarea 
                                    value={postContent} 
                                    onChange={(_event: any, newValue: any) => setPostContent(newValue)} 
                                    disabled={!user.pubkey || isPublishing} 
                                    placeholder={`Post to c/${communityId}...`} 
                                    onUserSearch={handleUserSearch}
                                  />              <div className={`flex items-center justify-between mt-2 pt-2 border-t ${theme === 'light' ? 'border-slate-200' : 'border-white/5'}`}>
                <label className={`flex items-center gap-2 text-[8px] font-mono uppercase ${mutedText}`}><input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-red-500" /> NSFW</label>
                <div className="flex items-center gap-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
                  <input type="file" ref={torrentInputRef} onChange={handleTorrentSeed} className="hidden" accept="image/*,video/*,audio/*" />
                  
                  <button type="button" disabled={isUploadingMedia || isSeeding || !user.pubkey} onClick={() => fileInputRef.current?.click()} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} ${secondaryText} transition-colors disabled:opacity-50`} title="Attach Media">
                    {isUploadingMedia ? <Loader2 size={12} className="animate-spin" /> : <Paperclip size={12} />}
                  </button>

                  <button type="button" disabled={isUploadingMedia || isSeeding || !user.pubkey} onClick={() => torrentInputRef.current?.click()} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-white/5'} text-purple-400 transition-colors disabled:opacity-50`} title="Seed via BitTorrent">
                    {isSeeding ? <Loader2 size={12} className="animate-spin" /> : <Share2 size={12} />}
                  </button>

                  <button onClick={handlePublish} disabled={!user.pubkey || !postContent.trim() || isPublishing || isSeeding} className="terminal-button rounded py-1 px-3 text-[9px]">{isPublishing ? '...' : 'Post'}</button>
                </div>
              </div>
            </div>
            {community?.rules && <div className="glassmorphism p-3 rounded-xl border-yellow-500/20 bg-yellow-500/5"><h4 className="flex items-center gap-2 font-mono font-bold text-[9px] text-yellow-500 uppercase mb-1 tracking-widest"><Info size={10} /> Rules</h4><div className={`text-[10px] ${secondaryText} font-sans leading-relaxed italic line-clamp-2 hover:line-clamp-none transition-all cursor-pointer`}>{community.rules}</div></div>}
            {pinnedEvents.length > 0 && <div className="space-y-4 mb-8"><h4 className="flex items-center gap-2 font-mono font-bold text-[10px] text-purple-500 uppercase tracking-widest px-2"><Pin size={12} className="rotate-45" /> Pinned</h4><div className="space-y-4">{pinnedEvents.map(event => <Post key={event.id} event={event} isModerator={moderators.includes(event.pubkey)} isApproved={true} depth={0} />)}</div><div className={`h-px ${borderClass} mx-4`} /></div>}
          </div>
        } />
      </div>
    </div>
  )
}

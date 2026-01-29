import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { LogIn, LogOut, Layout, Terminal as TerminalIcon, Paperclip, Loader2, PanelLeftClose, PanelLeftOpen, User } from 'lucide-react'
import { useStore } from './store/useStore'
import { useUiStore } from './store/useUiStore'
import type { Layer } from './store/useUiStore'
import { nostrService } from './services/nostr'
import { mediaService } from './services/mediaService'
import { nip19, type Event, type Filter } from 'nostr-tools'
import { VirtualFeed } from './components/VirtualFeed'
import { useTrendingTags } from './hooks/useTrendingTags'
import { RelayList } from './components/RelayList'
import { MediaServers } from './components/MediaServers'
import { ErrorLog } from './components/ErrorLog'
import { SwipeStack } from './components/SwipeStack'
import { Communities } from './components/Communities'
import { Thread } from './components/Thread'
import { CommunityFeed } from './components/CommunityFeed'
import { ModQueue } from './components/ModQueue'
import { ModerationLog } from './components/ModerationLog'
import { CommunityCreate } from './components/CommunityCreate'
import { CommunityAdmin } from './components/CommunityAdmin'
import { ClaimStation } from './components/ClaimStation'
import { ProfileEditor } from './components/ProfileEditor'
import { ProfileView } from './components/ProfileView'
import { ConnectBunker } from './components/ConnectBunker'
import { NwcSettings } from './components/NwcSettings'
import { Search } from './components/Search'
import { Sidebar } from './components/Sidebar'
import { useDeletions } from './hooks/useDeletions'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useRelays } from './hooks/useRelays'
import { useSocialGraph } from './hooks/useSocialGraph'
import { useUserSearch } from './hooks/useUserSearch'
import { formatPubkey, shortenPubkey } from './utils/nostr'
import type { CommunityDefinition } from './hooks/useCommunity'

// Defined outside to prevent focus loss on re-render
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

        return (
          <div className="relative w-full min-h-[4rem] mt-3 font-sans text-sm leading-6">
            {mentionQuery && userSuggestions.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-full max-h-48 bg-slate-900 border border-slate-800 rounded-xl overflow-y-auto z-[1005] shadow-2xl animate-in slide-in-from-bottom-2">
                {userSuggestions.map((res: any) => (
                  <button
                    key={res.pubkey}
                    onClick={() => onInsertMention(res.pubkey)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                      {res.profile?.picture ? <img src={res.profile.picture} className="w-full h-full object-cover" /> : <User size={16} className="m-auto text-slate-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-100 truncate">{res.profile?.display_name || res.profile?.name || shortenPubkey(formatPubkey(res.pubkey))}</p>
                      <p className="text-[9px] text-slate-500 font-mono truncate">{res.pubkey}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div 
              className="absolute inset-0 pointer-events-none whitespace-pre-wrap break-words text-transparent p-0 m-0 border-none"
              style={{ lineHeight: '1.5rem', font: 'inherit', padding: '0', wordBreak: 'break-word' }}
              aria-hidden="true"
            >
              {renderHighlighted(value)}
            </div>
            <textarea
              value={value}
              onChange={handleChange}
              disabled={disabled}
              className="w-full bg-transparent text-slate-200 border-none focus:ring-0 p-0 m-0 resize-none h-16 min-h-[3.5rem] relative z-10 font-inherit"
              style={{ lineHeight: '1.5rem', font: 'inherit', wordBreak: 'break-word' }}
              placeholder={placeholder}
                  />
                </div>
              )
            }
            
            function App() {  const { events, addEvents, isConnected, setConnected, user, login, logout } = useStore()
  const { layout, setLayout, theme, setTheme, stack, popLayer, pushLayer, resetStack } = useUiStore()
  const { muted } = useSocialGraph()
  useSubscriptions() 
  useRelays()

  // Set default view for logged-in users on mobile
  useEffect(() => {
    if (user.pubkey && layout === 'swipe' && stack.length === 1 && stack[0].type === 'feed') {
      resetStack({ id: 'system-control', type: 'sidebar', title: 'System_Control' })
    }
  }, [user.pubkey, layout])

  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [isNsfw, setIsNsfw] = useState(false)
  const [composerCollapsed, setComposerCollapsed] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true)
  const [mentionQuery, setMentionQuery] = useState('')
  const { data: userSuggestions = [] } = useUserSearch(mentionQuery)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const feedRef = useRef<any>(null)
  const columnsContainerRef = useRef<HTMLDivElement>(null)
  const lastScrollTop = useRef(0)

  useEffect(() => {
    if (layout === 'classic' && columnsContainerRef.current) {
      const container = columnsContainerRef.current
      requestAnimationFrame(() => {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: 'smooth'
        })
      })
    }
  }, [stack.length, layout])

  const liveSubRef = useRef<{ close: () => void } | null>(null)
  const loadMoreSubRef = useRef<{ close: () => void } | null>(null)
  const trendingTags = useTrendingTags()
  const deletionTargets = useMemo(() => events.slice(0, 500).map(e => e.id), [events])
  const { data: deletedIds = [] } = useDeletions(deletionTargets)
  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds])
  const pendingEventsRef = useRef<Event[]>([])
  const [isLiveSynced, setIsLiveSynced] = useState(false)
  const [isHistorySyncing, setIsHistorySyncing] = useState(false)
  const eventRateCountRef = useRef(0)
  const eventRateWindowRef = useRef(Date.now())
  const backpressureTimerRef = useRef<number | null>(null)
  const [isBackpressured, setIsBackpressured] = useState(false)
  const MAX_EVENTS_PER_SEC = 120

  const [pendingCount, setPendingCount] = useState(0)

  const flushPendingEvents = useCallback(() => {
    if (pendingEventsRef.current.length === 0) return
    const pending = [...pendingEventsRef.current]
    pendingEventsRef.current = []
    setPendingCount(0)
    addEvents(pending)
    if (feedRef.current) {
      feedRef.current.scrollTo(0)
    }
  }, [addEvents])

  const enqueueEvent = useCallback((event: Event) => {
    const now = Date.now()
    if (now - eventRateWindowRef.current > 1000) {
      eventRateWindowRef.current = now
      eventRateCountRef.current = 0
    }
    if (eventRateCountRef.current >= MAX_EVENTS_PER_SEC) {
      if (!isBackpressured) {
        setIsBackpressured(true)
      }
      if (!backpressureTimerRef.current) {
        backpressureTimerRef.current = window.setTimeout(() => {
          eventRateWindowRef.current = Date.now()
          eventRateCountRef.current = 0
          setIsBackpressured(false)
          backpressureTimerRef.current = null
        }, 1500)
      }
      return
    }
    eventRateCountRef.current += 1
    pendingEventsRef.current.push(event)
    setPendingCount(pendingEventsRef.current.length)
  }, [isBackpressured])

  const fetchEvents = useCallback(async (until?: number, additionalFilter: Partial<Filter> = {}) => {
    if (until) {
      if (isLoadingMore) return
      setIsLoadingMore(true)
      setIsHistorySyncing(true)
      loadMoreSubRef.current?.close()
      loadMoreSubRef.current = null
    } else {
      setIsLiveSynced(false)
    }
    
    const filter: Filter = { 
      kinds: [1], 
      limit: 50, 
      ...(until ? { until } : {}),
      ...additionalFilter 
    }

    let sub: { close: () => void } | null = null
    const handleEose = () => {
      if (until) {
        setIsHistorySyncing(false)
        setIsLoadingMore(false)
        sub?.close()
        if (loadMoreSubRef.current === sub) loadMoreSubRef.current = null
      } else {
        setIsLiveSynced(true)
      }
    }

    sub = await nostrService.subscribe(
      [filter],
      (event: Event) => {
        enqueueEvent(event)
      },
      undefined,
      {
        onEose: handleEose
      }
    )

    if (until) {
      loadMoreSubRef.current = sub
      setTimeout(() => {
        if (loadMoreSubRef.current === sub) {
          setIsLoadingMore(false)
          sub.close()
          loadMoreSubRef.current = null
          setIsHistorySyncing(false)
        }
      }, 3000) 
    } else {
      liveSubRef.current?.close()
      liveSubRef.current = sub
    }
    
    return sub
  }, [enqueueEvent, isLoadingMore])

  useEffect(() => {
    setConnected(true)
    let subNotes: { close: () => void } | undefined
    const init = async () => {
      subNotes = await fetchEvents()
    }
    init()
    return () => {
      subNotes?.close()
      liveSubRef.current?.close()
      loadMoreSubRef.current?.close()
      flushPendingEvents()
    }
  }, [fetchEvents, setConnected, flushPendingEvents])

  const handleLoadMore = () => {
    if (events.length === 0 || isLoadingMore) return
    const oldest = events[events.length - 1].created_at
    fetchEvents(oldest - 1)
  }

  const handleFeedScroll = useCallback(
    (scrollTop: number) => {
      const last = lastScrollTop.current
      const diff = scrollTop - last
      const direction = diff > 0 ? 'down' : 'up'
      if (Math.abs(diff) > 10) {
        if (direction === 'down' && scrollTop > 50) {
          setIsHeaderHidden(true)
          setComposerCollapsed(true)
        } else if (direction === 'up' || scrollTop < 50) {
          setIsHeaderHidden(false)
        }
      }
      lastScrollTop.current = scrollTop
    },
    []
  )

  const handleLayerClose = useCallback((index: number) => {
    const layersToPop = stack.length - index
    for (let i = 0; i < layersToPop; i++) {
      popLayer()
    }
  }, [popLayer, stack.length])
  
  const handleTrendingTagClick = (tag: string) => {
    pushLayer({
      id: `tag-feed-${tag}-${Date.now()}`,
      type: 'feed',
      title: `Tag_${tag.toUpperCase()}`,
      params: { filter: { '#t': [tag] } }
    })
  }
  
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
      const tags: string[][] = []
      if (isNsfw) tags.push(['content-warning', 'nsfw'])
      const hashtags = postContent.match(/#\w+/g)
      if (hashtags) {
        hashtags.forEach(tag => {
          const cleanTag = tag.replace('#', '').toLowerCase()
          if (!tags.some(t => t[0] === 't' && t[1] === cleanTag)) {
            tags.push(['t', cleanTag])
          }
        })
      }
      const mentionRegex = /nostr:(npub1[a-z0-9]+|nprofile1[a-z0-9]+)/gi
      const mentions = postContent.match(mentionRegex)
      if (mentions) {
        mentions.forEach(m => {
          try {
            const entity = m.replace('nostr:', '')
            const decoded = nip19.decode(entity)
            if (decoded.type === 'npub') {
              tags.push(['p', decoded.data as string])
            } else if (decoded.type === 'nprofile') {
              tags.push(['p', (decoded.data as any).pubkey])
            }
          } catch (e) {}
        })
      }
      await nostrService.createAndPublishPost(postContent, tags)
      setPostContent('')
      setIsNsfw(false)
    } catch (e) {
      console.error('Failed to publish', e)
      alert('Failed to publish post. Check connection.')
    } finally {
      setIsPublishing(false)
    }
  }

  const onInsertMention = (pubkey: string) => {
    const npub = nip19.npubEncode(pubkey)
    const lastAt = postContent.lastIndexOf('@')
    const before = postContent.slice(0, lastAt)
    const after = postContent.slice(lastAt + 1 + mentionQuery.length)
    setPostContent(`${before}nostr:${npub}${after}`)
    setMentionQuery('')
  }

  const renderLayerContent = (layer: Layer) => {
    switch (layer.type) {
      case 'sidebar':
        return <Sidebar />
      case 'communities':
        return <Communities />
      case 'feed': {
        const params = layer.params as { filter?: { '#t'?: string[] } } | undefined
        const tagFilter = params?.filter?.['#t']
        const firstTag = tagFilter?.[0]
        const filteredEvents = (firstTag 
          ? events.filter(e => e.tags.some(t => t[0] === 't' && t[1].toLowerCase() === firstTag.toLowerCase()))
          : events).filter(e => !deletedSet.has(e.id) && !muted.includes(e.pubkey))

        return (
          <div className="h-full flex flex-col">
            <div className={`mx-4 mb-2 transition-all duration-300 ease-in-out overflow-hidden ${isHeaderHidden ? 'max-h-0 opacity-0 mb-0' : 'max-h-96 opacity-100'}`}>
              <div className={`glassmorphism rounded-xl border-slate-800 shadow-2xl p-3 transition-all duration-200 ${composerCollapsed ? 'max-h-0 opacity-0 pointer-events-none hidden' : 'max-h-72 opacity-100 block'}`}>
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <span className="text-[9px] uppercase font-bold tracking-[0.3em] text-slate-400">Broadcast</span>
                  <button onClick={() => setComposerCollapsed(true)} className="text-[10px] uppercase tracking-[0.3em] text-cyan-300 hover:text-cyan-200">hide</button>
                </div>
                <HashtagTextarea
                  value={postContent}
                  onChange={(e: any) => setPostContent(e.target.value)}
                  disabled={!user.pubkey || isPublishing}
                  placeholder={user.pubkey ? 'Broadcast to network...' : 'Login to write...'}
                  mentionQuery={mentionQuery}
                  setMentionQuery={setMentionQuery}
                  userSuggestions={userSuggestions}
                  onInsertMention={onInsertMention}
                />
                <div className="flex items-center justify-between pt-2 border-t border-white/5 mt-3 text-[9px]">
                  <label className="flex items-center gap-2 uppercase font-mono text-slate-500">
                    <input type="checkbox" checked={isNsfw} onChange={(e) => setIsNsfw(e.target.checked)} className="accent-red-500" /> NSFW
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*,video/*,audio/*" />
                    <button type="button" disabled={isUploadingMedia || !user.pubkey} onClick={() => fileInputRef.current?.click()} className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 transition-colors disabled:opacity-50" title="Attach Media">
                      {isUploadingMedia ? <Loader2 size={14} className="animate-spin" /> : <Paperclip size={14} />}
                    </button>
                    <button onClick={handlePublish} disabled={!user.pubkey || !postContent.trim() || isPublishing} className="terminal-button rounded-lg text-[10px] py-1 px-3">Transmit</button>
                  </div>
                </div>
              </div>
              <div className={`glassmorphism rounded-full shadow-inner px-4 py-1 text-[9px] uppercase tracking-[0.3em] text-cyan-300/60 text-center cursor-pointer transition-all duration-300 hover:text-cyan-200 hover:bg-white/10 ${composerCollapsed ? 'opacity-100 visible pointer-events-auto' : 'opacity-0 invisible pointer-events-none h-0 py-0 overflow-hidden'}`} onClick={() => setComposerCollapsed(false)}>Open composer</div>
            </div>
            <div className="flex-1 min-h-0 relative">
              {pendingCount > 0 && (
                <div className={`absolute top-4 left-1/2 z-20 -translate-x-1/2 transition-all duration-300 ${isHeaderHidden ? 'opacity-0 -translate-y-4 pointer-events-none' : 'opacity-100 translate-y-0'}`}>
                  <button onClick={flushPendingEvents} className="rounded-full border border-cyan-500/30 bg-cyan-500/10 backdrop-blur-xl px-4 py-1 text-[9px] uppercase tracking-[0.15em] text-cyan-300 shadow-2xl transition-all hover:bg-cyan-500/20 active:scale-95 whitespace-nowrap">{pendingCount} NEW ITEM{pendingCount > 1 ? 'S' : ''} · APPLY</button>
                </div>
              )}
              <VirtualFeed ref={feedRef} events={filteredEvents} isLoadingMore={isLoadingMore} onLoadMore={handleLoadMore} onScroll={handleFeedScroll} />
            </div>
          </div>
        )
      }
      case 'thread': return <Thread eventId={layer.params?.eventId as string} rootEvent={layer.params?.rootEvent as Event} />
      case 'community': return <CommunityFeed communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'modqueue': return <ModQueue communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'modlog': return <ModerationLog communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'createcommunity': return <CommunityCreate />
      case 'communityadmin': return <CommunityAdmin communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'claimstation': return <ClaimStation community={layer.params?.community as CommunityDefinition} />
      case 'connectbunker': return <ConnectBunker />
      case 'search': return <Search />
      case 'relays': return <RelayList />
            case 'mediaservers':
              return <MediaServers />
            case 'wallet':
              return <NwcSettings />
            case 'errorlog':
              return <ErrorLog />
      case 'profile': return <ProfileEditor />
      case 'profile-view': return <ProfileView pubkey={layer.params?.pubkey as string | undefined} />
      default: return <div className="p-4 opacity-50 font-mono">[CONTENT_UNAVAILABLE]</div>
    }
  }

  const Header = () => (
    <header className={`border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4 shrink-0 z-[1001] backdrop-blur-xl gap-2 overflow-hidden transition-all duration-300 ease-in-out ${isHeaderHidden ? 'h-0 opacity-0 border-b-0' : 'h-14 opacity-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <img src="/asknostr_logo.png" alt="" className="w-7 h-7 rounded-full border border-slate-800 shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0" />
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-black uppercase tracking-tighter gradient-text leading-none truncate">AskNostr_Core</h1>
          <span className="text-[7px] font-mono opacity-40 uppercase tracking-widest mt-0.5 truncate hidden sm:block">DECENTRALIZED_GATEWAY</span>
        </div>
      </div>
      <div className="flex gap-2 items-center uppercase font-bold text-[9px] font-mono shrink-0">
        {isBackpressured && <span className="text-amber-400 px-2 py-1 border border-amber-600 rounded-full text-[8px] tracking-[0.3em]">BACKPRESSURE</span>}
        <span className={`px-2 py-1 border rounded-full text-[8px] tracking-[0.3em] ${isLiveSynced ? 'text-emerald-300 border-emerald-500/40' : 'text-slate-400 border-slate-700'}`}>{isLiveSynced ? 'LIVE' : 'SYNCING'}</span>
        {isHistorySyncing && <span className="text-cyan-300 px-2 py-1 border border-cyan-500/30 rounded-full text-[8px] tracking-[0.3em]">HISTORY</span>}
        <button onClick={() => setLayout(layout === 'swipe' ? 'classic' : 'swipe')} className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400 hidden sm:flex"><Layout size={14} /> {layout === 'swipe' ? 'Classic' : 'Mobile'}</button>
        <button onClick={() => setTheme(theme === 'terminal' ? 'modern' : 'terminal')} className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400 hidden sm:flex"><TerminalIcon size={14} /> Theme</button>
        {layout === 'classic' && !rightSidebarVisible && (
          <button onClick={() => setRightSidebarVisible(true)} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] transition-all hover:bg-cyan-500/20" title="Expand Metadata Sidebar">
            <PanelLeftOpen size={14} /> <span className="text-[10px] uppercase font-bold tracking-tight">Expand_Metadata</span>
          </button>
        )}
        {!user.pubkey ? (
          <button onClick={() => { if (window.nostr) { login() } else { pushLayer({ id: 'connect-bunker', type: 'connectbunker', title: 'Connect' }) } }} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"><LogIn size={14} /> Connect</button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" /><span className="text-slate-500 hidden sm:inline">Online</span></div>
            <button onClick={logout} className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] uppercase text-[9px] font-bold tracking-widest hover:bg-red-500/20 transition-all"><LogOut size={14} /> Exit</button>
          </div>
        )}
      </div>
    </header>
  )

  if (layout === 'swipe') {
    return (
      <div className={`h-screen w-full flex flex-col bg-[#05070A] ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'}`}>
        <Header />
        <main className="flex-1 overflow-hidden relative"><SwipeStack renderLayer={renderLayerContent} /></main>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-[#05070A] ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'} transition-colors duration-500`}>
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-800 shrink-0 bg-slate-950/20"><Sidebar /></aside>
        <div ref={columnsContainerRef} className="flex-1 flex overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-950/40 scroll-smooth relative">
          {!rightSidebarVisible && (
            <button onClick={() => setRightSidebarVisible(true)} className="absolute right-4 top-4 z-[1002] p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-400 hover:text-cyan-400 transition-all hidden xl:flex" title="Expand Sidebar"><PanelLeftOpen size={18} /></button>
          )}
          {stack.map((layer, index) => (
            <div key={`${layer.id}-${index}`} className="w-[500px] shrink-0 border-r border-slate-800 flex flex-col h-full bg-[#05070A] animate-in fade-in slide-in-from-right-4 duration-300 relative shadow-2xl">
              <header className="h-14 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md flex items-center px-4 gap-4 shrink-0">
                {index > 0 && <button onClick={() => handleLayerClose(index)} className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-tighter transition-colors">[CLOSE]</button>}
                <div className="flex-1 min-w-0"><h2 className="text-[10px] font-black uppercase tracking-[0.2em] truncate text-slate-400">{layer.title}</h2></div>
                <div className="text-[8px] font-mono opacity-20 uppercase">L:{index + 1}</div>
              </header>
              <div className="flex-1 overflow-y-auto custom-scrollbar">{renderLayerContent(layer)}</div>
            </div>
          ))}
          <div className="flex-grow min-w-[100px]" />
        </div>
        <aside className={`border-l border-slate-800 hidden xl:flex flex-col overflow-hidden transition-all duration-300 bg-slate-950/20 ${rightSidebarVisible ? 'w-80 opacity-100' : 'w-0 opacity-0 border-l-0'}`}>
          <div className="p-4 border-b border-slate-800 shrink-0 flex justify-between items-center"><span className="text-[9px] font-mono font-bold text-slate-600 uppercase tracking-widest">Metadata_Feed</span><button onClick={() => setRightSidebarVisible(false)} className="p-1.5 hover:bg-white/5 rounded text-slate-500 hover:text-slate-300 transition-colors"><PanelLeftClose size={14} /></button></div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            <div className="terminal-border glassmorphism p-5 rounded-2xl border-slate-800/50 shadow-xl"><h2 className="text-[10px] font-mono font-bold uppercase text-slate-500 mb-4 border-b border-slate-800 pb-2 tracking-widest">Network_Status</h2><div className="space-y-3 text-[10px] font-mono"><div className="flex justify-between items-center"><span className="opacity-50 uppercase">Session:</span><span className={`px-2 py-0.5 rounded-full border ${isConnected ? "text-green-500 border-green-500/20 bg-green-500/5" : "text-red-500 border-red-500/20 bg-red-500/5"}`}>{isConnected ? "STABLE" : "OFFLINE"}</span></div><div className="flex justify-between items-center"><span className="opacity-50 uppercase">Buffer:</span><span className="text-slate-300 font-bold">{events.length}</span></div></div></div>
            <div className="terminal-border glassmorphism p-5 rounded-2xl border-slate-800/50 shadow-xl"><h2 className="text-[10px] font-mono font-bold uppercase text-slate-500 mb-4 border-b border-slate-800 pb-2 tracking-widest">Signal_Trends</h2><ul className="space-y-3">{trendingTags.length === 0 ? <li className="opacity-20 italic text-[10px] font-mono uppercase tracking-tighter py-4 text-center">Monitoring_Broadcasts...</li> : trendingTags.map(({ name, count }) => <li key={name} role="button" onClick={() => handleTrendingTagClick(name)} className="flex justify-between items-center group cursor-pointer"><span className="text-[10px] text-slate-400 group-hover:text-purple-400 transition-colors uppercase font-mono">#{name}</span><span className="text-[8px] font-mono text-slate-600 bg-white/5 px-1.5 rounded">{count}x</span></li>)}</ul></div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App

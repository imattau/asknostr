import { useEffect, useState, useCallback } from 'react'
import { LogIn, LogOut, Layout, Terminal as TerminalIcon } from 'lucide-react'
import { useStore } from './store/useStore'
import { useUiStore } from './store/useUiStore'
import type { Layer } from './store/useUiStore'
import { nostrService } from './services/nostr'
import type { Event, Filter } from 'nostr-tools'
import { Post } from './components/Post'
import { useTrendingTags } from './hooks/useTrendingTags'
import { RelayList } from './components/RelayList'
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
import { ConnectBunker } from './components/ConnectBunker'
import { Search } from './components/Search'
import { Sidebar } from './components/Sidebar'
import { useDeletions } from './hooks/useDeletions'
import { useSubscriptions } from './hooks/useSubscriptions'
import { useRelays } from './hooks/useRelays'
import type { CommunityDefinition } from './hooks/useCommunity'

function App() {
  const { events, addEvent, isConnected, setConnected, user, login, logout, appAdmin } = useStore()
  useSubscriptions() 
  useRelays()
  const { layout, setLayout, theme, setTheme, stack, popLayer } = useUiStore()
  const [postContent, setPostContent] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const trendingTags = useTrendingTags()
  const { data: deletedIds = [] } = useDeletions(events.map(e => e.id))

  const fetchEvents = useCallback(async (until?: number, additionalFilter: Partial<Filter> = {}) => {
    if (until) setIsLoadingMore(true)
    
    const filter: Filter = { 
      kinds: [1], 
      limit: 50, 
      ...(until ? { until } : {}),
      ...additionalFilter 
    }

    const sub = await nostrService.subscribe(
      [filter],
      (event: Event) => {
        addEvent(event)
      }
    )

    if (until) {
      setTimeout(() => {
        setIsLoadingMore(false)
        sub.close()
      }, 3000) 
    }
    
    return sub
  }, [addEvent])

  useEffect(() => {
    setConnected(true)
    let subNotes: { close: () => void } | undefined

    const init = async () => {
      subNotes = await fetchEvents()
    }

    init()

    return () => {
      subNotes?.close()
    }
  }, [fetchEvents, setConnected])

  const handleLoadMore = () => {
    if (events.length === 0) return
    const oldest = events[events.length - 1].created_at
    fetchEvents(oldest - 1)
  }

  const handlePublish = async () => {
    if (!postContent.trim() || !user.pubkey) return
    setIsPublishing(true)
    try {
      await nostrService.createAndPublishPost(postContent)
      setPostContent('')
    } catch (e) {
      console.error('Failed to publish', e)
      alert('Failed to publish post. Check connection.')
    } finally {
      setIsPublishing(false)
    }
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
          : events).filter(e => !deletedIds.includes(e.id))

        return (
          <div className="p-4 space-y-4">
            <div className="glassmorphism p-4 rounded-xl border-slate-800 shadow-2xl">
              <textarea 
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                disabled={!user.pubkey || isPublishing}
                className="w-full bg-transparent text-slate-200 border-none focus:ring-0 p-0 text-sm resize-none h-20 font-sans placeholder:text-slate-600"
                placeholder={user.pubkey ? "Broadcast to network..." : "Login to write..."}
              ></textarea>
              <div className="flex justify-end pt-2 border-t border-white/5 mt-2">
                <button 
                  onClick={handlePublish}
                  disabled={!user.pubkey || !postContent.trim() || isPublishing}
                  className="terminal-button rounded-lg text-[10px] py-1.5 px-4"
                >
                  Transmit
                </button>
              </div>
            </div>
            {filteredEvents.map(event => <Post key={event.id} event={event} />)}
            <button onClick={handleLoadMore} className="w-full glassmorphism p-3 rounded-lg text-[10px] opacity-50 uppercase font-bold">
              {isLoadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )
      }
      case 'thread':
        return <Thread eventId={layer.params?.eventId as string} rootEvent={layer.params?.rootEvent as Event} />
      case 'community':
        return <CommunityFeed communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'modqueue':
        return <ModQueue communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'modlog':
        return <ModerationLog communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'createcommunity':
        return <CommunityCreate />
      case 'communityadmin':
        return <CommunityAdmin communityId={layer.params?.communityId as string} creator={layer.params?.creator as string} />
      case 'claimstation':
        return <ClaimStation community={layer.params?.community as CommunityDefinition} />
      case 'connectbunker':
        return <ConnectBunker />
      case 'search':
        return <Search />
      case 'relays':
        return <RelayList />
      case 'profile':
        return <ProfileEditor />
      default:
        return <div className="p-4 opacity-50 font-mono">[CONTENT_UNAVAILABLE]</div>
    }
  }

  const Header = () => (
    <header className="h-14 border-b border-slate-800 bg-slate-950 flex items-center justify-between px-4 shrink-0 z-[1001] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <img src="/asknostr_logo.png" alt="" className="w-7 h-7 rounded-full border border-slate-800 shadow-[0_0_15px_rgba(168,85,247,0.3)]" />
        <div className="flex flex-col">
          <h1 className="text-sm font-black uppercase tracking-tighter gradient-text leading-none">AskNostr_Core</h1>
          <span className="text-[7px] font-mono opacity-40 uppercase tracking-widest mt-0.5">Station_ID: {appAdmin?.slice(0, 16) || 'INITIALIZING'}</span>
        </div>
      </div>
      
      <div className="flex gap-4 items-center uppercase font-bold text-[9px] font-mono">
        <button 
          onClick={() => setLayout(layout === 'swipe' ? 'classic' : 'swipe')} 
          className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400"
        >
          <Layout size={14} /> {layout === 'swipe' ? 'Classic_Columns' : 'Mobile_Stack'}
        </button>
        <button 
          onClick={() => setTheme(theme === 'terminal' ? 'modern' : 'terminal')} 
          className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400"
        >
          <TerminalIcon size={14} /> Theme
        </button>
        {!user.pubkey ? (
          <button onClick={login} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <LogIn size={14} /> Connect
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
            <span className="text-slate-500">Online</span>
          </div>
        )}
      </div>
    </header>
  )

  if (layout === 'swipe') {
    return (
      <div className={`h-screen w-full flex flex-col bg-[#05070A] ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'}`}>
        <Header />
        <main className="flex-1 overflow-hidden relative">
          <SwipeStack renderLayer={renderLayerContent} />
        </main>
        
        <nav className="h-16 border-t border-slate-800 flex items-center justify-around bg-slate-950 z-[1000] pb-safe">
          <button 
            onClick={() => setLayout('classic')} 
            className="flex flex-col items-center gap-1 text-[9px] uppercase font-bold text-slate-400"
          >
            <Layout size={18} /> <span>Classic</span>
          </button>
          {!user.pubkey ? (
            <button onClick={login} className="flex flex-col items-center gap-1 text-[9px] uppercase font-bold text-cyan-400">
              <LogIn size={18} /> <span>Connect</span>
            </button>
          ) : (
            <button onClick={logout} className="flex flex-col items-center gap-1 text-[9px] uppercase font-bold text-red-500">
              <LogOut size={18} /> <span>Exit</span>
            </button>
          )}
        </nav>
      </div>
    )
  }

  return (
    <div className={`h-screen flex flex-col bg-[#05070A] ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'}`}>
      <Header />
      
      <div className="flex-1 flex overflow-hidden">
        {/* Fixed Sidebar in Classic Mode */}
        <aside className="w-64 border-r border-slate-800 shrink-0 bg-slate-950/20">
          <Sidebar />
        </aside>

        {/* Miller Columns for Content Stack */}
        <div className="flex-1 flex overflow-x-auto overflow-y-hidden custom-scrollbar bg-slate-950/40 scroll-smooth">
          {stack.map((layer, index) => {
            return (
              <div 
                key={`${layer.id}-${index}`} 
                className="w-[500px] shrink-0 border-r border-slate-800 flex flex-col h-full bg-[#05070A] animate-in fade-in slide-in-from-right-4 duration-300 relative shadow-2xl"
              >
                <header className="h-14 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md flex items-center px-4 gap-4 shrink-0">
                  {index > 0 && (
                    <button 
                      onClick={() => {
                        const layersToPop = stack.length - 1 - index
                        for(let i=0; i<layersToPop; i++) popLayer()
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-tighter transition-colors"
                    >
                      [CLOSE]
                    </button>
                  )}
                  <div className="flex-1 min-w-0">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.2em] truncate text-slate-400">
                      {layer.title}
                    </h2>
                  </div>
                  <div className="text-[8px] font-mono opacity-20 uppercase">
                    L:{index + 1}
                  </div>
                </header>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {renderLayerContent(layer)}
                </div>
              </div>
            )
          })}
          
          {/* Empty Space filler */}
          <div className="flex-grow min-w-[100px]" />
        </div>

        {/* Persistent Discovery Metadata */}
        <aside className="w-80 border-l border-slate-800 hidden xl:block overflow-y-auto custom-scrollbar p-6 space-y-8 bg-slate-950/20">
          <div className="terminal-border glassmorphism p-5 rounded-2xl border-slate-800/50 shadow-xl">
            <h2 className="text-[10px] font-mono font-bold uppercase text-slate-500 mb-4 border-b border-slate-800 pb-2 tracking-widest">Network_Status</h2>
            <div className="space-y-3 text-[10px] font-mono">
              <div className="flex justify-between items-center">
                <span className="opacity-50 uppercase">Session:</span>
                <span className={`px-2 py-0.5 rounded-full border ${isConnected ? "text-green-500 border-green-500/20 bg-green-500/5" : "text-red-500 border-red-500/20 bg-red-500/5"}`}>
                  {isConnected ? "STABLE" : "OFFLINE"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-50 uppercase">Buffer:</span>
                <span className="text-slate-300 font-bold">{events.length}</span>
              </div>
            </div>
          </div>

          <div className="terminal-border glassmorphism p-5 rounded-2xl border-slate-800/50 shadow-xl">
            <h2 className="text-[10px] font-mono font-bold uppercase text-slate-500 mb-4 border-b border-slate-800 pb-2 tracking-widest">Signal_Trends</h2>
            <ul className="space-y-3">
              {trendingTags.length === 0 ? (
                <li className="opacity-20 italic text-[10px] font-mono uppercase tracking-tighter py-4 text-center">Monitoring_Broadcasts...</li>
              ) : (
                trendingTags.map(({ name, count }) => (
                  <li key={name} className="flex justify-between items-center group cursor-pointer">
                    <span className="text-[10px] text-slate-400 group-hover:text-purple-400 transition-colors uppercase font-mono">#{name}</span>
                    <span className="text-[8px] font-mono text-slate-600 bg-white/5 px-1.5 rounded">{count}x</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App

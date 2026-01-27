import { useEffect, useState, useCallback } from 'react'
import { Send, LogIn, LogOut, Layout, Terminal as TerminalIcon } from 'lucide-react'
import { useStore } from './store/useStore'
import { useUiStore } from './store/useUiStore'
import type { Layer } from './store/useUiStore'
import { nostrService, DEFAULT_RELAYS } from './services/nostr'
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
import { useDeletions } from './hooks/useDeletions'

function App() {
  const { events, addEvent, isConnected, setConnected, user, login, logout } = useStore()
  const { layout, setLayout, theme, setTheme } = useUiStore()
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
      alert('Failed to publish post. Check extension.')
    } finally {
      setIsPublishing(false)
    }
  }

  const renderLayerContent = (layer: Layer) => {
    switch (layer.type) {
      case 'communities':
        return <Communities />
      case 'feed': {
        const tagFilter = layer.params?.filter?.['#t'] as string[] | undefined
        const firstTag = tagFilter?.[0]
        const filteredEvents = (firstTag 
          ? events.filter(e => e.tags.some(t => t[0] === 't' && t[1].toLowerCase() === firstTag.toLowerCase()))
          : events).filter(e => !deletedIds.includes(e.id))

        return (
          <div className="p-4 space-y-4">
            <div className="terminal-border p-4 bg-black/50">
              <textarea 
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                disabled={!user.pubkey || isPublishing}
                className="w-full terminal-input min-h-[80px] resize-none mb-2 text-sm"
                placeholder={user.pubkey ? "Write to network..." : "Login to write..."}
              ></textarea>
              <div className="flex justify-end">
                <button 
                  onClick={handlePublish}
                  disabled={!user.pubkey || !postContent.trim() || isPublishing}
                  className="terminal-button text-xs py-1 px-3"
                >
                  Broadcast
                </button>
              </div>
            </div>
            {filteredEvents.map(event => <Post key={event.id} event={event} />)}
            <button onClick={handleLoadMore} className="w-full terminal-border p-2 text-xs opacity-50 uppercase font-bold">
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
      case 'relays':
        return <RelayList />
      default:
        return <div className="p-4 opacity-50">[CONTENT_UNAVAILABLE]</div>
    }
  }

  if (layout === 'swipe') {
    return (
      <div className={`h-screen w-full flex flex-col bg-black ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'}`}>
        <main className="flex-1 overflow-hidden relative">
          <SwipeStack renderLayer={renderLayerContent} />
        </main>
        
        <nav className="h-16 border-t-2 border-[#00ff41] flex items-center justify-around bg-black z-[1000]">
          <button onClick={() => setLayout('classic')} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-[#00ff41]">
            <Layout size={18} /> <span>Classic</span>
          </button>
          <button onClick={() => setTheme(theme === 'terminal' ? 'modern' : 'terminal')} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-[#00ff41]">
            <TerminalIcon size={18} /> <span>Theme</span>
          </button>
          {!user.pubkey ? (
            <button onClick={login} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-[#00ff41]">
              <LogIn size={18} /> <span>Login</span>
            </button>
          ) : (
            <button onClick={logout} className="flex flex-col items-center gap-1 text-[10px] uppercase font-bold text-[#00ff41] text-red-500">
              <LogOut size={18} /> <span>Exit</span>
            </button>
          )}
        </nav>
      </div>
    )
  }

  return (
    <div className={`min-h-screen p-4 flex flex-col items-center max-w-6xl mx-auto ${theme === 'terminal' ? 'terminal-theme' : 'modern-theme'}`}>
      <header className="w-full border-b-2 border-[#00ff41] pb-4 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TerminalIcon size={32} />
          <div>
            <h1 className="text-3xl font-bold tracking-tighter uppercase leading-none text-glow">AskNostr_v0.1</h1>
            <span className="text-xs opacity-50">STATION: LOCALHOST | LAYOUT: CLASSIC</span>
          </div>
        </div>
        <nav className="flex gap-6 items-center uppercase font-bold text-sm">
          <button onClick={() => setLayout('swipe')} className="flex items-center gap-1 hover:bg-[#00ff41] hover:text-black px-2 py-1 transition-colors">
            <Layout size={14} /> Swipe_Mode
          </button>
          {user.pubkey ? (
            <button onClick={logout} className="flex items-center gap-1 hover:bg-red-500 hover:text-black px-2 py-1 transition-colors">
              <LogOut size={14} /> Logout
            </button>
          ) : (
            <button onClick={login} className="flex items-center gap-1 hover:bg-[#00ff41] hover:text-black px-2 py-1 transition-colors border border-[#00ff41]">
              <LogIn size={14} /> Login_NIP-07
            </button>
          )}
        </nav>
      </header>
      
      <div className="w-full grid grid-cols-1 md:grid-cols-[1fr_300px] gap-8">
        <main className="space-y-6">
          <div className="terminal-border p-4 bg-black/50">
            <textarea 
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={!user.pubkey || isPublishing}
              className="w-full terminal-input min-h-[100px] resize-none mb-4"
              placeholder="Broadcast to the network..."
            ></textarea>
            <div className="flex justify-end">
              <button onClick={handlePublish} className="terminal-button flex items-center gap-2">
                <Send size={16} /> Broadcast
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {events.filter(e => !deletedIds.includes(e.id)).map((event) => <Post key={event.id} event={event} />)}
            <button onClick={handleLoadMore} className="w-full terminal-border p-2 uppercase text-xs font-bold hover:bg-[#00ff41] hover:text-black transition-colors">
              Load More
            </button>
          </div>
        </main>

        <aside className="space-y-8 hidden md:block">
          <div className="terminal-border glassmorphism p-4">
            <h2 className="text-sm font-bold uppercase mb-4 border-b border-[#00ff41] pb-1">Search Network</h2>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Query..."
                className="terminal-input w-full text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const query = e.currentTarget.value
                    if (query) {
                      nostrService.subscribe(
                        [{ kinds: [1], search: query, limit: 20 }],
                        (event: Event) => addEvent(event)
                      )
                      e.currentTarget.value = ''
                    }
                  }
                }}
              />
            </div>
          </div>

          <div className="terminal-border glassmorphism p-4">
            <h2 className="text-sm font-bold uppercase mb-4 border-b border-[#00ff41] pb-1">Network Info</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>STATUS:</span>
                <span className={isConnected ? "text-[#00ff41]" : "text-red-500"}>
                  {isConnected ? "ONLINE" : "OFFLINE"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>RELAYS:</span>
                <span>{DEFAULT_RELAYS.length}</span>
              </div>
              <div className="flex justify-between">
                <span>BUFFER:</span>
                <span>{events.length} EVENTS</span>
              </div>
            </div>
          </div>

          <div className="terminal-border glassmorphism p-4">
            <h2 className="text-sm font-bold uppercase mb-4 border-b border-[#00ff41] pb-1">Local Identity</h2>
            {user.pubkey ? (
              <div className="space-y-2 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="opacity-50">PUBKEY:</span>
                  <span className="break-all font-mono text-[9px]">{user.pubkey}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs opacity-50 italic">[GUEST_SESSION_ACTIVE]</p>
            )}
          </div>

          <div className="terminal-border glassmorphism p-4">
            <h2 className="text-sm font-bold uppercase mb-4 border-b border-[#00ff41] pb-1">Trending Tags</h2>
            <ul className="text-xs space-y-2">
              {trendingTags.length === 0 ? (
                <li className="opacity-50 italic">[SCANNING_NETWORK...]</li>
              ) : (
                trendingTags.map(({ name, count }) => (
                  <li key={name} className="flex justify-between items-center group cursor-pointer">
                    <span className="group-hover:text-[#00ff41] transition-colors">#{name}</span>
                    <span className="opacity-30 text-[9px]">{count}x</span>
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

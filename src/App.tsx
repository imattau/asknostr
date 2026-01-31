import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import { useStore } from './store/useStore'
import { useUiStore } from './store/useUiStore'
import type { Layer } from './store/useUiStore'
import { VirtualFeed } from './components/VirtualFeed'

import { RelayList } from './components/RelayList'
import { MediaServers } from './components/MediaServers'
import { ErrorLog } from './components/ErrorLog'
import { SwipeLayout } from './components/layouts/SwipeLayout'
import { ClassicLayout } from './components/layouts/ClassicLayout'
import { FeedComposer } from './components/FeedComposer'
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
import { useRelays } from './hooks/useRelays'
import { useDeletions } from './hooks/useDeletions'
import { useFeed } from './hooks/useFeed'
import { useSocialGraph } from './hooks/useSocialGraph'
import { useSubscriptions } from './hooks/useSubscriptions'
import { torrentService } from './services/torrentService'
import type { CommunityDefinition } from './hooks/useCommunity'
import type { Event } from 'nostr-tools'

function App() {
  const { isConnected, user, login, logout } = useStore()

  const { layout, setLayout, theme, setTheme, stack, popLayer, pushLayer, resetStack } = useUiStore()

    const { muted = [], following = [] } = useSocialGraph()

    useSubscriptions() 

    useRelays()

    useEffect(() => {
      torrentService.init().catch(err => console.error('[App] Torrent init failed:', err))
    }, [])

    useEffect(() => {
      if (following && following.length > 0) {
        torrentService.setFollowedUsers(following)
      }
    }, [following])

    useEffect(() => {
      if (user.pubkey) {
        torrentService.refreshRemoteSeedList().catch(() => {})
      }
    }, [user.pubkey])

    // Set default view for logged-in users on mobile
    useEffect(() => {
      if (user.pubkey && layout === 'swipe' && stack.length === 1 && stack[0].type === 'feed') {
        resetStack({ id: 'system-control', type: 'sidebar', title: 'System_Control' })
      }
    }, [user.pubkey, layout, stack.length, resetStack])

  // Fetch global events for trends
  const { data: trendEvents = [] } = useFeed({ 
    filters: [{ kinds: [1], limit: 100 }],
    limit: 100,
    live: true
  });

  const [composerCollapsed, setComposerCollapsed] = useState(false)
  const [isHeaderHidden, setIsHeaderHidden] = useState(false)

  const feedRef = useRef<VirtuosoHandle | null>(null)
  const lastScrollTop = useRef(0)

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
  
  const renderLayerContent = useCallback((layer: Layer) => {
    switch (layer.type) {
      case 'sidebar':
        return <Sidebar />
      case 'communities':
        return <Communities />
      case 'feed': {
        const params = layer.params as { filter?: { '#t'?: string[] } } | undefined
        const tagFilter = params?.filter?.['#t']
        const firstTag = tagFilter?.[0]
        
        return (
          <MainFeed 
            firstTag={firstTag}
            user={user}
            composerCollapsed={composerCollapsed}
            setComposerCollapsed={setComposerCollapsed}
            isHeaderHidden={isHeaderHidden}
            handleFeedScroll={handleFeedScroll}
            feedRef={feedRef}
            muted={muted}
          />
        )
      }

      case 'thread': return (
        <Thread 
          eventId={layer.params?.eventId as string} 
          rootEvent={layer.params?.rootEvent as Event} 
          forceFullThread={layer.params?.forceFullThread as boolean}
        />
      )
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
  }, [user, composerCollapsed, isHeaderHidden, handleFeedScroll, muted, pushLayer, feedRef]) 

  if (layout === 'swipe') {
    return (
      <SwipeLayout
        theme={theme}
        layout={layout}
        setLayout={setLayout}
        setTheme={setTheme}
        isHeaderHidden={isHeaderHidden}
        user={user}
        login={login}
        logout={logout}
        isFeedFetching={false}
        isFeedLoading={false}
        pushLayer={pushLayer}
        renderLayerContent={renderLayerContent}
      />
    )
  }

  return (
    <ClassicLayout
      theme={theme}
      layout={layout}
      setLayout={setLayout}
      setTheme={setTheme}
      renderLayerContent={renderLayerContent}
      isHeaderHidden={isHeaderHidden}
      isFeedLoading={false}
      isFeedFetching={false}
      isConnected={isConnected}
      user={user}
      login={login}
      logout={logout}
      stack={stack}
      popLayer={popLayer}
      pushLayer={pushLayer}
      events={trendEvents}
    />
  )
}

function MainFeed({ 
  firstTag, user, composerCollapsed, setComposerCollapsed, 
  isHeaderHidden, handleFeedScroll, feedRef, muted = [] 
}: any) {
  const feedFilters = useMemo(() => [{ kinds: [1], limit: 50 }], []);
  const { data: events = [], fetchMore, isFetchingMore, pendingCount, flushBuffer } = useFeed({ 
    filters: feedFilters,
    live: true,
    manualFlush: true 
  });

  useEffect(() => {
    if (!events || events.length === 0) return
    const processEvents = () => {
      events.slice(0, 50).forEach(e => torrentService.processEvent(e))
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(processEvents)
    else setTimeout(processEvents, 1000)
  }, [events])

  const { data: deletedIds = [] } = useDeletions(events ? events.slice(0, 500) : [])
  const deletedSet = useMemo(() => new Set(deletedIds || []), [deletedIds])

  const filteredEvents = useMemo(() => {
    if (!events) return []
    const result = (firstTag 
      ? events.filter(e => e.tags?.some(t => t[0] === 't' && t[1]?.toLowerCase() === firstTag.toLowerCase()))
      : events).filter(e => e && !deletedSet.has(e.id) && !(muted || []).includes(e.pubkey))
    
    return result;
  }, [events, firstTag, deletedSet, muted])

  return (
    <div className="h-full flex flex-col min-h-0 relative">
      <FeedComposer 
        user={user} 
        collapsed={composerCollapsed} 
        setCollapsed={setComposerCollapsed} 
        isHidden={isHeaderHidden} 
      />
      
      {pendingCount > 0 && (
        <div className={`absolute left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-300 ${isHeaderHidden ? 'top-2' : composerCollapsed ? 'top-14' : 'top-28'}`}>
          <button
            onClick={() => {
              flushBuffer(100)
              feedRef.current?.scrollToIndex({ index: 0, align: 'start', behavior: 'smooth' })
            }}
            className="bg-cyan-500 text-black text-[10px] font-black uppercase px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.5)] border border-cyan-400 hover:bg-cyan-400 transition-all flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            {pendingCount} New_Logic_Streams
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 relative w-full">
        <VirtualFeed 
          ref={feedRef} 
          events={filteredEvents} 
          isLoadingMore={isFetchingMore} 
          onLoadMore={() => fetchMore()} 
          onScroll={handleFeedScroll} 
        />
      </div>
    </div>
  )
}

export default App

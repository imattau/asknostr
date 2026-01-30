import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
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

    const { muted, following } = useSocialGraph()

  

    useSubscriptions() 

    useRelays()

  

    useEffect(() => {

      torrentService.init().catch(err => console.error('[App] Torrent init failed:', err))

    }, [])

  

    useEffect(() => {

      torrentService.setFollowedUsers(following)

    }, [following])

  

    // Use the new useFeed hook for event data

    const feedFilters = useMemo(() => [{ kinds: [1], limit: 50 }], []);

    const { data: events = [], isLoading: isFeedLoading, isFetching: isFeedFetching, fetchMore, isFetchingMore } = useFeed({ 

      filters: feedFilters,

      live: false // Disable live updates for background discovery feed

    });

  

    useEffect(() => {

      // Process new events for social seeding during idle time

      if (!events.length) return

  

      const processEvents = () => {

        // Only process the most recent events to save CPU

        const recent = events.slice(0, 50)

        recent.forEach(e => torrentService.processEvent(e))

      }

  

      if ('requestIdleCallback' in window) {

        window.requestIdleCallback(processEvents)

      } else {

        setTimeout(processEvents, 1000)

      }

    }, [events])

  

    const deletionEvents = useMemo(() => events.slice(0, 500), [events])

    const { data: deletedIds = [] } = useDeletions(deletionEvents)

    const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds])

  

    // Set default view for logged-in users on mobile

    useEffect(() => {

      if (user.pubkey && layout === 'swipe' && stack.length === 1 && stack[0].type === 'feed') {

        resetStack({ id: 'system-control', type: 'sidebar', title: 'System_Control' })

      }

    }, [user.pubkey, layout])

  



  const [composerCollapsed, setComposerCollapsed] = useState(false)

  const [isHeaderHidden, setIsHeaderHidden] = useState(false)

  const feedRef = useRef<any>(null)
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
        
        // Local component to handle filtering and prevent App re-renders from filtering on every tick
        return (
          <FeedContainer 
            events={events}
            firstTag={firstTag}
            deletedSet={deletedSet}
            muted={muted}
            user={user}
            composerCollapsed={composerCollapsed}
            setComposerCollapsed={setComposerCollapsed}
            isHeaderHidden={isHeaderHidden}
            isFetchingMore={isFetchingMore}
            fetchMore={fetchMore}
            handleFeedScroll={handleFeedScroll}
            feedRef={feedRef}
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
  }, [events, deletedSet, muted, user, composerCollapsed, isHeaderHidden, isFetchingMore, fetchMore, handleFeedScroll])

// ... (existing code below)

function FeedContainer({ 
  events, firstTag, deletedSet, muted, user, 
  composerCollapsed, setComposerCollapsed, isHeaderHidden, 
  isFetchingMore, fetchMore, handleFeedScroll, feedRef 
}: any) {
  const filteredEvents = useMemo(() => {
    return (firstTag 
      ? events.filter(e => e.tags.some(t => t[0] === 't' && t[1]?.toLowerCase() === firstTag.toLowerCase()))
      : events).filter(e => !deletedSet.has(e.id) && !muted.includes(e.pubkey))
  }, [events, firstTag, deletedSet, muted])

  return (
    <div className="h-full flex flex-col">
      <FeedComposer 
        user={user} 
        collapsed={composerCollapsed} 
        setCollapsed={setComposerCollapsed} 
        isHidden={isHeaderHidden} 
      />
      <div className="flex-1 min-h-0 relative">
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
        isFeedFetching={isFeedFetching}
        isFeedLoading={isFeedLoading}
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
      events={events}
      isFeedLoading={isFeedLoading}
      isFeedFetching={isFeedFetching}
      isConnected={isConnected}
      user={user}
      login={login}
      logout={logout}
      stack={stack}
      popLayer={popLayer}
      pushLayer={pushLayer}
    />
  )
}

export default App

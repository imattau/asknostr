import React from 'react'
import { useUiStore } from '../store/useUiStore'
import { Hash, Users, TrendingUp, Shield, Star, Plus, Zap, Search as SearchIcon, Globe } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useFollowerSuggestions } from '../hooks/useFollowerSuggestions'
import { useTrendingCommunities } from '../hooks/useTrendingCommunities'
import { useGlobalDiscovery } from '../hooks/useGlobalDiscovery'
import { useMyCommunities } from '../hooks/useMyCommunities'
import { useHandlers } from '../hooks/useHandlers'
import { formatPubkey, shortenPubkey } from '../utils/nostr'
import type { CommunityDefinition } from '../hooks/useCommunity'

const SUGGESTED_COMMUNITIES = [
  { id: 'nostr', title: 'Nostr General', description: 'The global town square', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'asknostr', title: 'AskNostr', description: 'Q&A for the protocol', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'bitcoin', title: 'Bitcoin', description: 'Digital gold discussions', creator: '3bf0c63fcb291d42a4216c815610ec2203679da1597793a35205574347713f0a' },
]

export const Communities: React.FC = () => {
  const { pushLayer } = useUiStore()
  const { subscribedCommunities } = useSubscriptions()
  const { data: suggestions = [], isLoading: isSuggestionsLoading } = useFollowerSuggestions()
  const { data: trending = [] } = useTrendingCommunities()
  const { data, isLoading: isGlobalLoading } = useGlobalDiscovery()
  const globalNodes = data?.communities || []
  const discoveryFallback = data?.usedFallback || false
  const { data: myNodes = [] } = useMyCommunities()
  const { data: handlers = [], isLoading: isHandlersLoading } = useHandlers([1, 34550])

  console.log('[CommunitiesUI] myNodes:', myNodes.length, 'globalNodes:', globalNodes.length)

  const selectCommunity = (id: string, creator: string) => {
    pushLayer({
      id: `community-${id}`,
      type: 'community',
      title: `c/${id}`,
      params: { communityId: id, creator }
    })
  }

  return (
    <div className="p-4 space-y-6 min-w-0">
      {/* 1. Admin Section */}
      {myNodes.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" /> My_Administered_Stations
          </h3>
          <div className="grid gap-2">
            {myNodes.map((s: CommunityDefinition) => (
              <button
                key={`${s.creator}:${s.id}`}
                onClick={() => selectCommunity(s.id, s.creator)}
                className="terminal-border p-3 text-left glassmorphism border-cyan-500/20 hover:bg-cyan-500/10 transition-colors group flex justify-between items-center min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Hash size={14} className="text-cyan-400 shrink-0" />
                  <span className="text-slate-50 font-bold truncate">{s.name || s.id}</span>
                </div>
                <span className="text-[8px] text-slate-500 font-mono uppercase shrink-0 ml-2">Role: OWNER</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 2. Subscribed Section */}
      {subscribedCommunities.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Star size={14} className="text-yellow-500" /> Joined_Stations
          </h3>
          <div className="grid gap-2">
            {subscribedCommunities.map((a) => {
              const parts = a.split(':')
              if (parts.length < 3) return null
              const [kind, pubkey, id] = parts
              return (
                <button
                  key={a}
                  onClick={() => selectCommunity(id, pubkey)}
                  className="terminal-border p-3 text-left glassmorphism border-yellow-500/20 hover:bg-yellow-500/10 transition-colors group flex justify-between items-center min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0">
                      <Hash size={14} className="text-yellow-500" />
                    </div>
                    <span className="text-slate-50 font-bold truncate">{id}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-mono shrink-0 ml-2">REF://{kind}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 3. Trending Section */}
      {trending.length > 0 && (
        <section className="min-w-0">
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-cyan-500" /> Network_Pulse_Trending
          </h3>
          <div className="grid gap-2">
            {trending.map((t) => (
              <button
                key={t.aTag}
                onClick={() => selectCommunity(t.id, t.pubkey)}
                className="terminal-border p-3 text-left glassmorphism border-cyan-500/20 hover:bg-cyan-500/10 transition-colors group flex justify-between items-center min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Hash size={14} className="text-cyan-500 shrink-0" />
                  <span className="text-slate-50 font-bold truncate">{t.id}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-[8px] text-slate-500 font-mono">ACTIVITY:{t.count}</span>
                  <Zap size={12} className="text-yellow-500 opacity-50" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 4. Handlers Section */}
      {(handlers.length > 0 || isHandlersLoading) && (
        <section className="min-w-0">
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Globe size={14} className="text-cyan-500" /> Specialized_Network_Apps
          </h3>
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar min-w-0">
            {isHandlersLoading && handlers.length === 0 ? (
              <div className="flex gap-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-shrink-0 w-40 sm:w-48 h-32 terminal-border glassmorphism animate-pulse bg-white/5" />
                ))}
              </div>
            ) : (
              handlers.map((h) => (
                <a
                  key={h.id}
                  href={h.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 w-40 sm:w-48 terminal-border p-4 glassmorphism border-slate-800 hover:border-cyan-500/30 transition-all flex flex-col items-center text-center min-w-0"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-900 border border-slate-800 overflow-hidden mb-3 flex items-center justify-center shrink-0">
                    {h.image ? (
                      <img src={h.image} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Globe size={24} className="text-cyan-500/50" />
                    )}
                  </div>
                  <span className="text-[10px] font-bold text-slate-50 uppercase tracking-tighter mb-1 line-clamp-1 w-full">{h.name || h.id}</span>
                  <p className="text-[8px] text-slate-500 line-clamp-2 italic h-6 w-full">{h.about || 'No app description.'}</p>
                  <div className="mt-3 flex gap-1 flex-wrap justify-center">
                    {h.kTags.slice(0, 2).map(k => (
                      <span key={k} className="text-[7px] bg-cyan-500/10 text-cyan-500 px-1 rounded border border-cyan-500/20">K:{k}</span>
                    ))}
                  </div>
                </a>
              ))
            )}
          </div>
        </section>
      )}

      {/* 5. Trust Suggestions */}
      {(suggestions.length > 0 || isSuggestionsLoading) && (
        <section className="min-w-0">
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-purple-500" /> Trust_Network_Suggestions
          </h3>
          <div className="grid gap-2">
            {isSuggestionsLoading && suggestions.length === 0 ? (
              <div className="space-y-2">
                {[1, 2].map(i => (
                  <div key={i} className="h-14 terminal-border glassmorphism animate-pulse bg-white/5" />
                ))}
              </div>
            ) : (
              suggestions.map((s) => (
                <button
                  key={`${s.creator}:${s.id}`}
                  onClick={() => selectCommunity(s.id, s.creator)}
                  className="terminal-border p-4 text-left glassmorphism border-purple-500/20 hover:bg-purple-500/10 transition-colors group min-w-0"
                >
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <span className="text-purple-400 font-bold flex items-center gap-1 truncate">
                      <Hash size={16} className="shrink-0" /> {s.name || s.id}
                    </span>
                    <Users size={14} className="opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate">By: {shortenPubkey(formatPubkey(s.creator))}</p>
                </button>
              ))
            )}
          </div>
        </section>
      )}

      {/* 6. Discovery Nodes */}
      <section className="min-w-0">
        <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
          <TrendingUp size={14} /> Discovery_Nodes
        </h3>
        <div className="grid gap-2">
          <button
            onClick={() => pushLayer({ id: 'search-global', type: 'search', title: 'Global_Search' })}
            className="terminal-border p-4 text-left bg-cyan-500/10 border-cyan-500/30 hover:bg-cyan-500/20 transition-all group flex items-center justify-between min-w-0"
          >
            <div className="min-w-0 mr-2">
              <span className="text-cyan-400 font-bold flex items-center gap-1 uppercase tracking-tighter truncate">
                <SearchIcon size={16} className="shrink-0" /> Global_Network_Query
              </span>
              <p className="text-[10px] opacity-50 uppercase mt-1 truncate">Search keywords, hashtags, and verified IDs</p>
            </div>
            <Zap size={20} className="text-cyan-500 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>

          <button
            onClick={() => pushLayer({ id: 'create-community', type: 'createcommunity', title: 'Station_Setup' })}
            className="terminal-border p-4 text-left bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 transition-all group flex items-center justify-between min-w-0"
          >
            <div className="min-w-0 mr-2">
              <span className="text-purple-400 font-bold flex items-center gap-1 uppercase tracking-tighter truncate">
                <Plus size={16} className="shrink-0" /> Create_New_Station
              </span>
              <p className="text-[10px] opacity-50 uppercase mt-1 truncate">Initialize a custom moderated node</p>
            </div>
            <Shield size={20} className="text-purple-500 opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
          </button>

          {isGlobalLoading && globalNodes.length === 0 && (
            <div className="p-8 text-center animate-pulse opacity-30 font-mono text-[10px] uppercase">
              Scanning_Relay_Network_For_Nodes...
            </div>
          )}

          {globalNodes.map((s) => (
            <button
              key={`${s.creator}:${s.id}`}
              onClick={() => selectCommunity(s.id, s.creator)}
              className="terminal-border p-4 text-left glassmorphism border-slate-800 hover:border-purple-500/30 transition-all group flex items-center gap-4 min-w-0"
            >
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-lg shadow-purple-500/10 shrink-0">
                {s.image ? (
                  <img src={s.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Hash size={18} className="text-purple-500/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1 gap-2">
                  <span className="text-slate-50 font-bold uppercase tracking-tight truncate">{s.name || s.id}</span>
                  <span className="text-[8px] text-slate-600 font-mono bg-white/5 px-1 rounded shrink-0">ID:{s.id.slice(0, 8)}</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1 italic">{s.description || 'No manifest provided.'}</p>
              </div>
            </button>
          ))}

          {discoveryFallback && (
            <div className="mt-3 p-3 text-[9px] font-mono uppercase tracking-[0.3em] text-amber-300 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              Discovery relays ran out; falling back to your saved nodes.
            </div>
          )}

          {globalNodes.length === 0 && !isGlobalLoading && SUGGESTED_COMMUNITIES.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCommunity(c.id, c.creator)}
              className="terminal-border p-4 text-left hover:bg-white/5 transition-colors group min-w-0"
            >
              <div className="flex justify-between items-start mb-1 gap-2">
                <span className="text-slate-200 font-bold flex items-center gap-1 truncate">
                  <Hash size={16} className="shrink-0" /> {c.id}
                </span>
                <Users size={14} className="opacity-30 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <p className="text-[10px] text-slate-500 truncate">{c.description}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

import React from 'react'
import { useUiStore } from '../store/useUiStore'
import { Hash, Users, TrendingUp, Shield, Star, Plus, Zap } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useFollowerSuggestions } from '../hooks/useFollowerSuggestions'
import { useTrendingCommunities } from '../hooks/useTrendingCommunities'
import { useGlobalDiscovery } from '../hooks/useGlobalDiscovery'
import { useMyCommunities } from '../hooks/useMyCommunities'
import { formatPubkey, shortenPubkey } from '../utils/nostr'

// Example communities with their creator pubkeys (placeholders)
const SUGGESTED_COMMUNITIES = [
  { id: 'nostr', title: 'Nostr General', description: 'The global town square', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'asknostr', title: 'AskNostr', description: 'Q&A for the protocol', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'bitcoin', title: 'Bitcoin', description: 'Digital gold discussions', creator: '3bf0c63fcb291d42a4216c815610ec2203679da1597793a35205574347713f0a' },
]

export const Communities: React.FC = () => {
  const { pushLayer } = useUiStore()
  const { subscribedCommunities } = useSubscriptions()
  const { data: suggestions = [] } = useFollowerSuggestions()
  const { data: trending = [] } = useTrendingCommunities()
  const { data: globalNodes = [], isLoading: isGlobalLoading } = useGlobalDiscovery()
  const { data: myNodes = [] } = useMyCommunities()

  const selectCommunity = (id: string, creator: string) => {
    pushLayer({
      id: `community-${id}`,
      type: 'community',
      title: `c/${id}`,
      params: { communityId: id, creator }
    })
  }

  return (
    <div className="p-4 space-y-6">
      {myNodes.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Shield size={14} className="text-cyan-400" /> My_Administered_Stations
          </h3>
          <div className="grid gap-2">
            {myNodes.map((s) => (
              <button
                key={`${s.creator}:${s.id}`}
                onClick={() => selectCommunity(s.id, s.creator)}
                className="terminal-border p-3 text-left glassmorphism border-cyan-500/20 hover:bg-cyan-500/10 transition-colors group flex justify-between items-center"
              >
                <div className="flex items-center gap-2">
                  <Hash size={14} className="text-cyan-400" />
                  <span className="text-slate-50 font-bold">{s.name || s.id}</span>
                </div>
                <span className="text-[8px] text-slate-500 font-mono uppercase">Role: OWNER</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {subscribedCommunities.length > 0 && (
        <section>
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
                  className="terminal-border p-3 text-left glassmorphism border-yellow-500/20 hover:bg-yellow-500/10 transition-colors group flex justify-between items-center"
                >
                  <span className="text-slate-50 font-bold flex items-center gap-1">
                    <Hash size={14} className="text-yellow-500" /> {id}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">REF://{kind}</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {trending.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <TrendingUp size={14} className="text-cyan-500" /> Network_Pulse_Trending
          </h3>
          <div className="grid gap-2">
            {trending.map((t) => (
              <button
                key={t.aTag}
                onClick={() => selectCommunity(t.id, t.pubkey)}
                className="terminal-border p-3 text-left glassmorphism border-cyan-500/20 hover:bg-cyan-500/10 transition-colors group flex justify-between items-center"
              >
                <div className="flex items-center gap-2">
                  <Hash size={14} className="text-cyan-500" />
                  <span className="text-slate-50 font-bold">{t.id}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[8px] text-slate-500 font-mono">ACTIVITY:{t.count}</span>
                  <Zap size={12} className="text-yellow-500 opacity-50" />
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {suggestions.length > 0 && (
        <section>
          <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
            <Zap size={14} className="text-purple-500" /> Trust_Network_Suggestions
          </h3>
          <div className="grid gap-2">
            {suggestions.map((s) => (
              <button
                key={`${s.creator}:${s.id}`}
                onClick={() => selectCommunity(s.id, s.creator)}
                className="terminal-border p-4 text-left glassmorphism border-purple-500/20 hover:bg-purple-500/10 transition-colors group"
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-purple-400 font-bold flex items-center gap-1">
                    <Hash size={16} /> {s.name || s.id}
                  </span>
                  <Users size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[10px] text-slate-500 font-mono">By: {shortenPubkey(formatPubkey(s.creator))}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
          <TrendingUp size={14} /> Discovery_Nodes
        </h3>
        <div className="grid gap-2">
          <button
            onClick={() => pushLayer({ id: 'create-community', type: 'createcommunity', title: 'Station_Setup' })}
            className="terminal-border p-4 text-left bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 transition-all group flex items-center justify-between"
          >
            <div>
              <span className="text-purple-400 font-bold flex items-center gap-1 uppercase tracking-tighter">
                <Plus size={16} /> Create_New_Station
              </span>
              <p className="text-[10px] opacity-50 uppercase mt-1">Initialize a custom moderated node</p>
            </div>
            <Shield size={20} className="text-purple-500 opacity-30 group-hover:opacity-100 transition-opacity" />
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
              className="terminal-border p-4 text-left glassmorphism border-slate-800 hover:border-purple-500/30 transition-all group flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center shadow-lg shadow-purple-500/10">
                {s.image ? (
                  <img src={s.image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Hash size={18} className="text-purple-500/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-slate-50 font-bold uppercase tracking-tight truncate">{s.name || s.id}</span>
                  <span className="text-[8px] text-slate-600 font-mono bg-white/5 px-1 rounded ml-2">ID:{s.id.slice(0, 8)}</span>
                </div>
                <p className="text-[10px] text-slate-500 line-clamp-1 italic">{s.description || 'No manifest provided.'}</p>
              </div>
            </button>
          ))}

          {/* Fallback to suggestions if global discovery fails or is empty */}
          {globalNodes.length === 0 && !isGlobalLoading && SUGGESTED_COMMUNITIES.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCommunity(c.id, c.creator)}
              className="terminal-border p-4 text-left hover:bg-white/5 transition-colors group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-slate-200 font-bold flex items-center gap-1">
                  <Hash size={16} /> {c.id}
                </span>
                <Users size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-[10px] text-slate-500">{c.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
          <Shield size={14} /> System_Menu
        </h3>
        <div className="grid gap-2 text-sm uppercase font-bold">
          <button 
            onClick={() => pushLayer({ id: 'profile-editor', type: 'profile', title: 'Identity_Config' })}
            className="terminal-border p-3 text-left hover:bg-white/5 transition-all"
          >
            [0] Profile_Editor
          </button>
          <button 
            onClick={() => pushLayer({ id: 'relays-config', type: 'relays', title: 'Node_Network' })}
            className="terminal-border p-3 text-left hover:bg-white/5 transition-all"
          >
            [1] Relay_Configuration
          </button>
          <button 
            onClick={() => {
              if (window.confirm('Terminate session and disconnect from local nodes?')) {
                const { logout } = useStore.getState();
                logout();
                triggerHaptic(50);
              }
            }}
            className="terminal-border p-3 text-left hover:bg-red-500/10 text-red-500/70 hover:text-red-500 transition-all"
          >
            [2] System_Logout
          </button>
        </div>
      </section>
    </div>
  )
}
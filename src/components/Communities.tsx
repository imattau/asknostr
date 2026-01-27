import React from 'react'
import { useUiStore } from '../store/useUiStore'
import { Hash, Users, TrendingUp, Shield, Star, Plus, Zap } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'
import { useFollowerSuggestions } from '../hooks/useFollowerSuggestions'
import { useTrendingCommunities } from '../hooks/useTrendingCommunities'
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

          {SUGGESTED_COMMUNITIES.map((c) => (
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
          <button className="terminal-border p-3 text-left hover:bg-white/5">
            [0] Profile_Editor
          </button>
          <button className="terminal-border p-3 text-left hover:bg-white/5">
            [1] Relay_Configuration
          </button>
          <button className="terminal-border p-3 text-left hover:bg-white/5 text-red-500/70">
            [2] System_Logout
          </button>
        </div>
      </section>
    </div>
  )
}
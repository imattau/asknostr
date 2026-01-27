import React from 'react'
import { useUiStore } from '../store/useUiStore'
import { Hash, Users, TrendingUp, Shield, Star } from 'lucide-react'
import { useSubscriptions } from '../hooks/useSubscriptions'

// Example communities with their creator pubkeys (placeholders)
const SUGGESTED_COMMUNITIES = [
  { id: 'nostr', title: 'Nostr General', description: 'The global town square', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'asknostr', title: 'AskNostr', description: 'Q&A for the protocol', creator: '82341f882b6eabcd2baed10abc274e1744161f3647b2c019904d9e262973752e' },
  { id: 'bitcoin', title: 'Bitcoin', description: 'Digital gold discussions', creator: '3bf0c63fcb291d42a4216c815610ec2203679da1597793a35205574347713f0a' },
]

export const Communities: React.FC = () => {
  const { pushLayer } = useUiStore()
  const { subscribedCommunities } = useSubscriptions()

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
              const [kind, pubkey, id] = a.split(':')
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

      <section>
        <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
          <TrendingUp size={14} /> Discovery_Nodes
        </h3>
        <div className="grid gap-2">
          {SUGGESTED_COMMUNITIES.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCommunity(c.id, c.creator)}
              className="terminal-border p-4 text-left hover:bg-[#00ff41]/10 transition-colors group"
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-[#00ff41] font-bold flex items-center gap-1">
                  <Hash size={16} /> {c.id}
                </span>
                <Users size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-xs opacity-50">{c.description}</p>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase opacity-50 mb-4 flex items-center gap-2">
          <Shield size={14} /> System_Menu
        </h3>
        <div className="grid gap-2 text-sm uppercase font-bold">
          <button className="terminal-border p-3 text-left hover:bg-[#00ff41]/20">
            [0] Profile_Editor
          </button>
          <button className="terminal-border p-3 text-left hover:bg-[#00ff41]/20">
            [1] Relay_Configuration
          </button>
          <button className="terminal-border p-3 text-left hover:bg-[#00ff41]/20 text-red-500">
            [2] System_Logout
          </button>
        </div>
      </section>
    </div>
  )
}

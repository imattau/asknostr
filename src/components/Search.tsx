import React, { useState } from 'react'
import { Search as SearchIcon, User, Globe, Hash, Zap, RefreshCw, ChevronRight } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { resolveNip05 } from '../utils/nip05'
import type { Event } from 'nostr-tools'
import { Post } from './Post'
import { triggerHaptic } from '../utils/haptics'

export const Search: React.FC = () => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Event[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [nip05Result, setNip05Result] = useState<{ pubkey: string, identifier: string } | null>(null)
  
  const { pushLayer } = useUiStore()

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setIsSearching(true)
    setResults([])
    setNip05Result(null)
    triggerHaptic(10)

    // 1. Try NIP-05 Resolution if it looks like an identifier
    if (query.includes('@')) {
      const res = await resolveNip05(query)
      if (res) {
        setNip05Result({ pubkey: res.pubkey, identifier: query })
      }
    }

    // 2. Network-wide search (NIP-50) for notes and communities
    await nostrService.subscribe(
      [{ kinds: [1, 34550], search: query, limit: 40 }],
      (event: Event) => {
        setResults(prev => {
          if (prev.find(e => e.id === event.id)) return prev
          return [...prev, event].sort((a, b) => b.created_at - a.created_at)
        })
      },
      nostrService.getSearchRelays()
    )

    // Give it some time to gather results
    setTimeout(() => setIsSearching(false), 3000)
  }

  return (
    <div className="p-6 space-y-8">
      <header className="terminal-border p-4 bg-cyan-500/10 border-cyan-500/30">
        <h2 className="text-xl font-bold text-cyan-400 uppercase flex items-center gap-2">
          <SearchIcon size={24} /> Network_Query_Interface
        </h2>
        <p className="text-[10px] opacity-70 uppercase mt-1">
          Scouring relays for keywords, hashtags, and verified identities
        </p>
      </header>

      <form onSubmit={handleSearch} className="relative">
        <input 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search keywords or user@domain.com..."
          className="w-full terminal-input rounded-xl pl-12 pr-4 py-4 text-base shadow-2xl"
        />
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
        <button 
          type="submit"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-cyan-500 rounded-lg text-white hover:bg-cyan-400 transition-all"
        >
          {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <ChevronRight size={18} />}
        </button>
      </form>

      {/* NIP-05 Result */}
      {nip05Result && (
        <section className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
            <Globe size={14} className="text-green-500" /> Verified_Identity_Found
          </h3>
          <button 
            onClick={() => pushLayer({ 
              id: `profile-${nip05Result.pubkey}`, 
              type: 'profile' as const, 
              title: 'Identity_Card',
              params: { pubkey: nip05Result.pubkey }
            })}
            className="w-full terminal-border p-4 text-left glassmorphism border-green-500/30 bg-green-500/5 hover:bg-green-500/10 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <User size={24} className="text-green-500" />
              </div>
              <div>
                <p className="text-slate-50 font-bold">{nip05Result.identifier}</p>
                <p className="text-[9px] text-slate-500 font-mono">{nip05Result.pubkey}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-green-500 opacity-30 group-hover:translate-x-1 transition-all" />
          </button>
        </section>
      )}

      {/* Results */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Hash size={14} /> Propagation_Results ({results.length})
          </h3>
          {isSearching && (
            <div className="flex items-center gap-2 text-cyan-500 text-[9px] font-bold animate-pulse">
              <Zap size={10} className="fill-cyan-500" /> CAPTURING_DATA_STREAM
            </div>
          )}
        </div>

        {results.length === 0 && !isSearching ? (
          <div className="py-20 text-center opacity-20 italic font-mono text-xs">
            [WAITING_FOR_QUERY_INPUT]
          </div>
        ) : (
          <div className="space-y-4">
            {results.map(event => {
              if (event.kind === 34550) {
                const dTag = event.tags.find(t => t[0] === 'd')?.[1] || ''
                const name = event.tags.find(t => t[0] === 'name')?.[1] || dTag
                const image = event.tags.find(t => t[0] === 'image')?.[1]
                return (
                  <button
                    key={event.id}
                    onClick={() => pushLayer({ 
                      id: `community-${dTag}`, 
                      type: 'community', 
                      title: `c/${dTag}`,
                      params: { communityId: dTag, creator: event.pubkey }
                    })}
                    className="w-full terminal-border p-4 text-left glassmorphism border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 transition-all group flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Hash size={20} className="text-purple-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-50 font-bold uppercase tracking-tight truncate">{name}</span>
                        <span className="text-[8px] bg-purple-500/20 text-purple-400 px-1 rounded font-mono">NODE</span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">ID: {dTag}</p>
                    </div>
                    <ChevronRight size={20} className="text-purple-500 opacity-30 group-hover:translate-x-1 transition-all" />
                  </button>
                )
              }
              return <Post key={event.id} event={event} />
            })}
          </div>
        )}
      </section>
    </div>
  )
}

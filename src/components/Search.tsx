import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Search as SearchIcon, User, Globe, Hash, RefreshCw, ChevronRight, Users, MessageSquare } from 'lucide-react'
import { useUiStore } from '../store/useUiStore'
import { nostrService } from '../services/nostr'
import { resolveNip05 } from '../utils/nip05'
import type { Event } from 'nostr-tools'
import { Post } from './Post'
import { triggerHaptic } from '../utils/haptics'

interface SearchParams {
  initialQuery?: string;
}

export const Search: React.FC = () => {
  const { stack, pushLayer } = useUiStore()
  const currentLayer = stack[stack.length - 1]
  const initialQuery = (currentLayer?.params as SearchParams)?.initialQuery || ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Event[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [nip05Result, setNip05Result] = useState<{ pubkey: string, identifier: string } | null>(null)
  // @ts-ignore
  const searchPerformedRef = useRef(false); // New ref to track if initial search was performed

  const handleSearch = useCallback(async (e?: React.FormEvent, forcedQuery?: string) => {
    if (e) e.preventDefault()
    const targetQuery = forcedQuery || query
    if (!targetQuery.trim()) return

    setIsSearching(true)
    setResults([])
    setNip05Result(null)
    triggerHaptic(10)

    // 1. Try NIP-05 Resolution if it looks like an identifier
    if (targetQuery.includes('@')) {
      const res = await resolveNip05(targetQuery)
      if (res) {
        setNip05Result({ pubkey: res.pubkey, identifier: targetQuery })
      }
    }

    // 2. Network-wide search (NIP-50) for notes, communities and profiles
    await nostrService.subscribe(
      [{ kinds: [1, 0, 34550], search: targetQuery, limit: 60 }],
      (event: Event) => {
        setResults(prev => {
          if (prev.find(e => e.id === event.id)) return prev
          return [...prev, event].sort((a, b) => b.created_at - a.created_at)
        })
      },
      nostrService.getSearchRelays()
    )

    // Give it some time to gather results
    setTimeout(() => setIsSearching(false), 4000)
  }, [query, setIsSearching, setResults, setNip05Result])

  // Auto-search if initialQuery provided
  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    
    const performInitialSearch = async () => {
      if (initialQuery && isMounted) {
        setIsSearching(true)
        setResults([])
        setNip05Result(null)
        triggerHaptic(10)
        
        const targetQuery = initialQuery;

        // 1. Try NIP-05 Resolution if it looks like an identifier
        if (targetQuery.includes('@')) {
          const res = await resolveNip05(targetQuery)
          if (res && isMounted) { // Check isMounted before setting state
            setNip05Result({ pubkey: res.pubkey, identifier: targetQuery })
          }
        }

        // 2. Network-wide search (NIP-50) for notes, communities and profiles
        const sub = await nostrService.subscribe(
          [{ kinds: [1, 0, 34550], search: targetQuery, limit: 60 }],
          (event: Event) => {
            if (isMounted) { // Check isMounted before setting state
              setResults(prev => {
                if (prev.find(e => e.id === event.id)) return prev
                return [...prev, event].sort((a, b) => b.created_at - a.created_at)
              })
            }
          },
          nostrService.getSearchRelays()
        );

        // Give it some time to gather results and then clean up subscription
        setTimeout(() => {
          if (isMounted) { // Check isMounted before setting state
            setIsSearching(false);
          }
          sub?.close();
        }, 4000);
      }
    };

    performInitialSearch();

    return () => {
      isMounted = false; // Cleanup on unmount
    };
  }, [initialQuery, setIsSearching, setResults, setNip05Result]); // Dependencies now include all state setters

  const categorizedResults = useMemo(() => {
    return {
      communities: results.filter(e => e.kind === 34550),
      profiles: results.filter(e => e.kind === 0),
      posts: results.filter(e => e.kind === 1)
    }
  }, [results])

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
              type: 'profile-view' as const, 
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

      {/* Categorized Results */}
      <div className="space-y-10">
        {isSearching && results.length === 0 && (
          <div className="flex items-center justify-center py-20 gap-3 text-cyan-500 animate-pulse">
            <RefreshCw className="animate-spin" size={20} />
            <span className="text-xs font-mono uppercase tracking-[0.3em]">Querying_Relay_Network...</span>
          </div>
        )}

        {!isSearching && results.length === 0 && (
          <div className="py-20 text-center opacity-20 italic font-mono text-xs">
            [WAITING_FOR_QUERY_INPUT]
          </div>
        )}

        {/* 1. Communities */}
        {categorizedResults.communities.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-mono font-bold text-purple-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-purple-500/20 pb-2">
              <Hash size={14} /> Discovered_Stations ({categorizedResults.communities.length})
            </h3>
            <div className="grid gap-3">
              {categorizedResults.communities.map(event => {
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
                      <span className="text-slate-50 font-bold uppercase tracking-tight truncate block">{name}</span>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5 uppercase tracking-tighter opacity-50 italic">{dTag}</p>
                    </div>
                    <ChevronRight size={20} className="text-purple-500 opacity-30 group-hover:translate-x-1 transition-all" />
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 2. Profiles */}
        {categorizedResults.profiles.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-emerald-500/20 pb-2">
              <Users size={14} /> Identity_Nodes ({categorizedResults.profiles.length})
            </h3>
            <div className="grid gap-3">
              {categorizedResults.profiles.map(event => {
                let metadata = { name: '', picture: '', about: '', display_name: '' }
                try { metadata = JSON.parse(event.content) } catch (error) { console.error("Failed to parse profile metadata", error); }
                const name = metadata.display_name || metadata.name || event.pubkey.slice(0, 8)
                return (
                  <button
                    key={event.id}
                    onClick={() => pushLayer({ 
                      id: `profile-${event.pubkey}`, 
                      type: 'profile-view', 
                      title: 'Identity_Card',
                      params: { pubkey: event.pubkey }
                    })}
                    className="w-full terminal-border p-4 text-left glassmorphism border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex-shrink-0 overflow-hidden flex items-center justify-center">
                      {metadata.picture ? <img src={metadata.picture} alt="" className="w-full h-full object-cover" /> : <User size={24} className="text-emerald-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-slate-50 font-bold tracking-tight truncate block">{name}</span>
                      <p className="text-[10px] text-slate-500 line-clamp-1 italic">{metadata.about || 'No biometric description found.'}</p>
                    </div>
                    <ChevronRight size={20} className="text-emerald-500 opacity-30 group-hover:translate-x-1 transition-all" />
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 3. Posts */}
        {categorizedResults.posts.length > 0 && (
          <section className="space-y-4">
            <h3 className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-[0.2em] flex items-center gap-2 border-b border-cyan-500/20 pb-2">
              <MessageSquare size={14} /> Logic_Streams ({categorizedResults.posts.length})
            </h3>
            <div className="space-y-4">
              {categorizedResults.posts.map(event => (
                <Post key={event.id} event={event} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

import React from 'react'
import { Layout, Terminal as TerminalIcon, LogIn, LogOut, PanelLeftOpen } from 'lucide-react'
import type { Layer } from '../store/useUiStore'

interface HeaderProps {
  theme: string
  layout: 'classic' | 'swipe'
  setLayout: (layout: 'classic' | 'swipe') => void
  setTheme: (theme: 'terminal' | 'modern' | 'light') => void
  isHeaderHidden: boolean
  user: { pubkey: string | null; profile: any | null }
  login: () => Promise<void>
  logout: () => void
  isFeedFetching: boolean
  isFeedLoading: boolean
  rightSidebarVisible?: boolean
  setRightSidebarVisible?: (visible: boolean) => void
  pushLayer: (layer: Layer) => void
}

export const Header: React.FC<HeaderProps> = ({
  theme,
  layout,
  setLayout,
  setTheme,
  isHeaderHidden,
  user,
  login,
  logout,
  isFeedFetching,
  isFeedLoading,
  rightSidebarVisible = true,
  setRightSidebarVisible,
  pushLayer,
}) => {
  const bgClass = theme === 'light' ? 'bg-white/80 border-slate-200' : 'bg-slate-950 border-slate-800'

  return (
    <header className={`border-b ${bgClass} flex items-center justify-between px-4 shrink-0 z-[1001] backdrop-blur-xl gap-2 overflow-hidden transition-all duration-300 ease-in-out ${isHeaderHidden ? 'h-0 opacity-0 border-b-0' : 'h-14 opacity-100'}`}>
      <div className="flex items-center gap-3 min-w-0">
        <img src="/asknostr_logo.png" alt="" className="w-7 h-7 rounded-full border border-slate-800 shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0" />
        <div className="flex flex-col min-w-0">
          <h1 className="text-sm font-black uppercase tracking-tighter gradient-text leading-none truncate">AskNostr_Core</h1>
          <span className="text-[7px] font-mono opacity-40 uppercase tracking-widest mt-0.5 truncate hidden sm:block">DECENTRALIZED_GATEWAY</span>
        </div>
      </div>
      <div className="flex gap-2 items-center uppercase font-bold text-[9px] font-mono shrink-0">
        <span className={`px-2 py-1 border rounded-full text-[8px] tracking-[0.3em] ${!isFeedFetching && !isFeedLoading ? 'text-emerald-300 border-emerald-500/40' : 'text-slate-400 border-slate-700'}`}>{!isFeedFetching && !isFeedLoading ? 'LIVE' : 'SYNCING'}</span>
        <button onClick={() => setLayout(layout === 'swipe' ? 'classic' : 'swipe')} className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400 hidden sm:flex"><Layout size={14} /> {layout === 'swipe' ? 'Classic' : 'Mobile'}</button>
        <button onClick={() => setTheme(theme === 'terminal' ? 'modern' : theme === 'modern' ? 'light' : 'terminal')} className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1 rounded border border-white/5 transition-all text-slate-400 hidden sm:flex"><TerminalIcon size={14} /> Theme: {theme}</button>
        {layout === 'classic' && !rightSidebarVisible && setRightSidebarVisible && (
          <button onClick={() => setRightSidebarVisible(true)} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] transition-all hover:bg-cyan-500/20" title="Expand Metadata Sidebar">
            <PanelLeftOpen size={14} /> <span className="text-[10px] uppercase font-bold tracking-tight">Expand_Metadata</span>
          </button>
        )}
        {!user.pubkey ? (
          <button onClick={() => { if (window.nostr) { login() } else { pushLayer({ id: 'connect-bunker', type: 'connectbunker', title: 'Connect' }) } }} className="flex items-center gap-1.5 bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"><LogIn size={14} /> Connect</button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,0.5)]" /><span className="text-slate-500 hidden sm:inline">Online</span></div>
            <button onClick={logout} className="flex items-center gap-1.5 bg-red-500/10 text-red-500 px-2 py-1 rounded border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] uppercase text-[9px] font-bold tracking-widest hover:bg-red-500/20 transition-all"><LogOut size={14} /> Exit</button>
          </div>
        )}
      </div>
    </header>
  )
}

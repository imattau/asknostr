import React from 'react'
import { useUiStore } from '../store/useUiStore'
import { useStore } from '../store/useStore'
import { Shield, User, Server, LogOut, Settings, ChevronRight, Circle, Layout, Search, Cpu, Key } from 'lucide-react'
import { triggerHaptic } from '../utils/haptics'

export const Sidebar: React.FC = () => {
  const { pushLayer, layout } = useUiStore()
  const { user, logout, loginMethod } = useStore()

  const menuItems = [
    { 
      id: 'communities-discovery', 
      type: 'communities' as const, 
      title: 'Communities', 
      label: 'Explore Stations', 
      icon: Layout,
      color: 'text-purple-400'
    },
    { 
      id: 'global-search', 
      type: 'search' as const, 
      title: 'Global_Search', 
      label: 'Network Query', 
      icon: Search,
      color: 'text-cyan-400'
    },
    { 
      id: 'profile-editor', 
      type: 'profile' as const, 
      title: 'Identity_Config', 
      label: 'Profile Editor', 
      icon: User,
      color: 'text-emerald-400'
    },
    { 
      id: 'relays-config', 
      type: 'relays' as const, 
      title: 'Node_Network', 
      label: 'Relay Configuration', 
      icon: Server,
      color: 'text-blue-400'
    },
  ]

  const handleLogout = () => {
    if (window.confirm('Terminate session and disconnect from local nodes?')) {
      logout()
      triggerHaptic(50)
    }
  }

  return (
    <div className={`h-full flex flex-col glassmorphism border-r border-slate-800 transition-all duration-300 ${layout === 'swipe' ? 'w-full' : 'w-64'}`}>
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-magenta-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Shield size={18} className="text-white" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs font-black text-slate-50 uppercase tracking-tighter">System_Control</span>
          <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest truncate">v0.1.0_ALPHA</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-8 overflow-y-auto custom-scrollbar">
        {!user.pubkey && (
          <section>
            <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
              <Circle size={8} className="fill-purple-500 text-purple-500" /> Authentication
            </h3>
            <div className="space-y-2">
              <button
                onClick={() => pushLayer({ id: 'connect-bunker', type: 'connectbunker', title: 'Remote_Signer' })}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all active:scale-95"
              >
                <Cpu size={18} />
                <span className="text-xs font-bold uppercase tracking-tight">Connect Bunker</span>
              </button>
            </div>
          </section>
        )}

        <section>
          <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
            <Circle size={8} className="fill-cyan-500 text-cyan-500" /> Authorized_Functions
          </h3>
          <div className="space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => pushLayer({ id: item.id, type: item.type, title: item.title })}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 group transition-all"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={`${item.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                  <span className="text-xs font-bold text-slate-400 group-hover:text-slate-100 transition-colors uppercase tracking-tight">
                    {item.label}
                  </span>
                </div>
                <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-400 transition-all group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </section>

        {user.pubkey && (
          <section>
            <h3 className="text-[10px] font-mono font-bold text-slate-600 uppercase tracking-[0.2em] mb-4 px-2 flex items-center gap-2">
              <Circle size={8} className="fill-red-500 text-red-500" /> Session_Termination
            </h3>
            <div className="px-2 mb-3">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800">
                <Key size={12} className="text-slate-500" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase leading-none mb-1">Method</span>
                  <span className="text-[9px] font-mono text-cyan-500 uppercase leading-none">{loginMethod}</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-500/10 group transition-all text-red-500/70 hover:text-red-500"
            >
              <LogOut size={18} className="opacity-70 group-hover:opacity-100" />
              <span className="text-xs font-bold uppercase tracking-tight">System_Logout</span>
            </button>
          </section>
        )}
      </div>

      <div className="p-6 border-t border-slate-800">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <Settings size={16} className="text-slate-500" />
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">UI_Engine</span>
            <span className="text-[8px] font-mono text-slate-600 truncate">{layout === 'swipe' ? 'SWIPE_STACK_v2' : 'CLASSIC_GRID_v1'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
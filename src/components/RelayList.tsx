import React from 'react'
import { useStore } from '../store/useStore'
import { DEFAULT_RELAYS } from '../services/nostr'
import { Server, Wifi, WifiOff, Info } from 'lucide-react'
import { useRelayInfo } from '../hooks/useRelayInfo'

const RelayItem: React.FC<{ url: string, isConnected: boolean }> = ({ url, isConnected }) => {
  const { data: info } = useRelayInfo(url)

  return (
    <div className="flex flex-col gap-2 p-4 glassmorphism border-slate-800 rounded-xl group hover:border-purple-500/30 transition-all">
      <div className="flex justify-between items-center">
        <div className="flex flex-col min-w-0">
          <span className="font-mono text-sm text-slate-50 truncate">{url}</span>
          <span className="text-[10px] text-slate-500 font-mono uppercase">
            {info?.software || 'Unknown'} {info?.version}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold ${isConnected ? "text-green-500" : "text-red-500"}`}>
            {isConnected ? 'ACTIVE' : 'OFFLINE'}
          </span>
          {isConnected ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-red-500" />}
        </div>
      </div>

      {info?.description && (
        <p className="text-[11px] text-slate-400 font-sans line-clamp-2 italic opacity-70 group-hover:opacity-100 transition-opacity">
          "{info.description}"
        </p>
      )}

      {info?.supported_nips && (
        <div className="flex flex-wrap gap-1 mt-1">
          {info.supported_nips.slice(0, 8).map(nip => (
            <span key={nip} className="text-[8px] bg-white/5 text-slate-500 px-1 rounded border border-white/5 font-mono">
              NIP-{nip}
            </span>
          ))}
          {info.supported_nips.length > 8 && (
            <span className="text-[8px] text-slate-600 font-mono">+{info.supported_nips.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  )
}

export const RelayList: React.FC = () => {
  const { isConnected } = useStore()

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-slate-50 uppercase flex items-center gap-2">
          <Server size={24} className="text-cyan-500" /> Node_Network_Map
        </h2>
        <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-2">
          <Info size={14} /> Global_Topology
        </div>
      </header>

      <div className="grid gap-4">
        {DEFAULT_RELAYS.map((url) => (
          <RelayItem key={url} url={url} isConnected={isConnected} />
        ))}
      </div>

      <div className="mt-8 p-4 bg-purple-500/5 border border-purple-500/20 rounded-lg text-[10px] uppercase font-mono text-slate-400 leading-relaxed">
        <p className="text-purple-400 font-bold mb-1">[!] SYSTEM_NOTICE</p>
        <p>Dynamic node negotiation is prioritized based on community-preferred relays. Local overrides are currently read-only.</p>
      </div>
    </div>
  )
}
import React from 'react'
import { useStore } from '../store/useStore'
import { DEFAULT_RELAYS } from '../services/nostr'
import { Server, Wifi, WifiOff } from 'lucide-react'

export const RelayList: React.FC = () => {
  const { isConnected } = useStore()

  return (
    <div className="terminal-border p-4 bg-black">
      <h2 className="text-xl font-bold uppercase mb-6 border-b-2 border-[#00ff41] pb-2 flex items-center gap-2">
        <Server size={20} /> Connected_Nodes
      </h2>
      <div className="space-y-4">
        {DEFAULT_RELAYS.map((url) => (
          <div key={url} className="flex justify-between items-center text-xs border-b border-[#00ff41]/10 pb-2">
            <div className="flex flex-col">
              <span className="font-mono">{url}</span>
              <span className="opacity-30 text-[9px] uppercase">Protocol: WSS | Port: 443</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={isConnected ? "text-[#00ff41]" : "text-red-500"}>
                {isConnected ? 'ACTIVE' : 'OFFLINE'}
              </span>
              {isConnected ? <Wifi size={14} className="text-[#00ff41]" /> : <WifiOff size={14} className="text-red-500" />}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 p-4 bg-[#00ff41]/5 border border-[#00ff41]/20 text-[10px] uppercase opacity-70">
        <p>[!] WARNING: Relay connection management is currently in READ_ONLY mode.</p>
        <p>[!] Update config.yaml to add/remove nodes.</p>
      </div>
    </div>
  )
}

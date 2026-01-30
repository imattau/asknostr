import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { Layer } from '../../store/useUiStore';
import { Sidebar } from '../Sidebar';
import { useTrendingTags } from '../../hooks/useTrendingTags';
import { Header } from '../Header';
import { torrentService } from '../../services/torrentService';
import type { Event } from 'nostr-tools';

interface ClassicLayoutProps {
  theme: string;
  layout: 'classic' | 'swipe';
  setLayout: (layout: 'classic' | 'swipe') => void;
  setTheme: (theme: 'terminal' | 'modern' | 'light') => void;
  isHeaderHidden: boolean;
  isConnected: boolean;
  user: { pubkey: string | null; profile: any | null };
  login: () => Promise<void>;
  logout: () => void;
  isFeedLoading: boolean;
  isFeedFetching: boolean;
  stack: Layer[];
  popLayer: () => void;
  pushLayer: (layer: Layer) => void;
  renderLayerContent: (layer: Layer) => React.ReactNode;
  events?: Event[];
}

interface ResizeHandleProps {
  index: number;
  columnWidths: Record<number, number>;
  onResize: (index: number, width: number) => void;
}

const ResizeHandle: React.FC<ResizeHandleProps> = ({ index, columnWidths, onResize }) => {
  const isResizing = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    const startX = e.pageX;
    const startWidth = columnWidths[index] || 500;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = startWidth + (moveEvent.pageX - startX);
      onResize(index, newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-cyan-500/50 transition-colors z-20 group"
    >
      <div className="absolute top-1/2 -translate-y-1/2 right-0 w-0.5 h-8 bg-slate-800 group-hover:bg-cyan-400 rounded-full" />
    </div>
  );
};

export const ClassicLayout: React.FC<ClassicLayoutProps> = ({
  theme, layout, setLayout, setTheme, isHeaderHidden, isConnected, user, login, logout,
  isFeedLoading, isFeedFetching, stack, popLayer, pushLayer, renderLayerContent,
  events = [],
}) => {
  const [rightSidebarVisible, setRightSidebarVisible] = useState(true);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [activeTorrents, setActiveTorrents] = useState<any[]>([]);
  const columnsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTorrents([...torrentService.getActiveTorrents()]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleResize = useCallback((index: number, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [index]: Math.max(300, Math.min(width, 1200)) }));
  }, []);

  const handleLayerClose = useCallback(
    (index: number) => {
      const layersToPop = stack.length - index;
      for (let i = 0; i < layersToPop; i++) {
        popLayer();
      }
    },
    [popLayer, stack.length]
  );

  const trendingTags = useTrendingTags(events);

  const bgCol = theme === 'light' ? 'bg-slate-50' : 'bg-[#05070A]';
  const headerClass = theme === 'light' ? 'bg-white/50 border-slate-200' : 'bg-slate-950/50 border-slate-800';
  const sidebarClass = theme === 'light' ? 'bg-slate-100/50 border-slate-200' : 'bg-slate-950/20 border-slate-800';
  const mutedText = theme === 'light' ? 'text-slate-500' : 'text-slate-400';
  const borderClass = theme === 'light' ? 'border-slate-200' : 'border-slate-800';
  const bgMuted = theme === 'light' ? 'bg-slate-100' : 'bg-slate-900';

  useEffect(() => {
    if (columnsContainerRef.current) {
      const container = columnsContainerRef.current;
      requestAnimationFrame(() => {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: 'smooth',
        });
      });
    }
  }, [stack.length]);

  return (
    <div className={`h-screen flex flex-col ${theme === 'terminal' ? 'terminal-theme' : theme === 'modern' ? 'modern-theme' : 'light-theme'} transition-colors duration-500`}>
      <Header
        theme={theme}
        layout={layout}
        setLayout={setLayout}
        setTheme={setTheme}
        isHeaderHidden={isHeaderHidden}
        user={user}
        login={login}
        logout={logout}
        isFeedFetching={isFeedFetching}
        isFeedLoading={isFeedLoading}
        rightSidebarVisible={rightSidebarVisible}
        setRightSidebarVisible={setRightSidebarVisible}
        pushLayer={pushLayer}
      />
      <div className="flex-1 flex overflow-hidden">
        <aside className={`w-64 border-r shrink-0 ${sidebarClass}`}>
          <Sidebar />
        </aside>
        <div
          ref={columnsContainerRef}
          className={`flex-1 flex overflow-x-auto overflow-y-hidden custom-scrollbar ${theme === 'light' ? 'bg-slate-100/30' : 'bg-slate-950/40'} scroll-smooth relative`}
        >
          {!rightSidebarVisible && (
            <button
              onClick={() => setRightSidebarVisible(true)}
              className={`absolute right-4 top-4 z-[1002] p-2 ${bgMuted} border ${borderClass} rounded-lg ${mutedText} hover:text-cyan-400 transition-all hidden xl:flex`}
              title="Expand Sidebar"
            >
              <PanelLeftOpen size={18} /> <span className="text-[10px] uppercase font-bold tracking-tight">Expand_Metadata</span>
            </button>
          )}
          {stack.map((layer, index) => (
            <div
              key={`${layer.id}-${index}`}
              className={`shrink-0 border-r ${borderClass} flex flex-col h-full min-h-0 ${bgCol} animate-in fade-in slide-in-from-right-4 duration-300 relative shadow-2xl overflow-visible`}
              style={{ width: `${columnWidths[index] || 500}px` }}
            >
              <header className={`h-14 border-b flex items-center px-4 gap-4 shrink-0 ${headerClass} backdrop-blur-md`}>
                {index > 0 && (
                  <button
                    onClick={() => handleLayerClose(index)}
                    className={`text-[10px] font-bold ${mutedText} hover:text-slate-300 uppercase tracking-tighter transition-colors`}
                  >
                    [CLOSE]
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <h2 className={`text-[10px] font-black uppercase tracking-[0.2em] truncate ${mutedText}`}>
                    {layer.title}
                  </h2>
                </div>
                <div className={`text-[8px] font-mono ${theme === 'light' ? 'opacity-40' : 'opacity-20'} uppercase`}>L:{index + 1}</div>
              </header>
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">{renderLayerContent(layer)}</div>
              <ResizeHandle index={index} columnWidths={columnWidths} onResize={handleResize} />
            </div>
          ))}
          <div className="flex-grow min-w-[100px]" />
        </div>
        <aside
          className={`border-l hidden xl:flex flex-col overflow-hidden transition-all duration-300 ${sidebarClass} ${
            rightSidebarVisible ? 'w-80 opacity-100' : 'w-0 opacity-0 border-l-0'
          }`}
        >
          <div className={`p-4 border-b shrink-0 flex justify-between items-center ${borderClass}`}>
            <span className={`text-[9px] font-mono font-bold ${theme === 'light' ? 'text-slate-500' : 'text-slate-600'} uppercase tracking-widest`}>
              Metadata_Feed
            </span>
            <button
              onClick={() => setRightSidebarVisible(false)}
              className={`p-1.5 ${theme === 'light' ? 'hover:bg-slate-200' : 'hover:bg-white/5'} rounded ${mutedText} hover:text-slate-300 transition-colors`}
            >
              <PanelLeftClose size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            <div className={`terminal-border glassmorphism p-5 rounded-2xl ${theme === 'light' ? 'border-slate-200' : 'border-slate-800/50'} shadow-xl`}>
              <h2 className={`text-[10px] font-mono font-bold uppercase ${mutedText} mb-4 border-b ${borderClass} pb-2 tracking-widest`}>
                Network_Status
              </h2>
              <div className="space-y-3 text-[10px] font-mono">
                <div className="flex justify-between items-center">
                  <span className="opacity-50 uppercase">Session:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full border ${
                      isConnected
                        ? 'text-green-500 border-green-500/20 bg-green-500/5'
                        : 'text-red-500 border-red-500/20 bg-red-500/5'
                    }`}
                  >
                    {isConnected ? 'STABLE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="opacity-50 uppercase">Buffer:</span>
                  <span className={`${theme === 'light' ? 'text-slate-700' : 'text-slate-300'} font-bold`}>{events.length}</span>
                </div>
              </div>
            </div>

            <div className={`terminal-border glassmorphism p-5 rounded-2xl ${theme === 'light' ? 'border-slate-200' : 'border-slate-800/50'} shadow-xl`}>
              <h2 className={`text-[10px] font-mono font-bold uppercase ${mutedText} mb-4 border-b ${borderClass} pb-2 tracking-widest`}>
                Storage_Contribution
              </h2>
              <div className="space-y-4 text-[10px] font-mono">
                <div className="flex justify-between items-center">
                  <span className="opacity-50 uppercase">Swarms:</span>
                  <span className="text-purple-500 font-bold">{activeTorrents.length} ACTIVE</span>
                </div>
                
                {activeTorrents.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {activeTorrents.slice(0, 3).map((t) => (
                      <div key={t.infoHash} className="space-y-1">
                        <div className="flex justify-between text-[8px] opacity-60">
                          <span className="truncate max-w-[120px] uppercase">{t.name || `Swarm_${t.infoHash.slice(0,6)}`}</span>
                          <span>{t.numPeers}P</span>
                        </div>
                        <div className="w-full bg-black/20 rounded-full h-1 overflow-hidden">
                          <div 
                            className="bg-purple-500 h-full transition-all duration-1000" 
                            style={{ width: `${(t.progress * 100)}%` }} 
                          />
                        </div>
                      </div>
                    ))}
                    {activeTorrents.length > 3 && (
                      <p className="text-[7px] opacity-30 text-center uppercase">+{activeTorrents.length - 3} more swarms</p>
                    )}
                  </div>
                )}

                {activeTorrents.length === 0 && (
                  <>
                    <div className="w-full bg-black/20 rounded-full h-1 overflow-hidden">
                      <div className="bg-purple-500 h-full animate-pulse" style={{ width: '0%' }} />
                    </div>
                    <p className="text-[8px] opacity-40 uppercase">Helping the community scale</p>
                  </>
                )}
              </div>
            </div>

            <div className={`terminal-border glassmorphism p-5 rounded-2xl ${theme === 'light' ? 'border-slate-200' : 'border-slate-800/50'} shadow-xl`}>
              <h2 className={`text-[10px] font-mono font-bold uppercase ${mutedText} mb-4 border-b ${borderClass} pb-2 tracking-widest`}>
                Signal_Trends
              </h2>
              <ul className="space-y-3">
                {trendingTags.length === 0 ? (
                  <li className="opacity-20 italic text-[10px] font-mono uppercase tracking-tighter py-4 text-center">
                    Monitoring_Broadcasts...
                  </li>
                ) : (
                  trendingTags.map(({ name, count }) => (
                    <li key={name} role="button" onClick={() => pushLayer({
                      id: `tag-feed-${name}-${Date.now()}`,
                      type: 'feed',
                      title: `Tag_${name.toUpperCase()}`,
                      params: { filter: { '#t': [name] } }
                    })} className="flex justify-between items-center group cursor-pointer">
                      <span className={`text-[10px] ${mutedText} group-hover:text-purple-400 transition-colors uppercase font-mono`}>
                        #{name}
                      </span>
                      <span className={`text-[8px] font-mono ${theme === 'light' ? 'text-slate-500 bg-slate-100' : 'text-slate-600 bg-white/5'} px-1.5 rounded`}>
                        {count}x
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

import React from 'react';
import { SwipeStack } from '../SwipeStack';
import { Header } from '../Header';
import type { Layer } from '../../store/useUiStore';

interface SwipeLayoutProps {
  theme: string;
  layout: 'classic' | 'swipe';
  setLayout: (layout: 'classic' | 'swipe') => void;
  setTheme: (theme: 'terminal' | 'modern' | 'light') => void;
  isHeaderHidden: boolean
  user: { pubkey: string | null; profile: any | null };
  login: () => Promise<void>;
  logout: () => void;
  isFeedFetching: boolean;
  isFeedLoading: boolean;
  pushLayer: (layer: Layer) => void;
  renderLayerContent: (layer: Layer) => React.ReactNode;
}

export const SwipeLayout: React.FC<SwipeLayoutProps> = ({
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
  pushLayer,
  renderLayerContent,
}) => {
  return (
    <div className={`h-screen w-full flex flex-col ${theme === 'terminal' ? 'terminal-theme' : theme === 'modern' ? 'modern-theme' : 'light-theme'}`}>
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
        pushLayer={pushLayer}
      />
      <main className="flex-1 overflow-hidden relative">
        <SwipeStack renderLayer={renderLayerContent} />
      </main>
    </div>
  );
};

import React from 'react';
import { Bot, Plus, Key, Radio, Compass } from 'lucide-react';

interface NavbarProps {
  activeTab: 'landing' | 'fleet' | 'studio';
  setActiveTab: (tab: 'landing' | 'fleet' | 'studio') => void;
  agentCount: number;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
  onOpenKeysModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  agentCount,
  openRouterKey,
  onOpenAuthModal,
  onOpenKeysModal
}) => {
  const tabs: Array<'landing' | 'fleet' | 'studio'> = ['landing', 'fleet', 'studio'];
  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
      const nextTab = tabs[nextIdx];
      setActiveTab(nextTab);
      document.getElementById(`nav-tab-${nextTab}`)?.focus();
    }
  };

  return (
    <header className="border-b border-zinc-200/70 bg-white/80 sticky top-0 z-40 backdrop-blur-md shadow-[0_2px_16px_rgba(0,0,0,0.02)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-xl p-1 -m-1 transition-transform active:scale-[0.98]"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white shadow-2xs">
            <Radio className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <span className="font-bold text-base tracking-tight text-zinc-950">
            AgentWire
          </span>
        </button>

        {/* Tab Navigation: ToneBird Pill Switcher */}
        <nav aria-label="Main navigation">
          <div aria-label="Workspace views" className="flex items-center bg-zinc-100/90 p-1 rounded-full border border-zinc-200/80 shadow-2xs" role="tablist">
            <button
              id="nav-tab-landing"
              type="button"
              role="tab"
              aria-selected={activeTab === 'landing'}
              aria-controls="main-content"
              onClick={() => setActiveTab('landing')}
              onKeyDown={e => handleTabKeyDown(e, 0)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                activeTab === 'landing'
                  ? 'bg-white text-zinc-950 border border-zinc-200 shadow-2xs font-semibold'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Overview</span>
            </button>
            <button
              id="nav-tab-fleet"
              type="button"
              role="tab"
              aria-selected={activeTab === 'fleet'}
              aria-controls="main-content"
              onClick={() => setActiveTab('fleet')}
              onKeyDown={e => handleTabKeyDown(e, 1)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                activeTab === 'fleet'
                  ? 'bg-white text-zinc-950 border border-zinc-200 shadow-2xs font-semibold'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/50'
              }`}
            >
              <Bot className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Fleet ({agentCount})</span>
            </button>
            <button
              id="nav-tab-studio"
              type="button"
              role="tab"
              aria-selected={activeTab === 'studio'}
              aria-controls="main-content"
              onClick={() => setActiveTab('studio')}
              onKeyDown={e => handleTabKeyDown(e, 2)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                activeTab === 'studio'
                  ? 'bg-white text-zinc-950 border border-zinc-200 shadow-2xs font-semibold'
                  : 'text-zinc-700 hover:text-zinc-950 hover:bg-white/50'
              }`}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>New Agent</span>
            </button>
          </div>
        </nav>

        {/* Auth & API Keys / Status Pills */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenKeysModal}
            aria-label="Manage API Keys"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-zinc-200 bg-white text-zinc-700 hover:text-zinc-950 hover:bg-zinc-50 text-xs font-mono transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <Key className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            <span className="hidden md:inline">API Keys</span>
          </button>

          <button
            type="button"
            onClick={onOpenAuthModal}
            aria-label={openRouterKey ? 'OpenRouter Active (Manage Key)' : 'Connect OpenRouter'}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 shadow-2xs hover:shadow-xs active:scale-[0.98] ${
              openRouterKey
                ? 'border-zinc-300 bg-white text-zinc-950 font-medium'
                : 'border-zinc-200 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            <span className="hidden sm:inline">
              {openRouterKey ? 'OpenRouter Active' : 'OpenRouter'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${openRouterKey ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-300'}`}
              aria-hidden="true"
            />
          </button>
        </div>

      </div>
    </header>
  );
};

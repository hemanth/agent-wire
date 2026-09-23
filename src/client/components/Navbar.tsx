import React from 'react';
import { Bot, Plus, Key, Radio, Compass } from 'lucide-react';

interface NavbarProps {
  activeTab: 'landing' | 'fleet' | 'studio';
  setActiveTab: (tab: 'landing' | 'fleet' | 'studio') => void;
  agentCount: number;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  agentCount,
  openRouterKey,
  onOpenAuthModal
}) => {
  return (
    <header className="border-b border-zinc-200/80 bg-white/95 sticky top-0 z-40 backdrop-blur-sm shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('landing')}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-lg p-1 -m-1"
        >
          <div className="w-8 h-8 rounded-lg bg-[#A9DEF9]/40 border border-[#82CBF5] flex items-center justify-center text-sky-950">
            <Radio className="w-4 h-4 text-sky-900" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-zinc-950">
                AgentWire
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-[#EDE7B1]/70 border border-[#DDD27C] text-amber-950 font-medium">
                MCP Edge
              </span>
            </div>
            <p className="text-xs text-zinc-500 hidden sm:block">
              Serverless MCP Agent Endpoints with OpenRouter Routing
            </p>
          </div>
        </button>

        {/* Tab Navigation */}
        <nav aria-label="Main Views" className="flex items-center bg-zinc-100 p-0.5 rounded-lg border border-zinc-200" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'landing'}
            onClick={() => setActiveTab('landing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'landing'
                ? 'bg-white text-zinc-950 border border-zinc-300/80 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Overview</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'fleet'}
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'fleet'
                ? 'bg-white text-zinc-950 border border-zinc-300/80 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
            }`}
          >
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fleet ({agentCount})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'studio'}
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'studio'
                ? 'bg-white text-zinc-950 border border-zinc-300/80 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>New Agent</span>
          </button>
        </nav>

        {/* Auth / Status */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenAuthModal}
            aria-label={openRouterKey ? 'OpenRouter Active (Manage Key)' : 'Connect OpenRouter'}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              openRouterKey
                ? 'border-[#A5E5BF] bg-[#D3F8E2]/50 text-emerald-950 hover:bg-[#D3F8E2]/70 shadow-xs'
                : 'border-zinc-300 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 shadow-xs'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            <span className="hidden sm:inline">
              {openRouterKey ? 'OpenRouter Active' : 'Connect OpenRouter'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${openRouterKey ? 'bg-emerald-600' : 'bg-amber-500'}`}
              aria-hidden="true"
            />
          </button>
        </div>

      </div>
    </header>
  );
};

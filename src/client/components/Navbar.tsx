import React from 'react';
import { Bot, Plus, Key, Radio } from 'lucide-react';

interface NavbarProps {
  activeTab: 'fleet' | 'studio';
  setActiveTab: (tab: 'fleet' | 'studio') => void;
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
    <header className="border-b border-zinc-800 bg-[#09090b]/95 sticky top-0 z-40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('fleet')}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded-lg p-1 -m-1"
        >
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-200">
            <Radio className="w-4 h-4 text-zinc-300" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-zinc-100">
                AgentWire
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                MCP Edge
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">
              Serverless MCP Agent Endpoints with OpenRouter Routing
            </p>
          </div>
        </button>

        {/* Tab Navigation */}
        <nav aria-label="Main Views" className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-zinc-800" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'fleet'}
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'fleet'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fleet ({agentCount})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'studio'}
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
              activeTab === 'studio'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
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
                ? 'border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span className="hidden sm:inline">
              {openRouterKey ? 'OpenRouter Active' : 'Connect OpenRouter'}
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full ${openRouterKey ? 'bg-emerald-500' : 'bg-amber-400'}`}
              aria-hidden="true"
            />
          </button>
        </div>

      </div>
    </header>
  );
};

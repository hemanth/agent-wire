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
    <header className="border-b border-white/10 bg-[#0A0D15]/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('fleet')}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg p-1 -m-1"
        >
          <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-sm shadow-indigo-500/20">
            <Radio className="w-5 h-5 animate-pulse text-indigo-400" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">
                AgentWire
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                MCP Edge
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Deployable MCP Agents with OpenRouter Auto-Failover
            </p>
          </div>
        </button>

        {/* Tab Navigation */}
        <nav aria-label="Main Views" className="flex items-center bg-white/[0.04] p-1 rounded-lg border border-white/5" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'fleet'}
            onClick={() => setActiveTab('fleet')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === 'fleet'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Bot className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Fleet ({agentCount})</span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'studio'}
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === 'studio'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
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
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              openRouterKey
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">
              {openRouterKey ? 'OpenRouter Active' : 'Connect OpenRouter'}
            </span>
            <span
              className={`w-2 h-2 rounded-full ${openRouterKey ? 'bg-emerald-400' : 'bg-amber-400'}`}
              aria-hidden="true"
            />
          </button>
        </div>

      </div>
    </header>
  );
};

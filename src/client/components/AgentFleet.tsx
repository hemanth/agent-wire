import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Agent } from '../../types.ts';
import { AgentCard } from './fleet/AgentCard.tsx';
import { FleetEmptyState } from './fleet/FleetEmptyState.tsx';

interface AgentFleetProps {
  agents: Agent[];
  isLoading?: boolean;
  onSelectAgent: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
  onNewAgent: () => void;
}

export const AgentFleet: React.FC<AgentFleetProps> = ({
  agents,
  isLoading = false,
  onSelectAgent,
  onDeleteAgent,
  onNewAgent
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return agents;
    return agents.filter(
      a =>
        a.name.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.models.some(m => m.toLowerCase().includes(q))
    );
  }, [agents, searchQuery]);

  // Skeleton Loading State
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6" aria-busy="true" aria-label="Loading agents">
        <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty State
  if (agents.length === 0) {
    return <FleetEmptyState onNewAgent={onNewAgent} />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Active Fleet
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {agents.length} Endpoints Live
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every agent below is deployed with a permanent, publicly curlable REST endpoint.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter agents..."
              aria-label="Filter agents by name, slug, or model"
              className="pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500 w-44 sm:w-56"
            />
          </div>

          <button
            onClick={onNewAgent}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20 shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span>+ Deploy Agent</span>
          </button>
        </div>
      </div>

      {/* Grid of Agents */}
      {filteredAgents.length === 0 ? (
        <div role="status" className="text-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
          <p className="text-sm text-slate-400">No agents match "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 font-mono underline"
          >
            Clear filter
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="Deployed agents">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={onSelectAgent}
              onDelete={onDeleteAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

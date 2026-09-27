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
        <div className="h-8 w-48 bg-zinc-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 rounded-2xl bg-zinc-100 border border-zinc-200 animate-pulse" />
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
          <h1 className="text-xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
            Active Fleet
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 font-semibold">
              {agents.length} Endpoints Live
            </span>
          </h1>
          <p className="text-xs text-zinc-600 mt-1">
            Every agent below is deployed with a permanent, publicly curlable REST endpoint.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter agents..."
              aria-label="Filter agents by name, slug, or model"
              className="pl-9 pr-3.5 py-1.5 rounded-full bg-white border border-zinc-200 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200 w-48 sm:w-64 font-mono shadow-2xs transition-all"
            />
          </div>

          <button
            onClick={onNewAgent}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-950 hover:bg-black active:bg-zinc-850 text-white text-xs font-medium transition-all border border-transparent shadow-xs shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <span>+ Deploy Agent</span>
          </button>
        </div>
      </div>

      {/* Grid of Agents */}
      {filteredAgents.length === 0 ? (
        <div role="status" className="text-center py-16 border border-zinc-200 rounded-xl bg-white shadow-xs">
          <p className="text-sm text-zinc-600">No agents match "{searchQuery}"</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-2 text-xs text-zinc-900 hover:text-black font-mono underline"
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

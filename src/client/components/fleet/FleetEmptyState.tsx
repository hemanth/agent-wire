import React from 'react';
import { Bot, Plus } from 'lucide-react';

interface FleetEmptyStateProps {
  onNewAgent: () => void;
}

export const FleetEmptyState: React.FC<FleetEmptyStateProps> = ({ onNewAgent }) => {
  return (
    <section aria-labelledby="empty-fleet-title" className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
      <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
        <Bot className="w-7 h-7 text-zinc-400" aria-hidden="true" />
      </div>
      <h2 id="empty-fleet-title" className="text-xl font-semibold text-zinc-100 tracking-tight">
        No Deployed Agents Yet
      </h2>
      <p className="text-sm text-zinc-400 max-w-md mx-auto leading-relaxed">
        Wire up your first agent with custom persona instructions, remote MCP tools, and attached skills.
      </p>
      <button
        onClick={onNewAgent}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
      >
        <Plus className="w-4 h-4 text-zinc-950" aria-hidden="true" />
        <span>Deploy Your First Agent</span>
      </button>
    </section>
  );
};

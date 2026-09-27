import React from 'react';
import { Bot, Plus } from 'lucide-react';

interface FleetEmptyStateProps {
  onNewAgent: () => void;
}

export const FleetEmptyState: React.FC<FleetEmptyStateProps> = ({ onNewAgent }) => {
  return (
    <section aria-labelledby="empty-fleet-title" className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
      <div className="w-14 h-14 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mx-auto text-zinc-900 shadow-2xs">
        <Bot className="w-7 h-7 text-zinc-700" aria-hidden="true" />
      </div>
      <h2 id="empty-fleet-title" className="text-xl font-bold text-zinc-950 tracking-tight">
        No Deployed Agents Yet
      </h2>
      <p className="text-sm text-zinc-600 max-w-md mx-auto leading-relaxed">
        Wire up your first agent with custom persona instructions, remote MCP tools, and attached skills.
      </p>
      <button
        onClick={onNewAgent}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 hover:bg-black active:bg-zinc-850 text-white text-xs font-medium transition-all border border-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
      >
        <Plus className="w-4 h-4 text-white" aria-hidden="true" />
        <span>Deploy Your First Agent</span>
      </button>
    </section>
  );
};

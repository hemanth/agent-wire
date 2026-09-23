import React from 'react';
import { Bot, Sparkles } from 'lucide-react';

interface FleetEmptyStateProps {
  onNewAgent: () => void;
}

export const FleetEmptyState: React.FC<FleetEmptyStateProps> = ({ onNewAgent }) => {
  return (
    <section aria-labelledby="empty-fleet-title" className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
        <Bot className="w-8 h-8" aria-hidden="true" />
      </div>
      <h2 id="empty-fleet-title" className="text-xl font-semibold text-white tracking-tight">
        No Deployed Agents Yet
      </h2>
      <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
        Wire up your first agent with custom persona instructions, remote MCP tools, and attached skills.
      </p>
      <button
        onClick={onNewAgent}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20 focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        <span>Deploy Your First Agent</span>
      </button>
    </section>
  );
};

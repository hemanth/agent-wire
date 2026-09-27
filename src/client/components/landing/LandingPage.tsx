import React from 'react';
import { HeroSection } from './HeroSection.tsx';
import { PaletteLegend } from './PaletteLegend.tsx';
import { ProblemSolutionSection } from './ProblemSolutionSection.tsx';
import { HowItWorksSection } from './HowItWorksSection.tsx';
import { TerminalSection } from './TerminalSection.tsx';
import { AgentCard } from '../fleet/AgentCard.tsx';
import { Agent } from '../../../types.ts';
import { ArrowRight, Bot } from 'lucide-react';

interface LandingPageProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
  onGoToStudio: () => void;
  onGoToFleet: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  agents,
  onSelectAgent,
  onDeleteAgent,
  onGoToStudio,
  onGoToFleet
}) => {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-16 animate-in fade-in duration-150">
      {/* 1. Hero Section */}
      <HeroSection onGoToStudio={onGoToStudio} onGoToFleet={onGoToFleet} />

      {/* 2. Coolors.co Pastel Palette System Map */}
      <PaletteLegend />

      {/* 3. Problem & Solution Breakdown */}
      <ProblemSolutionSection />

      {/* 4. Featured Live Agents (Interactive Fleet Preview) */}
      <section className="space-y-6 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-zinc-700" />
              Featured Live Agents
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1">
              Test any agent directly in your browser or copy its cURL command.
            </p>
          </div>

          <button
            onClick={onGoToStudio}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-950 hover:bg-black active:bg-zinc-850 text-white text-xs font-medium transition-all shadow-xs self-start sm:self-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <span>+ Deploy New Agent</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" role="list" aria-label="Featured agents">
          {agents.slice(0, 3).map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onSelect={onSelectAgent}
              onDelete={onDeleteAgent}
            />
          ))}
        </div>
      </section>

      {/* 5. How It Works Workflow */}
      <HowItWorksSection />

      {/* 6. Universal Terminal Integration */}
      <TerminalSection />

      {/* 7. Bottom CTA */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 sm:p-12 text-center space-y-4 shadow-xs">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 tracking-tight">
          Ready to Deploy Your Own MCP Agent?
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 max-w-xl mx-auto leading-relaxed">
          Configure instructions, plug in remote tools, and get your curlable serverless edge URL in under 30 seconds.
        </p>
        <div className="pt-2">
          <button
            onClick={onGoToStudio}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-zinc-950 hover:bg-black active:bg-zinc-850 text-white font-medium text-sm transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
          >
            <span>Launch Agent Studio</span>
            <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
};

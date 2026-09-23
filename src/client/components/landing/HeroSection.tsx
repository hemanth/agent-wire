import React from 'react';
import { ArrowRight, Terminal, Bot, Wrench, BookOpen, Layers, Zap } from 'lucide-react';

interface HeroSectionProps {
  onGoToStudio: () => void;
  onGoToFleet: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onGoToStudio, onGoToFleet }) => {
  return (
    <section className="text-center max-w-4xl mx-auto space-y-6 pt-4">
      {/* Eyebrow Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-[#111113] text-xs font-mono">
        <span className="w-2 h-2 rounded-full bg-[#D3F8E2]" aria-hidden="true" />
        <span className="text-zinc-300">AgentWire Edge Runtime</span>
        <span className="text-zinc-600">•</span>
        <span className="text-zinc-400">Model Context Protocol</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-5xl font-bold text-zinc-100 tracking-tight leading-[1.15]">
        Turn Prompts & Remote MCP Servers into Instant,{' '}
        <span className="text-[#A9DEF9]">
          Curlable Endpoints
        </span>
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto leading-relaxed">
        No containers, no Python server boilerplate, and no single-point-of-failure LLM outages.
        Connect persona prompts, remote MCP tool servers, and SKILL.md standards into live edge microservices with OpenRouter multi-model failover.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={onGoToStudio}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <span>Deploy Your First Agent</span>
          <ArrowRight className="w-4 h-4 text-zinc-950" aria-hidden="true" />
        </button>

        <button
          onClick={onGoToFleet}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-medium text-xs sm:text-sm border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <Bot className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <span>Explore Live Fleet</span>
        </button>
      </div>

      {/* Interactive 3-Stage Pipeline Diagram */}
      <div className="pt-6">
        <div className="rounded-xl border border-zinc-800 bg-[#111113] p-4 sm:p-6 text-left">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80 mb-4 text-xs font-mono text-zinc-400">
            <span className="uppercase tracking-wider">Edge Compilation Architecture</span>
            <span className="text-[11px] text-zinc-500">Inputs ➔ Routing ➔ REST API</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Stage 1: The Ingredients */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-zinc-500 font-semibold">[1] Inputs</span>
                <span className="w-2 h-2 rounded-full bg-[#A9DEF9]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                  <Bot className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="truncate">Persona & Instructions</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#A9DEF9]/10 border border-[#A9DEF9]/30 text-[#A9DEF9]">
                  <Wrench className="w-3.5 h-3.5" />
                  <span className="truncate">Remote MCP Servers (SSE)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#EDE7B1]/10 border border-[#EDE7B1]/30 text-[#EDE7B1]">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="truncate">Attached SKILL.md Files</span>
                </div>
              </div>
            </div>

            {/* Stage 2: Edge Router */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-zinc-500 font-semibold">[2] Edge Engine</span>
                <span className="w-2 h-2 rounded-full bg-[#E4C1F9]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#E4C1F9]/10 border border-[#E4C1F9]/30 text-[#E4C1F9]">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="truncate">OpenRouter Auto-Fallback</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#D3F8E2]/10 border border-[#D3F8E2]/30 text-[#D3F8E2]">
                  <Zap className="w-3.5 h-3.5" />
                  <span className="truncate">Cloudflare Edge Worker</span>
                </div>
                <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 text-[11px]">
                  <span>Claude ➔ Gemini ➔ Llama</span>
                </div>
              </div>
            </div>

            {/* Stage 3: Public REST Output */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                <span className="text-zinc-500 font-semibold">[3] Output</span>
                <span className="w-2 h-2 rounded-full bg-[#F694C1]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#F694C1]/10 border border-[#F694C1]/30 text-[#F694C1]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span className="truncate font-semibold">POST /api/agents/:id/run</span>
                </div>
                <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 text-[11px] font-mono leading-relaxed">
                  <code>curl -X POST .../run -d '&#123;"task":"..."&#125;'</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

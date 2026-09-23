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
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#A5E5BF] bg-[#D3F8E2]/60 text-xs font-mono text-emerald-950">
        <span className="w-2 h-2 rounded-full bg-emerald-600" aria-hidden="true" />
        <span className="font-medium">AgentWire Edge Runtime</span>
        <span className="text-emerald-700">•</span>
        <span className="text-emerald-900">Model Context Protocol</span>
      </div>

      {/* Main Title */}
      <h1 className="text-3xl sm:text-5xl font-extrabold text-zinc-950 tracking-tight leading-[1.15]">
        Turn Prompts & Remote MCP Servers into Instant,{' '}
        <span className="text-[#0284C7] bg-[#A9DEF9]/35 px-2.5 py-0.5 rounded-lg border border-[#82CBF5]/60 inline-block mt-1 sm:mt-0">
          Curlable Endpoints
        </span>
      </h1>

      {/* Subtitle */}
      <p className="text-sm sm:text-base text-zinc-600 max-w-2xl mx-auto leading-relaxed">
        No containers, no Python server boilerplate, and no single-point-of-failure LLM outages.
        Connect persona prompts, remote MCP tool servers, and SKILL.md standards into live edge microservices with OpenRouter multi-model failover.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={onGoToStudio}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-950 hover:bg-black text-white font-medium text-xs sm:text-sm transition-colors border border-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <span>Deploy Your First Agent</span>
          <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
        </button>

        <button
          onClick={onGoToFleet}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white hover:bg-zinc-50 text-zinc-800 font-medium text-xs sm:text-sm border border-zinc-200 transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <Bot className="w-4 h-4 text-zinc-600" aria-hidden="true" />
          <span>Explore Live Fleet</span>
        </button>
      </div>

      {/* Interactive 3-Stage Pipeline Diagram */}
      <div className="pt-6">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 sm:p-6 text-left shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-4 text-xs font-mono text-zinc-500">
            <span className="uppercase tracking-wider font-semibold text-zinc-700">Edge Compilation Architecture</span>
            <span className="text-[11px] text-zinc-500">Inputs ➔ Routing ➔ REST API</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
            {/* Stage 1: The Ingredients */}
            <div className="rounded-lg border border-[#82CBF5] bg-[#A9DEF9]/15 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-sky-950 font-bold">[1] Inputs</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#A9DEF9] border border-[#82CBF5]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-white border border-zinc-200 text-zinc-800">
                  <Bot className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="truncate">Persona & Instructions</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#A9DEF9]/35 border border-[#82CBF5] text-sky-950 font-medium">
                  <Wrench className="w-3.5 h-3.5 text-sky-800" />
                  <span className="truncate">Remote MCP Servers (SSE)</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#EDE7B1]/50 border border-[#DDD27C] text-amber-950 font-medium">
                  <BookOpen className="w-3.5 h-3.5 text-amber-800" />
                  <span className="truncate">Attached SKILL.md Files</span>
                </div>
              </div>
            </div>

            {/* Stage 2: Edge Router */}
            <div className="rounded-lg border border-[#D29EFA] bg-[#E4C1F9]/15 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-purple-950 font-bold">[2] Edge Engine</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#E4C1F9] border border-[#D29EFA]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#E4C1F9]/35 border border-[#D29EFA] text-purple-950 font-medium">
                  <Layers className="w-3.5 h-3.5 text-purple-800" />
                  <span className="truncate">OpenRouter Auto-Fallback</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#D3F8E2]/50 border border-[#A5E5BF] text-emerald-950 font-medium">
                  <Zap className="w-3.5 h-3.5 text-emerald-800" />
                  <span className="truncate">Cloudflare Edge Worker</span>
                </div>
                <div className="p-1.5 rounded bg-white border border-zinc-200 text-zinc-700 text-[11px]">
                  <span>Claude ➔ Gemini ➔ Llama</span>
                </div>
              </div>
            </div>

            {/* Stage 3: Public REST Output */}
            <div className="rounded-lg border border-[#F173B0] bg-[#F694C1]/15 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-rose-950 font-bold">[3] Output</span>
                <span className="w-2.5 h-2.5 rounded-full bg-[#F694C1] border border-[#F173B0]" />
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                <div className="flex items-center gap-2 p-1.5 rounded bg-[#F694C1]/35 border border-[#F173B0] text-rose-950 font-medium">
                  <Terminal className="w-3.5 h-3.5 text-rose-800" />
                  <span className="truncate font-semibold">POST /api/agents/:id/run</span>
                </div>
                <div className="p-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-100 text-[11px] font-mono leading-relaxed">
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

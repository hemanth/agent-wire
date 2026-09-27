import React, { useState } from 'react';
import { ArrowRight, Terminal, Bot, Wrench, BookOpen, Layers, Zap, CheckCircle2, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onGoToStudio: () => void;
  onGoToFleet: () => void;
}

const DEMOS = [
  {
    name: 'Taste & UI Critic',
    badge: 'Design Architect',
    task: 'Audit landing page hero for AI slop tropes & check contrast',
    model: 'claude-3.5-sonnet',
    tool: 'stitch_mcp:inspect_hierarchy',
    tokens: 284,
    latency: '342ms',
    output: '✓ Typographic scale passes WCAG AAA (14.2:1 contrast)\n✓ Eliminated purple gradient slop; adopted frosted glass\n✓ Preserved tactile pill navigation with full keyboard a11y'
  },
  {
    name: 'PR Triager',
    badge: 'Code Reviewer',
    task: 'Inspect PR #104 diff for unauthenticated edge route vulnerabilities',
    model: 'gemini-2.5-flash',
    tool: 'github_mcp:get_pr_diff',
    tokens: 412,
    latency: '198ms',
    output: '✓ Verified input sanitization on POST /api/agents/:id/run\n✓ Model fallback chain active: Claude ➔ Gemini ➔ Llama\n✓ Zero security regressions detected in token budgeting'
  },
  {
    name: 'Design Stitch',
    badge: 'Stitch MCP',
    task: 'Generate stitch layout variants with ToneBird glass panels',
    model: 'llama-3.3-70b',
    tool: 'stitch_mcp:create_variants',
    tokens: 360,
    latency: '265ms',
    output: '✓ Built 3 glassmorphic design system tokens: mint, sky, lilac\n✓ Rendered frosted glass card overlays with 12px backdrop blur\n✓ Live REST endpoint deployed to Cloudflare Edge'
  }
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onGoToStudio, onGoToFleet }) => {
  const [activeDemo, setActiveDemo] = useState(0);
  const demo = DEMOS[activeDemo];

  return (
    <section className="text-center max-w-4xl mx-auto space-y-6 pt-2">
      {/* Main Title */}
      <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-950 tracking-tight leading-[1.1]">
        Your agent as a URL.
      </h1>

      {/* Subtitle */}
      <p className="text-base sm:text-lg text-zinc-600 max-w-lg mx-auto font-medium">
        Prompt and remote MCP tools wired into an instant, curlable endpoint.
      </p>

      {/* ToneBird Action Pills */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <button
          onClick={onGoToStudio}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-950 hover:bg-black active:bg-zinc-850 text-white font-medium text-xs sm:text-sm transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
        >
          <span>Deploy Your First Agent</span>
          <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
        </button>

        <button
          onClick={onGoToFleet}
          className="flex items-center gap-2 px-6 py-3 rounded-full bg-white hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800 font-medium text-xs sm:text-sm border border-zinc-200/90 transition-all shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
        >
          <Bot className="w-4 h-4 text-zinc-600" aria-hidden="true" />
          <span>Explore Live Fleet</span>
        </button>
      </div>

      {/* ToneBird Live Interactive Showcase Widget */}
      <div className="pt-6">
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-md p-4 sm:p-6 text-left shadow-xs space-y-4">
          
          {/* Header Row: Sample Selector Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-zinc-500" aria-hidden="true" />
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-800">
                Interactive Live Preview
              </span>
            </div>
            
            {/* Clickable Preset Pills */}
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Interactive demo selector">
              {DEMOS.map((d, i) => (
                <button
                  key={d.name}
                  onClick={() => setActiveDemo(i)}
                  className={`px-3 py-1 rounded-full text-xs font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                    activeDemo === i
                      ? 'bg-zinc-950 text-white font-medium shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </div>

          {/* Simulated App Card */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4 space-y-3 font-mono text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-zinc-200/80 border border-zinc-300/80 text-zinc-800 text-[11px] font-semibold">
                  {demo.badge}
                </span>
                <span className="text-zinc-600 truncate font-sans font-medium text-xs">
                  Task: "{demo.task}"
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <span className="px-2 py-0.5 rounded-full bg-white border border-zinc-200 text-zinc-700 shadow-2xs">
                  {demo.model}
                </span>
                <span>{demo.latency}</span>
              </div>
            </div>

            {/* MCP Call & Output */}
            <div className="rounded-lg border border-zinc-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                <Wrench className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span className="text-zinc-800 font-semibold">Remote MCP Invocation:</span>
                <code className="text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded">{demo.tool}</code>
              </div>
              <pre className="text-zinc-800 text-[11px] font-mono leading-relaxed whitespace-pre-wrap bg-zinc-50 p-2.5 rounded-md border border-zinc-100">
                {demo.output}
              </pre>
            </div>
          </div>

          {/* Edge Architecture 3-Step Breadcrumb: Unified Monochrome Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-white shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-bold text-zinc-900">[1] Persona & MCPs</div>
                <div className="text-[10px] text-zinc-500 truncate">SSE + SKILL.md specs</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200/90 bg-white shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-bold text-zinc-900">[2] OpenRouter Failover</div>
                <div className="text-[10px] text-zinc-500 truncate">Claude ➔ Gemini ➔ Llama</div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                <Terminal className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-mono font-bold text-zinc-900">[3] Curlable Endpoint</div>
                <div className="text-[10px] text-zinc-500 truncate font-mono">POST /api/agents/:id/run</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

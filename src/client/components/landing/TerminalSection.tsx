import React, { useState } from 'react';
import { Copy, Check, Terminal, Play, CheckCircle2 } from 'lucide-react';

export const TerminalSection: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const curlCommand = `curl -X POST http://localhost:8787/api/agents/taste-critic/run \\
  -H "Content-Type: application/json" \\
  -d '{"task": "Analyze UI layout for excessive vibe-coded tropes"}'`;

  const handleCopy = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="space-y-4 pt-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
          Universal Terminal & API Integration
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          Any system that can send an HTTP POST request can execute your deployed agent fleet.
        </p>
      </div>

      <div className="max-w-3xl mx-auto rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden font-mono text-xs shadow-xl">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            </div>
            <span className="text-[11px] text-zinc-400 ml-2">bash - AgentWire Curl Execution</span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-300 text-[10px]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span className="text-[10px]">Copy cURL</span>
              </>
            )}
          </button>
        </div>

        {/* Terminal Content */}
        <div className="p-4 sm:p-5 space-y-4 leading-relaxed overflow-x-auto text-zinc-300">
          <div>
            <div className="text-zinc-500 mb-1"># 1. Dispatch request from anywhere</div>
            <pre className="text-zinc-100">{curlCommand}</pre>
          </div>

          <div className="pt-2 border-t border-zinc-900 space-y-1.5 text-[11px]">
            <div className="text-zinc-500 mb-1"># 2. AgentWire serverless edge response</div>
            <div className="flex items-center gap-2 text-[#D3F8E2]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>HTTP/1.1 200 OK (latency: 1.18s, cold_start: 0ms)</span>
            </div>
            <div className="text-[#A9DEF9]">
              <span>&gt; MCP Tool Discovered: </span>
              <span className="underline">stitch_inspect_screen</span>
            </div>
            <div className="text-[#E4C1F9]">
              <span>&gt; Model Fallback Chain: </span>
              <span>claude-3.5-sonnet (active)</span>
            </div>
            <div className="text-[#EDE7B1]">
              <span>&gt; Applied Skill: </span>
              <span>taste-skill (high contrast, typographic balance enforced)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-zinc-900">
            <div className="text-zinc-500 mb-1"># 3. Parsed JSON output</div>
            <pre className="text-emerald-300 bg-black/40 p-3 rounded-lg border border-zinc-800/80 overflow-x-auto">
{`{
  "agent": "taste-critic",
  "status": "completed",
  "modelUsed": "anthropic/claude-3.5-sonnet",
  "toolsUsed": ["stitch_inspect_screen"],
  "result": "UI Audit Complete: All components satisfy WCAG AA contrast. AI-slop tropes (pulsing dots, gradient text) eliminated."
}`}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
};

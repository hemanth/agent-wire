import React from 'react';
import { Wrench, ShieldAlert, Cpu, Server, Terminal } from 'lucide-react';

export const ProblemSolutionSection: React.FC = () => {
  const problemSolutions = [
    {
      title: 'Remote MCP Discovery',
      icon: Wrench,
      problem: 'Tool servers exist behind remote SSE or HTTP streams with complex handshake protocols.',
      solution: 'AgentWire connects to any MCP URL, dynamically probes tools via tools/list, and runs execution loops with zero boilerplate.'
    },
    {
      title: 'Provider Outage Immunity',
      icon: Cpu,
      problem: 'Single-model agents fail completely when Claude or OpenAI is rate-limited or degraded.',
      solution: 'Configurable OpenRouter multi-model fallback chain automatically cascades to the next candidate model in real time.'
    },
    {
      title: 'Enforced Domain Standards',
      icon: ShieldAlert,
      problem: 'Simple system prompts drift and lack procedural discipline for nuanced tasks like UI design or code audits.',
      solution: 'Attach versioned SKILL.md documents (e.g. Taste Skills, PR Review rules) directly into context on every execution.'
    },
    {
      title: 'Zero DevOps Serverless Edge',
      icon: Server,
      problem: 'Hosting agents usually requires dedicated Docker containers, Redis queues, and continuous VM costs.',
      solution: 'Cloudflare Worker serverless edge deployment with instantaneous startup, global routing, and sub-100ms cold starts.'
    },
    {
      title: 'Universal cURL Consumption',
      icon: Terminal,
      problem: 'Agents get trapped in walled-garden web interfaces rather than being callable from scripts and pipelines.',
      solution: 'Instant permanent POST REST endpoint curlable from GitHub Actions, terminal aliases, Python scripts, or webhooks.'
    }
  ];

  return (
    <section className="space-y-6 pt-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
          What AgentWire Solves
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600">
          The bridge between raw AI models, remote tool protocols, and reliable production software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {problemSolutions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="rounded-2xl border border-zinc-200/90 bg-white p-5 flex flex-col justify-between space-y-4 shadow-2xs hover:border-zinc-300 hover:shadow-xs transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-800 shadow-2xs">
                    <Icon className="w-4 h-4 text-zinc-700" aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-500 font-semibold">
                    0{idx + 1}
                  </span>
                </div>

                <h3 className="font-bold text-sm text-zinc-950">
                  {item.title}
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-zinc-50/80 border border-zinc-150 text-zinc-600">
                    <span className="font-bold text-zinc-400 font-mono text-[10px] block mb-1">THE PROBLEM</span>
                    <p className="line-clamp-2 leading-relaxed text-zinc-600">{item.problem}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-zinc-300 text-zinc-950 shadow-2xs">
                    <span className="font-bold font-mono text-[10px] block mb-1 text-zinc-950">AGENTWIRE FIX</span>
                    <p className="line-clamp-3 font-medium leading-relaxed text-zinc-800">{item.solution}</p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

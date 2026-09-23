import React from 'react';
import { Wrench, ShieldAlert, Cpu, Server, Terminal } from 'lucide-react';

export const ProblemSolutionSection: React.FC = () => {
  const problemSolutions = [
    {
      title: 'Remote MCP Discovery',
      accent: '#A9DEF9',
      icon: Wrench,
      problem: 'Tool servers exist behind remote SSE or HTTP streams with complex handshake protocols.',
      solution: 'AgentWire connects to any MCP URL, dynamically probes tools via tools/list, and runs execution loops with zero boilerplate.'
    },
    {
      title: 'Provider Outage Immunity',
      accent: '#E4C1F9',
      icon: Cpu,
      problem: 'Single-model agents fail completely when Claude or OpenAI is rate-limited or degraded.',
      solution: 'Configurable OpenRouter multi-model fallback chain automatically cascades to the next candidate model in real time.'
    },
    {
      title: 'Enforced Domain Standards',
      accent: '#EDE7B1',
      icon: ShieldAlert,
      problem: 'Simple system prompts drift and lack procedural discipline for nuanced tasks like UI design or code audits.',
      solution: 'Attach versioned SKILL.md documents (e.g. Taste Skills, PR Review rules) directly into context on every execution.'
    },
    {
      title: 'Zero DevOps Serverless Edge',
      accent: '#D3F8E2',
      icon: Server,
      problem: 'Hosting agents usually requires dedicated Docker containers, Redis queues, and continuous VM costs.',
      solution: 'Cloudflare Worker serverless edge deployment with instantaneous startup, global routing, and sub-100ms cold starts.'
    },
    {
      title: 'Universal cURL Consumption',
      accent: '#F694C1',
      icon: Terminal,
      problem: 'Agents get trapped in walled-garden web interfaces rather than being callable from scripts and pipelines.',
      solution: 'Instant permanent POST REST endpoint curlable from GitHub Actions, terminal aliases, Python scripts, or webhooks.'
    }
  ];

  return (
    <section className="space-y-6 pt-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 tracking-tight">
          What AgentWire Solves
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          The bridge between raw AI models, remote tool protocols, and reliable production software.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {problemSolutions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="rounded-xl border border-zinc-800 bg-[#111113] p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center border"
                    style={{
                      backgroundColor: `${item.accent}15`,
                      borderColor: `${item.accent}35`,
                      color: item.accent
                    }}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded border"
                    style={{
                      backgroundColor: `${item.accent}15`,
                      borderColor: `${item.accent}30`,
                      color: item.accent
                    }}
                  >
                    {item.accent}
                  </span>
                </div>

                <h3 className="font-semibold text-sm text-zinc-200">
                  {item.title}
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80 text-zinc-400">
                    <span className="font-semibold text-zinc-500 font-mono text-[10px] block mb-0.5">THE PROBLEM</span>
                    <p className="line-clamp-2">{item.problem}</p>
                  </div>
                  <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800/80 text-zinc-300">
                    <span className="font-semibold text-zinc-400 font-mono text-[10px] block mb-0.5">AGENTWIRE FIX</span>
                    <p className="line-clamp-3">{item.solution}</p>
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

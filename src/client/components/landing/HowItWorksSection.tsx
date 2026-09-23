import React from 'react';
import { Layers, Bot, Terminal } from 'lucide-react';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Define Persona & Remote MCPs',
      desc: 'Set the agent system prompt and attach any remote MCP server endpoint (SSE or HTTP). AgentWire auto-probes the tool list.',
      color: '#A9DEF9',
      icon: Bot,
      snippet: `// Configure Remote MCP Connector
POST /api/mcp/probe
{ "url": "https://mcp.stitch.dev/sse" }
➔ Found 4 tools: inspect_screen, generate_ui...`
    },
    {
      num: '02',
      title: 'Attach Skills & Model Fallbacks',
      desc: 'Inject domain-specific SKILL.md rules (e.g. Taste Skills) and define fallback order across Claude 3.5, Gemini 2.5, and Llama 3.3.',
      color: '#E4C1F9',
      icon: Layers,
      snippet: `// Fallback Chain & Skill Injection
models: [
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.5-flash"
]
skills: ["taste-skill", "code-review"]`
    },
    {
      num: '03',
      title: 'Deploy Edge URL & Curl Anywhere',
      desc: 'Click Deploy to get a permanent edge URL. Trigger tasks via cURL, Python requests, or fetch() with multi-turn tool calling.',
      color: '#F694C1',
      icon: Terminal,
      snippet: `curl -X POST https://agentwire.edge/api/agents/taste-critic/run \\
  -H "Content-Type: application/json" \\
  -d '{"task": "Audit this UI against high contrast rules"}'`
    }
  ];

  return (
    <section className="space-y-6 pt-8">
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <h2 className="text-xl sm:text-2xl font-bold text-zinc-950 tracking-tight">
          How It Works
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600">
          From an idea to a live serverless agent microservice in three simple steps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {steps.map(step => {
          const Icon = step.icon;
          return (
            <div
              key={step.num}
              className="rounded-xl border bg-white p-5 flex flex-col justify-between space-y-4 shadow-xs hover:shadow-md transition-all"
              style={{
                borderColor: `${step.color}`
              }}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span
                    className="font-mono text-xs font-bold px-2 py-0.5 rounded border text-zinc-950"
                    style={{
                      backgroundColor: `${step.color}50`,
                      borderColor: `${step.color}`
                    }}
                  >
                    STEP {step.num}
                  </span>
                  <Icon className="w-4 h-4 text-zinc-500" aria-hidden="true" />
                </div>

                <h3 className="font-bold text-sm text-zinc-950">
                  {step.title}
                </h3>

                <p className="text-xs text-zinc-600 leading-relaxed">
                  {step.desc}
                </p>
              </div>

              <div className="rounded-lg bg-zinc-950 border border-zinc-800 p-3 text-[11px] font-mono text-zinc-100 overflow-x-auto leading-relaxed shadow-xs">
                <pre className="whitespace-pre">{step.snippet}</pre>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

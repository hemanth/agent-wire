import React, { useState } from 'react';
import { Bot, Play, Copy, Check, Trash2, Terminal, Wrench, BookOpen, Layers, ExternalLink, Activity } from 'lucide-react';
import { Agent } from '../../types.ts';

interface AgentFleetProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onDeleteAgent: (id: string) => void;
  onNewAgent: () => void;
}

export const AgentFleet: React.FC<AgentFleetProps> = ({
  agents,
  onSelectAgent,
  onDeleteAgent,
  onNewAgent
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCurl = (agent: Agent, e: React.MouseEvent) => {
    e.stopPropagation();
    const endpoint = `${window.location.origin}/api/agents/${agent.id}/run`;
    const curl = `curl -X POST ${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -d '{"task": "Hello! Report your status."}'`;
    navigator.clipboard.writeText(curl);
    setCopiedId(agent.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (agents.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
          <Bot className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-white">No Deployed Agents Yet</h2>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Wire up your first agent with custom persona instructions, remote MCP tools, and attached skills.
        </p>
        <button
          onClick={onNewAgent}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20"
        >
          Create First Agent
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      
      {/* Overview header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Active Fleet
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {agents.length} Endpoints Live
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Every agent below is deployed with a permanent, publicly curlable REST endpoint.
          </p>
        </div>
        <button
          onClick={onNewAgent}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
        >
          + Deploy New Agent
        </button>
      </div>

      {/* Grid of Agents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {agents.map(agent => {
          const totalTools = (agent.mcps || []).reduce((acc, m) => acc + (m.tools?.length || 0), 0);
          const activeSkills = (agent.skills || []).filter(s => s.enabled);

          return (
            <div
              key={agent.id}
              onClick={() => onSelectAgent(agent)}
              className="group rounded-2xl border border-white/10 bg-[#0C0F17] hover:border-indigo-500/40 hover:bg-[#0E121C] transition-all p-5 flex flex-col justify-between cursor-pointer relative shadow-sm hover:shadow-xl hover:shadow-indigo-500/5"
            >
              
              {/* Top Row: Name + Live badge */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate text-base group-hover:text-indigo-300 transition-colors">
                      {agent.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                      {agent.tagline || 'Custom MCP Agent'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </div>
                </div>

                {/* Model Fallback Chain */}
                <div className="my-3 py-2 px-2.5 rounded-lg bg-black/40 border border-white/5 space-y-1">
                  <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    OpenRouter Fallback Chain:
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {agent.models.map((m, idx) => (
                      <React.Fragment key={m}>
                        <span className="text-[11px] font-mono text-slate-300 px-1.5 py-0.5 rounded bg-white/5 truncate max-w-[140px]" title={m}>
                          {m.split('/')[1] || m}
                        </span>
                        {idx < agent.models.length - 1 && (
                          <span className="text-slate-600 text-[10px]">→</span>
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Attached Connectors & Skills */}
                <div className="flex items-center gap-3 text-xs text-slate-400 my-3">
                  <span className="flex items-center gap-1.5 font-mono" title={`${agent.mcps?.length || 0} MCP servers, ${totalTools} tools`}>
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    {agent.mcps?.length || 0} MCPs ({totalTools} tools)
                  </span>
                  <span className="flex items-center gap-1.5 font-mono" title={`${activeSkills.length} active skills`}>
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                    {activeSkills.length} Skills
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                  <Activity className="w-3 h-3 text-slate-400" />
                  <span>{agent.invocationCount || 0} runs</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => copyCurl(agent, e)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 font-mono text-[11px] transition-colors"
                    title="Copy cURL command"
                  >
                    {copiedId === agent.id ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-300">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="w-3 h-3 text-indigo-400" />
                        <span>cURL</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete agent "${agent.name}"?`)) {
                        onDeleteAgent(agent.id);
                      }
                    }}
                    className="p-1.5 rounded-md hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                    title="Delete Agent"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};

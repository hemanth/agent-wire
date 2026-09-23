import React, { useState } from 'react';
import { Layers, Wrench, BookOpen, Activity, Terminal, Check, Trash2 } from 'lucide-react';
import { Agent } from '../../../types.ts';

interface AgentCardProps {
  agent: Agent;
  onSelect: (agent: Agent) => void;
  onDelete: (id: string) => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onSelect, onDelete }) => {
  const [copied, setCopied] = useState(false);

  const totalTools = (agent.mcps || []).reduce((acc, m) => acc + (m.tools?.length || 0), 0);
  const activeSkills = (agent.skills || []).filter(s => s.enabled);

  const handleCopyCurl = (e: React.MouseEvent) => {
    e.stopPropagation();
    const endpoint = `${window.location.origin}/api/agents/${agent.id}/run`;
    const curl = `curl -X POST ${endpoint} \\\n  -H "Content-Type: application/json" \\\n  -d '{"task": "Hello! Report your status."}'`;
    navigator.clipboard.writeText(curl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete agent "${agent.name}"?`)) {
      onDelete(agent.id);
    }
  };

  return (
    <article
      role="listitem"
      tabIndex={0}
      onClick={() => onSelect(agent)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(agent);
        }
      }}
      className="group rounded-xl border border-zinc-800 bg-[#111113] hover:border-zinc-700 hover:bg-[#141417] transition-all p-5 flex flex-col justify-between cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      <div>
        {/* Top Row: Name + Live badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-zinc-100 truncate text-base group-hover:text-white transition-colors">
              {agent.name}
            </h2>
            <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5 leading-relaxed">
              {agent.tagline || 'Custom MCP Agent'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-900/60 text-emerald-400 text-[10px] font-mono whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span>Live</span>
          </div>
        </div>

        {/* Model Fallback Chain */}
        <div className="my-3 py-2 px-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1">
          <div className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Layers className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            <span>Model Fallback Chain:</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {agent.models.map((m, idx) => (
              <React.Fragment key={m}>
                <span className="text-[11px] font-mono text-zinc-300 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 truncate max-w-[140px]" title={m}>
                  {m.split('/')[1] || m}
                </span>
                {idx < agent.models.length - 1 && (
                  <span className="text-zinc-600 text-[10px]" aria-hidden="true">→</span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Attached Connectors & Skills */}
        <div className="flex items-center gap-3 text-xs text-zinc-400 my-3">
          <span className="flex items-center gap-1.5 font-mono" title={`${agent.mcps?.length || 0} MCP servers, ${totalTools} tools`}>
            <Wrench className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span>{agent.mcps?.length || 0} MCPs ({totalTools} tools)</span>
          </span>
          <span className="flex items-center gap-1.5 font-mono" title={`${activeSkills.length} active skills`}>
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            <span>{activeSkills.length} Skills</span>
          </span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-zinc-500 font-mono text-[11px]">
          <Activity className="w-3 h-3 text-zinc-500" aria-hidden="true" />
          <span>{agent.invocationCount || 0} runs</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyCurl}
            aria-label={`Copy cURL command for ${agent.name}`}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 font-mono text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Terminal className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                <span>cURL</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDelete}
            aria-label={`Delete agent ${agent.name}`}
            className="p-1.5 rounded-md hover:bg-red-950/30 text-zinc-500 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};

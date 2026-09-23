import React, { useState } from 'react';
import { X, Play, Loader2, CheckCircle2, Cpu, Wrench, Sparkles, Terminal, Copy, Check } from 'lucide-react';
import { Agent, RunAgentResponse } from '../../types.ts';
import { CurlSnippet } from './CurlSnippet.tsx';

interface AgentRunnerModalProps {
  agent: Agent;
  onClose: () => void;
  openRouterKey: string | null;
}

export const AgentRunnerModal: React.FC<AgentRunnerModalProps> = ({ agent, onClose, openRouterKey }) => {
  const [task, setTask] = useState('Inspect the latest components and verify high contrast and typography hierarchy.');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RunAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (openRouterKey) {
        headers['Authorization'] = `Bearer ${openRouterKey}`;
      }

      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ task })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }

      const data: RunAgentResponse = await res.json();
      setResponse(data);
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
      <div className="bg-[#0C0F17] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Play className="w-4 h-4 fill-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white">{agent.name}</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {agent.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">{agent.tagline || 'Interactive Sandbox & Curl Runner'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Quick cURL copy */}
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">
              1. Direct cURL Command
            </label>
            <CurlSnippet agentId={agent.id} agentName={agent.name} task={task} />
          </div>

          {/* In-Browser Task Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
                2. Test In-Browser
              </label>
              <span className="text-[11px] text-slate-500 font-mono">Press Cmd+Enter to execute</span>
            </div>
            <div className="relative">
              <textarea
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleRun();
                  }
                }}
                rows={3}
                placeholder="Enter task or instruction for this agent..."
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 font-mono resize-none"
              />
              <button
                onClick={handleRun}
                disabled={loading || !task.trim()}
                className="absolute right-3 bottom-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Executing Agent...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" />
                    Run Task
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Live Execution Results & Step Trace */}
          {response && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              
              {/* Telemetry bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.02] border border-white/10 text-xs font-mono">
                <div className="flex items-center gap-4 text-slate-400">
                  <span className="flex items-center gap-1 text-indigo-300">
                    <Cpu className="w-3.5 h-3.5" />
                    Model: {response.modelUsed}
                  </span>
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" />
                    Tools used: {response.toolsUsed.length > 0 ? response.toolsUsed.join(', ') : 'None'}
                  </span>
                </div>
                <div className="text-slate-500">
                  Latency: {(response.durationMs / 1000).toFixed(2)}s
                </div>
              </div>

              {/* Execution Steps */}
              {response.steps && response.steps.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden text-xs font-mono">
                  <div className="px-3 py-2 border-b border-white/10 bg-white/[0.02] text-slate-400 flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    Execution Trace & Tool Calls ({response.steps.length} steps)
                  </div>
                  <div className="p-3 space-y-2 max-h-60 overflow-y-auto">
                    {response.steps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-slate-300">
                        <span className="text-slate-500 select-none">[{idx + 1}]</span>
                        <div className="flex-1">
                          {step.type === 'thought' && (
                            <span className="text-slate-400 italic">{step.content}</span>
                          )}
                          {step.type === 'tool_call' && (
                            <div className="text-amber-300">
                              ⚡ Call tool: <span className="font-bold underline">{step.toolName}</span>({JSON.stringify(step.toolArgs)})
                            </div>
                          )}
                          {step.type === 'tool_result' && (
                            <div className="text-emerald-300">
                              ✓ Result from {step.toolName}: <span className="text-slate-300">{JSON.stringify(step.toolOutput).slice(0, 180)}...</span>
                            </div>
                          )}
                          {step.type === 'answer' && (
                            <div className="text-indigo-300 font-semibold">
                              ★ Final synthesis complete
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Agent Response Text */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/10 p-4">
                <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-mono uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  Agent Response
                </div>
                <div className="text-sm text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {response.result}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-white/[0.02] flex items-center justify-between text-xs text-slate-400">
          <span>Agent ID: <span className="font-mono text-slate-200">{agent.id}</span></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};

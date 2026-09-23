import React, { useState } from 'react';
import { X, Play, Loader2, Sparkles } from 'lucide-react';
import { Agent, RunAgentResponse } from '../../types.ts';
import { CurlSnippet } from './CurlSnippet.tsx';
import { TelemetryBar } from './runner/TelemetryBar.tsx';
import { ExecutionTrace } from './runner/ExecutionTrace.tsx';
import { useModalA11y } from '../hooks/useModalA11y.ts';

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

  const modalRef = useModalA11y<HTMLDivElement>({ isOpen: true, onClose });

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
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="runner-modal-title"
      ref={modalRef}
    >
      <div className="bg-[#0C0F17] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Play className="w-4 h-4 fill-indigo-400" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="runner-modal-title" className="font-semibold text-white text-base">
                  {agent.name}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-400">
                  {agent.id}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {agent.tagline || 'Interactive Sandbox & Curl Runner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close runner modal"
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Section 1: cURL Snippet */}
          <section aria-labelledby="curl-label">
            <h3 id="curl-label" className="text-xs font-mono text-slate-400 mb-2 uppercase tracking-wider">
              1. Direct cURL Command
            </h3>
            <CurlSnippet agentId={agent.id} agentName={agent.name} task={task} />
          </section>

          {/* Section 2: In-Browser Runner */}
          <section aria-labelledby="sandbox-label">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="task-prompt-input" id="sandbox-label" className="block text-xs font-mono text-slate-400 uppercase tracking-wider">
                2. Test In-Browser Sandbox
              </label>
              <span className="text-[11px] text-slate-400 font-mono">Press Cmd+Enter to run</span>
            </div>
            <div className="relative">
              <textarea
                id="task-prompt-input"
                value={task}
                onChange={e => setTask(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    handleRun();
                  }
                }}
                rows={3}
                placeholder="Enter task or instruction for this agent..."
                className="w-full rounded-xl bg-black/40 border border-white/10 p-3 pb-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus-visible:ring-2 focus-visible:ring-indigo-500 font-mono resize-none"
              />
              <button
                onClick={handleRun}
                disabled={loading || !task.trim()}
                aria-busy={loading}
                className="absolute right-3 bottom-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-lg shadow-indigo-600/20 focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
                    <span>Run Task</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Error Message */}
          {error && (
            <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              <strong>Execution Error:</strong> {error}
            </div>
          )}

          {/* Results Area */}
          {response && (
            <div className="space-y-4 animate-in fade-in duration-150" aria-live="polite">
              <TelemetryBar response={response} />
              <ExecutionTrace steps={response.steps} />

              {/* Agent Output Card */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/10 p-4">
                <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-mono uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Agent Output</span>
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
          <span>Endpoint: <code className="font-mono text-slate-300">/api/agents/{agent.id}/run</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};

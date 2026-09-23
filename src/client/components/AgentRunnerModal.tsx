import React, { useState } from 'react';
import { X, Play, Loader2, Bot } from 'lucide-react';
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
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="runner-modal-title"
      ref={modalRef}
    >
      <div className="bg-[#111113] border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              <Play className="w-3.5 h-3.5 fill-zinc-300" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="runner-modal-title" className="font-semibold text-zinc-100 text-base">
                  {agent.name}
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                  {agent.id}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate max-w-md">
                {agent.tagline || 'Interactive Sandbox & Curl Runner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close runner modal"
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Section 1: cURL Snippet */}
          <section aria-labelledby="curl-label">
            <h3 id="curl-label" className="text-xs font-mono text-zinc-400 mb-2 uppercase tracking-wider">
              1. Direct cURL Command
            </h3>
            <CurlSnippet agentId={agent.id} agentName={agent.name} task={task} />
          </section>

          {/* Section 2: In-Browser Runner */}
          <section aria-labelledby="sandbox-label">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="task-prompt-input" id="sandbox-label" className="block text-xs font-mono text-zinc-400 uppercase tracking-wider">
                2. Test In-Browser Sandbox
              </label>
              <span className="text-[11px] text-zinc-500 font-mono">Press Cmd+Enter to run</span>
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
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-3 pb-12 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400 font-mono resize-none"
              />
              <button
                onClick={handleRun}
                disabled={loading || !task.trim()}
                aria-busy={loading}
                className="absolute right-3 bottom-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white active:bg-zinc-200 disabled:opacity-40 text-zinc-950 text-xs font-medium transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-950" aria-hidden="true" />
                    <span>Executing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-zinc-950 text-zinc-950" aria-hidden="true" />
                    <span>Run Task</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* Error Message */}
          {error && (
            <div role="alert" className="p-3.5 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs font-mono">
              <strong>Execution Error:</strong> {error}
            </div>
          )}

          {/* Results Area */}
          {response && (
            <div className="space-y-4 animate-in fade-in duration-150" aria-live="polite">
              <TelemetryBar response={response} />
              <ExecutionTrace steps={response.steps} />

              {/* Agent Output Card */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                <div className="flex items-center gap-2 mb-2 text-zinc-400 text-xs font-mono uppercase tracking-wider">
                  <Bot className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                  <span>Agent Output</span>
                </div>
                <div className="text-sm text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed">
                  {response.result}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
          <span>Endpoint: <code className="font-mono text-zinc-300 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded">/api/agents/{agent.id}/run</code></span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

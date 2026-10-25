import React, { useState } from 'react';
import { X, Play, Loader2, Bot, CheckCircle2, XCircle, FlaskConical, Network } from 'lucide-react';
import { Agent, AgentEvalSuiteResponse, RunAgentResponse } from '../../types.ts';
import { CurlSnippet } from './CurlSnippet.tsx';
import { TelemetryBar } from './runner/TelemetryBar.tsx';
import { ExecutionTrace } from './runner/ExecutionTrace.tsx';
import { RunHistoryView } from './runner/RunHistoryView.tsx';
import { SessionBar } from './runner/SessionBar.tsx';
import { useModalA11y } from '../hooks/useModalA11y.ts';

interface AgentRunnerModalProps {
  agent: Agent;
  onClose: () => void;
  openRouterKey: string | null;
}

export const AgentRunnerModal: React.FC<AgentRunnerModalProps> = ({ agent, onClose, openRouterKey }) => {
  const [activeTab, setActiveTab] = useState<'runner' | 'history' | 'evals'>('runner');
  const [task, setTask] = useState('Inspect the latest components and verify high contrast and typography hierarchy.');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RunAgentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stateful Session, Memory & Multi-turn History state
  const [sessionEnabled, setSessionEnabled] = useState(false);
  const [sessionId, setSessionId] = useState(`ses_${Math.random().toString(36).substring(2, 8)}`);
  const [memory, setMemory] = useState<Record<string, any>>({});
  const [messagesCount, setMessagesCount] = useState(0);

  // Built-in Eval Suite state
  const [evalRunning, setEvalRunning] = useState(false);
  const [evalReport, setEvalReport] = useState<AgentEvalSuiteResponse | null>(null);

  const modalRef = useModalA11y<HTMLDivElement>({ isOpen: true, onClose });

  const handleResetSession = async () => {
    if (sessionId) {
      await fetch(`/api/agents/${agent.id}/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
    }
    setMessagesCount(0);
    setMemory({});
    setResponse(null);
    setSessionId(`ses_${Math.random().toString(36).substring(2, 8)}`);
  };

  const handleRun = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (openRouterKey) headers['Authorization'] = `Bearer ${openRouterKey}`;
      const payload: any = { task };
      if (sessionEnabled) {
        payload.sessionId = sessionId;
        if (Object.keys(memory).length > 0) payload.memory = memory;
      }

      const res = await fetch(`/api/agents/${agent.id}/run`, { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: ${res.statusText}`);
      }
      const data: RunAgentResponse = await res.json();
      setResponse(data);
      if (typeof data.sessionMessagesCount === 'number') setMessagesCount(data.sessionMessagesCount);
      if (data.memory) setMemory(data.memory);
    } catch (err: any) {
      setError(err.message || 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRunEvalSuite = async () => {
    if (evalRunning) return;
    setEvalRunning(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/eval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (res.ok) {
        const report: AgentEvalSuiteResponse = await res.json();
        setEvalReport(report);
      }
    } finally {
      setEvalRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="runner-modal-title" ref={modalRef}>
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Tab switcher */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white shrink-0">
              <Play className="w-3.5 h-3.5 fill-white text-white" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="runner-modal-title" className="font-bold text-zinc-950 text-base">{agent.name}</h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-zinc-700 font-semibold">{agent.id}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-xs font-mono">
              <button type="button" onClick={() => setActiveTab('runner')} className={`px-3 py-1 rounded-md transition-all ${activeTab === 'runner' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}>Sandbox</button>
              <button type="button" onClick={() => setActiveTab('history')} className={`px-3 py-1 rounded-md transition-all ${activeTab === 'history' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}>History & Traces</button>
              <button type="button" onClick={() => setActiveTab('evals')} className={`px-3 py-1 rounded-md transition-all ${activeTab === 'evals' ? 'bg-white text-zinc-950 shadow-2xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'}`}>Evals & Protocols</button>
            </div>
            <button onClick={onClose} aria-label="Close runner modal" className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-500 hover:text-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'history' ? (
            <RunHistoryView agentId={agent.id} />
          ) : activeTab === 'evals' ? (
            <div className="space-y-6" aria-label="Agent Evals and Protocol Endpoints">
              {/* Deterministic Eval Suite Runner */}
              <section className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-zinc-700" aria-hidden="true" />
                      <span>Automated Agent Eval Suite & Guardrail Verification</span>
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Runs deterministic assertions across domain accuracy, MCP tool grounding, and prompt-injection shields.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRunEvalSuite}
                    disabled={evalRunning}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-950 hover:bg-black text-white text-xs font-mono font-semibold transition-all disabled:opacity-50 self-start sm:self-auto"
                  >
                    {evalRunning ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Running Evals...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" aria-hidden="true" />
                        <span>Run Eval Suite</span>
                      </>
                    )}
                  </button>
                </div>

                {evalReport && (
                  <div className="space-y-3 pt-2 border-t border-zinc-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono bg-white p-3 rounded-lg border border-zinc-200">
                      <span className="font-bold text-zinc-950">
                        Pass Rate: {evalReport.passed}/{evalReport.total} ({evalReport.passRate}%)
                      </span>
                      <span className="text-zinc-600">
                        Eval ID: {evalReport.evalId} • Total Latency: {evalReport.durationMs}ms
                      </span>
                    </div>
                    <div className="space-y-2">
                      {evalReport.results.map(item => (
                        <div
                          key={item.id}
                          className="p-3 rounded-lg bg-white border border-zinc-200 flex items-start justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 font-semibold text-zinc-900">
                              {item.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                              ) : (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                              )}
                              <span>{item.name}</span>
                            </div>
                            <p className="text-[11px] text-zinc-500 font-mono truncate">Task: {item.task}</p>
                            <p className="text-[11px] text-zinc-700 font-mono">
                              {item.assertions.map(a => `${a.passed ? '✓' : '✗'} ${a.label}`).join(' • ')}
                            </p>
                          </div>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 shrink-0">
                            {item.durationMs}ms
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Modern Interop Protocol Matrix */}
              <section className="rounded-xl border border-zinc-200 bg-white p-5 space-y-3">
                <h3 className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                  <Network className="w-4 h-4 text-zinc-700" aria-hidden="true" />
                  <span>Multi-Protocol Endpoints for {agent.name}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                    <div className="font-bold text-zinc-900">Native REST & SSE Stream</div>
                    <div className="text-zinc-600 break-all">POST /api/agents/{agent.id}/run</div>
                    <div className="text-[11px] text-zinc-500">Supports {`{"stream": true}`} &amp; {`{"responseFormat": "json_object"}`}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                    <div className="font-bold text-zinc-900">MCP JSON-RPC 2.0 Tool</div>
                    <div className="text-zinc-600 break-all">POST /mcp → tool: agent_{agent.slug.replace(/[^a-z0-9_]/gi, '_')}</div>
                    <div className="text-[11px] text-zinc-500">Resource URI: agent://{agent.id}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                    <div className="font-bold text-zinc-900">Google A2A v1.0 Peer</div>
                    <div className="text-zinc-600 break-all">GET /api/agents/{agent.id}/agent-card.json</div>
                    <div className="text-[11px] text-zinc-500">JSON-RPC tasks/send at POST /api/a2a</div>
                  </div>
                  <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                    <div className="font-bold text-zinc-900">OpenAI v1 Drop-In SDK</div>
                    <div className="text-zinc-600 break-all">POST /v1/chat/completions • POST /v1/responses</div>
                    <div className="text-[11px] text-zinc-500">model: &quot;agentwire/{agent.slug}&quot;</div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <>
              {/* Session, Multi-turn History & Memory Controls */}
              <SessionBar
                enabled={sessionEnabled}
                onToggle={setSessionEnabled}
                sessionId={sessionId}
                onSessionIdChange={setSessionId}
                messagesCount={messagesCount}
                memory={memory}
                onMemoryChange={setMemory}
                onResetSession={handleResetSession}
              />

              {/* Direct cURL / Code Command */}
              <section aria-labelledby="curl-label">
                <h3 id="curl-label" className="text-xs font-mono text-zinc-500 mb-2 uppercase tracking-wider font-semibold">1. Direct cURL Command</h3>
                <CurlSnippet agentId={agent.id} agentName={agent.name} task={task} sessionId={sessionEnabled ? sessionId : undefined} memory={sessionEnabled ? memory : undefined} />
              </section>

              {/* In-Browser Sandbox */}
              <section aria-labelledby="sandbox-label">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="task-prompt-input" id="sandbox-label" className="block text-xs font-mono text-zinc-500 uppercase tracking-wider font-semibold">2. Test In-Browser Sandbox</label>
                  <span className="text-[11px] text-zinc-500 font-mono">Press Cmd+Enter to run</span>
                </div>
                <div className="relative">
                  <textarea
                    id="task-prompt-input"
                    value={task}
                    onChange={e => setTask(e.target.value)}
                    onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleRun(); }}
                    rows={3}
                    placeholder="Enter task or instruction for this agent..."
                    className="w-full rounded-lg bg-white border border-zinc-300 p-3 pb-12 text-sm text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-400 font-mono resize-none shadow-2xs"
                  />
                  <button
                    onClick={handleRun}
                    disabled={loading || !task.trim()}
                    aria-busy={loading}
                    className="absolute right-3 bottom-3 flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-950 hover:bg-black active:bg-zinc-800 disabled:opacity-40 text-white text-xs font-medium transition-colors border border-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                  >
                    {loading ? (<><Loader2 className="w-3.5 h-3.5 animate-spin text-white" aria-hidden="true" /><span>Executing...</span></>) : (<><Play className="w-3.5 h-3.5 fill-white text-white" aria-hidden="true" /><span>Run Task</span></>)}
                  </button>
                </div>
              </section>

              {error && (
                <div role="alert" className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono">
                  <strong>Execution Error:</strong> {error}
                </div>
              )}

              {response && (
                <div className="space-y-4 animate-in fade-in duration-150" aria-live="polite">
                  <TelemetryBar response={response} />
                  <ExecutionTrace steps={response.steps} />

                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-zinc-950 text-xs font-mono uppercase tracking-wider font-bold">
                        <Bot className="w-3.5 h-3.5 text-zinc-700" aria-hidden="true" />
                        <span>Agent Output</span>
                      </div>
                      {response.sessionId && (
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-200 text-zinc-800 font-semibold">
                          Session: {response.sessionId} ({response.sessionMessagesCount ?? 0} msgs)
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-950 whitespace-pre-wrap font-sans leading-relaxed">
                      {response.result}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-200 bg-zinc-50 flex items-center justify-between text-xs text-zinc-600">
          <span>Endpoint: <code className="font-mono text-zinc-900 bg-white border border-zinc-200 px-1.5 py-0.5 rounded shadow-2xs">/api/agents/{agent.id}/run</code></span>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

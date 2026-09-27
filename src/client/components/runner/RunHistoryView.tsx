import React, { useState, useEffect } from 'react';
import { AgentRunRecord } from '../../../types.ts';
import { Activity, Clock, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, RefreshCw, Cpu, Layers } from 'lucide-react';

interface RunHistoryViewProps {
  agentId: string;
}

export const RunHistoryView: React.FC<RunHistoryViewProps> = ({ agentId }) => {
  const [runs, setRuns] = useState<AgentRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/runs`);
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (e) {
      console.error('Failed to load run history', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [agentId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-600" aria-hidden="true" />
          <h3 className="text-xs font-mono text-zinc-700 uppercase tracking-wider font-semibold">
            Execution Logs & Traces ({runs.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={fetchRuns}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-100 hover:bg-zinc-200/80 text-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {loading && runs.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-zinc-500">
          Loading execution traces from edge KV...
        </div>
      ) : runs.length === 0 ? (
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-6 text-center space-y-1.5">
          <p className="text-xs font-mono text-zinc-700 font-medium">No recorded runs yet.</p>
          <p className="text-[11px] text-zinc-500">
            Execute a task via the Sandbox tab or cURL to start capturing telemetry.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {runs.map(run => {
            const isExpanded = expandedRunId === run.runId;
            return (
              <div
                key={run.runId}
                className="rounded-xl border border-zinc-200 bg-white p-3.5 space-y-2 shadow-2xs hover:border-zinc-300 transition-all text-left"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedRunId(isExpanded ? null : run.runId)}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setExpandedRunId(isExpanded ? null : run.runId)}
                  className="flex items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
                    )}
                    <span className="font-mono text-xs font-semibold text-zinc-900 truncate">
                      {run.runId}
                    </span>
                    {run.status === 'success' ? (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" aria-hidden="true" />
                        <span>Success</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-2.5 h-2.5 text-rose-600" aria-hidden="true" />
                        <span>Error</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-500 shrink-0">
                    <span className="flex items-center gap-1" title="Execution latency">
                      <Clock className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                      {run.durationMs}ms
                    </span>
                    {run.tokens && (
                      <span className="flex items-center gap-1" title="Total tokens">
                        <Cpu className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                        {run.tokens.total} tok
                      </span>
                    )}
                  </div>
                </div>

                {/* Task preview */}
                <p className="text-xs text-zinc-600 font-mono truncate pl-5">
                  &ldquo;{run.task}&rdquo;
                </p>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="pt-3 border-t border-zinc-100 pl-5 space-y-3 animate-in fade-in duration-100">
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-600">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                        Model: <strong className="text-zinc-900">{run.modelUsed}</strong>
                      </span>
                      <span>Trace ID: <strong className="text-zinc-900">{run.traceId}</strong></span>
                      <span>Time: {new Date(run.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                        Step-by-Step Execution Profile:
                      </div>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {run.steps.map((st, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] font-mono py-1 px-2 rounded bg-zinc-50 border border-zinc-100"
                          >
                            <span className="text-zinc-800 truncate max-w-sm">
                              [{st.type}] {st.toolName ? `${st.toolName}()` : st.content?.substring(0, 60)}
                            </span>
                            <span className="text-zinc-500 shrink-0">
                              {st.durationMs !== undefined ? `${st.durationMs}ms` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

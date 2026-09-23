import React from 'react';
import { Terminal, Check, Zap, AlertCircle } from 'lucide-react';
import { ToolExecutionStep } from '../../../types.ts';

interface ExecutionTraceProps {
  steps: ToolExecutionStep[];
}

export const ExecutionTrace: React.FC<ExecutionTraceProps> = ({ steps }) => {
  if (!steps || steps.length === 0) return null;

  return (
    <div
      role="region"
      aria-label={`Execution Trace: ${steps.length} steps`}
      className="rounded-xl border border-white/10 bg-black/40 overflow-hidden text-xs font-mono"
    >
      <div className="px-3.5 py-2 border-b border-white/10 bg-white/[0.02] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" aria-hidden="true" />
          <span>Execution Trace & Tool Calls</span>
        </div>
        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">
          {steps.length} {steps.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      <div className="p-3.5 space-y-2.5 max-h-64 overflow-y-auto">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-slate-300">
            <span className="text-slate-400 select-none text-[11px] pt-0.5 font-semibold">
              [{idx + 1}]
            </span>
            <div className="flex-1 min-w-0">
              {step.type === 'thought' && (
                <p className="text-slate-400 italic leading-relaxed">
                  {step.content}
                </p>
              )}
              {step.type === 'tool_call' && (
                <div className="text-amber-300 flex items-start gap-1.5 break-all">
                  <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
                  <div>
                    <span className="text-slate-400">Call Tool:</span>{' '}
                    <span className="font-bold underline text-amber-200">{step.toolName}</span>
                    <span className="text-slate-400">({JSON.stringify(step.toolArgs)})</span>
                  </div>
                </div>
              )}
              {step.type === 'tool_result' && (
                <div className="text-emerald-300 flex items-start gap-1.5 break-all">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" aria-hidden="true" />
                  <div>
                    <span className="text-slate-400">Result from</span>{' '}
                    <span className="font-semibold text-emerald-200">{step.toolName}</span>:{' '}
                    <span className="text-slate-300">{JSON.stringify(step.toolOutput).slice(0, 200)}</span>
                    {JSON.stringify(step.toolOutput).length > 200 && '...'}
                  </div>
                </div>
              )}
              {step.type === 'answer' && (
                <div className="text-indigo-300 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" aria-hidden="true" />
                  <span>Agent synthesized final response</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

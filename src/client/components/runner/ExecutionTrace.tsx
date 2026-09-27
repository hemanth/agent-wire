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
      className="rounded-lg border border-zinc-200 bg-white overflow-hidden text-xs font-mono shadow-2xs"
    >
      <div className="px-3.5 py-2 border-b border-zinc-200 bg-zinc-50 text-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
          <span className="font-semibold text-zinc-950">Execution Trace & Tool Calls</span>
        </div>
        <span className="text-[10px] text-zinc-700 bg-white border border-zinc-200 px-2 py-0.5 rounded shadow-2xs font-medium">
          {steps.length} {steps.length === 1 ? 'turn' : 'turns'}
        </span>
      </div>

      <div className="p-3.5 space-y-2.5 max-h-64 overflow-y-auto">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-2.5 text-zinc-800">
            <span className="text-zinc-500 select-none text-[11px] pt-0.5 font-bold">
              [{idx + 1}]
            </span>
            <div className="flex-1 min-w-0">
              {step.type === 'thought' && (
                <p className="text-zinc-600 italic leading-relaxed">
                  {step.content}
                </p>
              )}
              {step.type === 'tool_call' && (
                <div className="text-zinc-950 flex items-start gap-1.5 break-all">
                  <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
                  <div>
                    <span className="text-zinc-500 font-medium">Call Tool:</span>{' '}
                    <span className="font-bold text-zinc-950 underline decoration-emerald-300">{step.toolName}</span>
                    <span className="text-zinc-600 font-mono">({JSON.stringify(step.toolArgs)})</span>
                  </div>
                </div>
              )}
              {step.type === 'tool_result' && (
                <div className="text-zinc-950 flex items-start gap-1.5 break-all">
                  <Check className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
                  <div>
                    <span className="text-zinc-500 font-medium">Result from</span>{' '}
                    <span className="font-bold text-zinc-950">{step.toolName}</span>:{' '}
                    <span className="text-zinc-700 font-mono">{JSON.stringify(step.toolOutput).slice(0, 200)}</span>
                    {JSON.stringify(step.toolOutput).length > 200 && '...'}
                  </div>
                </div>
              )}
              {step.type === 'answer' && (
                <div className="text-zinc-950 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
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

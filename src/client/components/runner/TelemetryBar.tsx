import React from 'react';
import { Cpu, Wrench, Clock, Coins, ShieldAlert, Compass, UserCheck } from 'lucide-react';
import { RunAgentResponse } from '../../../types.ts';

interface TelemetryBarProps {
  response: RunAgentResponse;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({ response }) => {
  return (
    <div
      role="region"
      aria-label="Execution Telemetry"
      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs font-mono shadow-2xs"
    >
      <div className="flex flex-wrap items-center gap-4 text-zinc-700">
        <span className="flex items-center gap-1.5 text-zinc-950 font-semibold">
          <Cpu className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
          <span>Model: {response.modelUsed}</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-700">
          <Wrench className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
          <span>Tools used: {response.toolsUsed.length > 0 ? response.toolsUsed.join(', ') : 'None'}</span>
        </span>
        {response.intent && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/80 text-zinc-900 border border-zinc-300 text-[11px] font-semibold">
            <Compass className="w-3 h-3 text-zinc-700" aria-hidden="true" />
            <span>Intent: {response.intent.id}</span>
          </span>
        )}
        {response.stickyUser && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/80 text-zinc-900 border border-zinc-300 text-[11px] font-semibold">
            <UserCheck className="w-3 h-3 text-zinc-700" aria-hidden="true" />
            <span>User: {response.stickyUser.userId}</span>
          </span>
        )}
        {response.tokens && (
          <span className="flex items-center gap-1.5 text-zinc-700">
            <Coins className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
            <span>
              {response.tokens.total} tok
              {typeof response.estimatedCostUsd === 'number' ? ` ($${response.estimatedCostUsd.toFixed(5)})` : ''}
            </span>
          </span>
        )}
        {response.guardrailsTriggered && response.guardrailsTriggered.length > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold">
            <ShieldAlert className="w-3 h-3" aria-hidden="true" />
            <span>Guardrail: {response.guardrailsTriggered.join(', ')}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-zinc-700">
        <Clock className="w-3 h-3 text-zinc-600" aria-hidden="true" />
        <span>Latency: {(response.durationMs / 1000).toFixed(2)}s</span>
      </div>
    </div>
  );
};

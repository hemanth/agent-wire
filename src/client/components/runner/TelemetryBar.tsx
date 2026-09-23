import React from 'react';
import { Cpu, Wrench, Clock } from 'lucide-react';
import { RunAgentResponse } from '../../../types.ts';

interface TelemetryBarProps {
  response: RunAgentResponse;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({ response }) => {
  return (
    <div
      role="region"
      aria-label="Execution Telemetry"
      className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-mono"
    >
      <div className="flex flex-wrap items-center gap-4 text-zinc-400">
        <span className="flex items-center gap-1.5 text-zinc-300">
          <Cpu className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span>Model: {response.modelUsed}</span>
        </span>
        <span className="flex items-center gap-1.5 text-zinc-400">
          <Wrench className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span>Tools used: {response.toolsUsed.length > 0 ? response.toolsUsed.join(', ') : 'None'}</span>
        </span>
      </div>
      <div className="flex items-center gap-1 text-zinc-500">
        <Clock className="w-3 h-3 text-zinc-500" aria-hidden="true" />
        <span>Latency: {(response.durationMs / 1000).toFixed(2)}s</span>
      </div>
    </div>
  );
};

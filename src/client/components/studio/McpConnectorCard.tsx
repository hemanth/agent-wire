import React from 'react';
import { RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import { McpConnector } from '../../../types.ts';

interface McpConnectorCardProps {
  mcp: McpConnector;
  isProbing: boolean;
  onProbe: (id: string, url: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export const McpConnectorCard: React.FC<McpConnectorCardProps> = ({
  mcp,
  isProbing,
  onProbe,
  onRemove
}) => {
  return (
    <div
      role="listitem"
      className="p-3.5 rounded-lg border border-zinc-800 bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs text-zinc-200">{mcp.name}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 uppercase">
            {mcp.type}
          </span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              mcp.status === 'connected' ? 'bg-emerald-500' : mcp.status === 'error' ? 'bg-red-400' : 'bg-amber-400'
            }`}
            title={`Status: ${mcp.status}`}
            aria-label={`Status: ${mcp.status}`}
          />
        </div>
        <div className="font-mono text-xs text-zinc-500 truncate mt-0.5">
          {mcp.url}
        </div>

        {mcp.tools && mcp.tools.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2" aria-label="Discovered tools">
            {mcp.tools.map((t, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 text-[10px] font-mono"
                title={t.description}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {mcp.errorMessage && (
          <div role="alert" className="flex items-center gap-1 text-[11px] font-mono text-red-400 mt-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>{mcp.errorMessage}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={() => onProbe(mcp.id, mcp.url)}
          disabled={isProbing}
          aria-busy={isProbing}
          aria-label={`Test ping ${mcp.name}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-mono border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <RefreshCw className={`w-3 h-3 text-zinc-400 ${isProbing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isProbing ? 'Probing...' : 'Test Ping'}</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(mcp.id)}
          aria-label={`Remove connector ${mcp.name}`}
          className="p-1.5 rounded-md hover:bg-red-950/30 text-zinc-500 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

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
      className="p-4 rounded-xl border border-zinc-200/90 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 transition-all"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-xs text-zinc-900">{mcp.name}</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-700 uppercase font-medium">
            {mcp.type}
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              mcp.status === 'connected'
                ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                : mcp.status === 'error'
                ? 'bg-rose-500'
                : 'bg-amber-400'
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
                className="px-2.5 py-0.5 rounded-full bg-zinc-50 text-zinc-700 border border-zinc-200 text-[10px] font-mono shadow-2xs"
                title={t.description}
              >
                {t.name}
              </span>
            ))}
          </div>
        )}

        {mcp.errorMessage && (
          <div role="alert" className="flex items-center gap-1 text-[11px] font-mono text-rose-600 mt-1.5">
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
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-mono border border-zinc-200 shadow-2xs transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          <RefreshCw className={`w-3 h-3 text-zinc-500 ${isProbing ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isProbing ? 'Probing...' : 'Test Ping'}</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(mcp.id)}
          aria-label={`Remove connector ${mcp.name}`}
          className="p-1.5 rounded-xl hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

import React from 'react';
import { ArrowRight, RefreshCw, AlertCircle, Terminal } from 'lucide-react';

interface DeployStatusBarProps {
  deploying: boolean;
  canDeploy: boolean;
  error: string | null;
}

export const DeployStatusBar: React.FC<DeployStatusBarProps> = ({
  deploying,
  canDeploy,
  error
}) => {
  return (
    <div className="space-y-4 pt-4 border-t border-zinc-800">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-3.5 rounded-lg bg-red-950/40 border border-red-900/60 text-red-300 text-xs font-mono"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-zinc-400 font-mono flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
          <span>
            Output:{' '}
            <code className="text-zinc-200 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
              POST /api/agents/:id/run
            </code>
          </span>
        </div>

        <button
          type="submit"
          disabled={deploying || !canDeploy}
          aria-busy={deploying}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-zinc-100 hover:bg-white active:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-medium text-sm transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
        >
          {deploying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-zinc-900" aria-hidden="true" />
              <span>Deploying Agent...</span>
            </>
          ) : (
            <>
              <span>Deploy Agent Endpoint</span>
              <ArrowRight className="w-4 h-4 text-zinc-900" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

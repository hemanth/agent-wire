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
    <div className="space-y-4 pt-6 border-t border-zinc-200/80">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-mono shadow-2xs"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-zinc-500 font-mono flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
          <span>
            Target Endpoint:{' '}
            <code className="text-zinc-900 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-md font-semibold">
              POST /api/agents/:id/run
            </code>
          </span>
        </div>

        <button
          type="submit"
          disabled={deploying || !canDeploy}
          aria-busy={deploying}
          className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl bg-zinc-950 hover:bg-black active:bg-zinc-850 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-all border border-transparent shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
        >
          {deploying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-white" aria-hidden="true" />
              <span>Deploying Agent...</span>
            </>
          ) : (
            <>
              <span>Deploy Agent Endpoint</span>
              <ArrowRight className="w-4 h-4 text-white" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

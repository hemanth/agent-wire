import React from 'react';
import { Sparkles, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

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
    <div className="space-y-4 pt-4 border-t border-white/10">
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono"
        >
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-400 font-mono">
          Output:{' '}
          <span className="text-slate-200">
            Instant curlable endpoint at{' '}
            <code className="text-indigo-300 bg-white/5 px-1 py-0.5 rounded">/api/agents/:id/run</code>
          </span>
        </div>

        <button
          type="submit"
          disabled={deploying || !canDeploy}
          aria-busy={deploying}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-xl shadow-indigo-600/30 focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {deploying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Deploying Agent...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>Deploy Agent & Generate cURL</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

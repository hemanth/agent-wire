import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo): void {
    // Client render failures are isolated here so internal stack traces never surface to end users
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6 text-zinc-900"
        >
          <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-700">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <h1 className="text-base font-bold text-zinc-950">Something went wrong</h1>
            <p className="text-xs text-zinc-600 leading-relaxed">
              An unexpected interface error occurred. Your deployed agents and API endpoints remain active.
            </p>
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

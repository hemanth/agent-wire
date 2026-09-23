import React, { useState } from 'react';
import { X, Key, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y.ts';
import { initiateOAuth } from '../lib/openrouter-auth.ts';

interface OpenRouterModalProps {
  currentKey: string | null;
  onSaveKey: (key: string | null) => void;
  onClose: () => void;
}

export const OpenRouterModal: React.FC<OpenRouterModalProps> = ({ currentKey, onSaveKey, onClose }) => {
  const [manualKey, setManualKey] = useState(currentKey || '');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const modalRef = useModalA11y<HTMLDivElement>({ isOpen: true, onClose });

  const handleStartOAuth = async () => {
    try {
      setIsRedirecting(true);
      await initiateOAuth();
    } catch (err: any) {
      setIsRedirecting(false);
      console.error('Failed to initiate PKCE flow', err);
      alert('Could not start OpenRouter OAuth: ' + (err.message || err));
    }
  };

  const handleSaveManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualKey.trim()) {
      onSaveKey(manualKey.trim());
    } else {
      onSaveKey(null);
    }
    onClose();
  };

  const handleClear = () => {
    onSaveKey(null);
    setManualKey('');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      ref={modalRef}
    >
      <div className="bg-[#111113] border border-zinc-800 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
              <Key className="w-4 h-4 text-zinc-400" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="font-semibold text-zinc-100 text-base">
                OpenRouter Model Gateway
              </h2>
              <p className="text-xs text-zinc-400">
                Automatic Multi-Model Fallbacks (Claude, Gemini, Llama)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Method A: 1-Click Sign in with OpenRouter via PKCE */}
          <div className="p-4 rounded-lg border border-zinc-800 bg-zinc-950 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-zinc-400" aria-hidden="true" />
                <span>Recommended: 1-Click PKCE Auth</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                Zero Copy-Paste
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Securely authorize AgentWire with your OpenRouter account using standard OAuth PKCE. Revoke anytime in your OpenRouter settings.
            </p>
            <button
              onClick={handleStartOAuth}
              disabled={isRedirecting}
              aria-busy={isRedirecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white active:bg-zinc-200 disabled:opacity-40 text-zinc-950 text-xs font-medium transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <span>{isRedirecting ? 'Redirecting to OpenRouter...' : 'Sign In with OpenRouter'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-[11px] font-mono text-zinc-500 uppercase">Or Enter Key Manually</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Method B: Manual Key Input */}
          <form onSubmit={handleSaveManual} className="space-y-4">
            <div>
              <label htmlFor="openrouter-api-key-input" className="block text-xs font-mono text-zinc-400 mb-1.5">
                OpenRouter API Key (<code className="text-zinc-500">sk-or-v1-...</code>)
              </label>
              <input
                id="openrouter-api-key-input"
                type="password"
                value={manualKey}
                onChange={e => setManualKey(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400 font-mono"
              />
              <p className="text-[11px] text-zinc-500 mt-1">
                Keys remain solely in your browser's local storage and are passed directly to OpenRouter.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {currentKey ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 rounded px-1"
                >
                  Disconnect Key
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-medium transition-colors border border-transparent shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Save Key
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

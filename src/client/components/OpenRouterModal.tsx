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
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      ref={modalRef}
    >
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-800 shrink-0 shadow-2xs">
              <Key className="w-4 h-4 text-zinc-700" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="font-bold text-zinc-950 text-base">
                OpenRouter Model Gateway
              </h2>
              <p className="text-xs text-zinc-600">
                Automatic Multi-Model Fallbacks (Claude, Gemini, Llama)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Method A: 1-Click Sign in with OpenRouter via PKCE */}
          <div className="p-4 rounded-xl border border-zinc-200 bg-zinc-50 space-y-3 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-950 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-zinc-700" aria-hidden="true" />
                <span>Recommended: 1-Click PKCE Auth</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white text-zinc-800 border border-zinc-200 font-semibold shadow-2xs">
                Zero Copy-Paste
              </span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Securely authorize AgentWire with your OpenRouter account using standard OAuth PKCE. Revoke anytime in your OpenRouter settings.
            </p>
            <button
              onClick={handleStartOAuth}
              disabled={isRedirecting}
              aria-busy={isRedirecting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-950 hover:bg-black active:bg-zinc-850 disabled:opacity-40 text-white text-xs font-medium transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.99]"
            >
              <span>{isRedirecting ? 'Redirecting to OpenRouter...' : 'Sign In with OpenRouter'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-200" />
            <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Or Enter Key Manually</span>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Method B: Manual Key Input */}
          <form onSubmit={handleSaveManual} className="space-y-4">
            <div>
              <label htmlFor="openrouter-api-key-input" className="block text-xs font-mono text-zinc-700 font-medium mb-1.5">
                OpenRouter API Key (<code className="text-zinc-500">sk-or-v1-...</code>)
              </label>
              <input
                id="openrouter-api-key-input"
                type="password"
                value={manualKey}
                onChange={e => setManualKey(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                className="w-full rounded-xl bg-white border border-zinc-300 px-3.5 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-200 font-mono shadow-2xs"
              />
              <p className="text-[11px] text-zinc-500 mt-1.5">
                Keys remain solely in your browser's local storage and are passed directly to OpenRouter.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {currentKey ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-600 hover:text-rose-700 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 rounded px-1 transition-colors"
                >
                  Disconnect Key
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 text-xs border border-zinc-200 font-medium transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-medium transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
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

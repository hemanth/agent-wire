import React, { useState } from 'react';
import { X, Key, ShieldCheck, Sparkles, ExternalLink, ArrowRight } from 'lucide-react';

interface OpenRouterModalProps {
  currentKey: string | null;
  onSaveKey: (key: string | null) => void;
  onClose: () => void;
}

// PKCE Helper functions
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

async function sha256Base64Url(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const base64 = btoa(String.fromCharCode(...hashArray));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const OpenRouterModal: React.FC<OpenRouterModalProps> = ({ currentKey, onSaveKey, onClose }) => {
  const [manualKey, setManualKey] = useState(currentKey || '');

  const handleStartOAuth = async () => {
    try {
      const verifier = generateRandomString(64);
      const challenge = await sha256Base64Url(verifier);

      sessionStorage.setItem('openrouter_code_verifier', verifier);

      const callbackUrl = window.location.origin + window.location.pathname;
      const authUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(callbackUrl)}&code_challenge=${challenge}&code_challenge_method=S256`;

      window.location.href = authUrl;
    } catch (err) {
      console.error('Failed to initiate PKCE flow', err);
      alert('Could not start OpenRouter OAuth. You can enter an API key manually.');
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
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0C0F17] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-white">OpenRouter Model Gateway</h3>
              <p className="text-xs text-slate-400">Multi-Model Fallbacks (Claude, Gemini, Llama, DeepSeek)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Method A: 1-Click Sign in with OpenRouter via PKCE */}
          <div className="p-4 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Recommended: 1-Click PKCE Auth
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                Zero Copy-Paste
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Securely authorize AgentWire with your OpenRouter account using standard OAuth PKCE. You can revoke access anytime.
            </p>
            <button
              onClick={handleStartOAuth}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
            >
              <Sparkles className="w-4 h-4" />
              Sign In with OpenRouter
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-75" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] font-mono text-slate-500 uppercase">Or Enter Key Manually</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Method B: Manual Key Input */}
          <form onSubmit={handleSaveManual} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">
                OpenRouter API Key (sk-or-v1-...)
              </label>
              <input
                type="password"
                value={manualKey}
                onChange={e => setManualKey(e.target.value)}
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxx"
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Keys are stored only in your browser's local storage and passed directly to OpenRouter.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              {currentKey ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-400 hover:text-rose-300 font-mono"
                >
                  Disconnect Key
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-white text-black hover:bg-slate-200 text-xs font-medium transition-colors"
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

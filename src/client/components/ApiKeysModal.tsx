import React, { useState, useEffect } from 'react';
import { X, Key, Plus, Trash2, Check, Copy, ShieldCheck, AlertCircle } from 'lucide-react';
import { AgentWireApiKey } from '../../types.ts';
import { useModalA11y } from '../hooks/useModalA11y.ts';
import { getStoredWireApiKey, setStoredWireApiKey } from '../lib/runtime-init.ts';

interface ApiKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApiKeysModal: React.FC<ApiKeysModalProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<AgentWireApiKey[]>([]);
  const [keyName, setKeyName] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });

  const buildAuthHeaders = (): Record<string, string> => {
    const activeWireKey = getStoredWireApiKey();
    return activeWireKey ? { 'X-AgentWire-Key': activeWireKey } : {};
  };

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys', { headers: buildAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch {
      // Non-fatal: list stays empty when unreachable
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setNewKey(null);
      setError(null);
    }
  }, [isOpen]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...buildAuthHeaders() },
        body: JSON.stringify({ name: keyName.trim() || 'Personal Key' })
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setStoredWireApiKey(data.key);
        setKeyName('');
        fetchKeys();
      } else {
        const errBody = await res.json().catch(() => ({}));
        setError(errBody.error || `Failed to create key (HTTP ${res.status}).`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create API key.');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any scripts using it will lose access.')) return;
    setError(null);
    const res = await fetch(`/api/keys/${id}`, {
      method: 'DELETE',
      headers: buildAuthHeaders()
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.error || `Failed to revoke key (HTTP ${res.status}).`);
      return;
    }
    fetchKeys();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-md flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-keys-title"
      ref={modalRef}
    >
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center text-white shrink-0">
              <Key className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <div>
              <h2 id="api-keys-title" className="font-bold text-zinc-950 text-base">
                AgentWire API Keys & Permissions
              </h2>
              <p className="text-xs text-zinc-600">Authorize cURL and authenticate private agent endpoints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close API Keys modal"
            className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-600 hover:text-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-mono text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {newKey && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Save your API key</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Copy this key now. It is also active in this browser session for testing private agents.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  aria-label="Generated AgentWire API key"
                  value={newKey}
                  className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 shadow-2xs select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex gap-2">
            <label htmlFor="api-key-label-input" className="sr-only">
              API Key Label
            </label>
            <input
              id="api-key-label-input"
              type="text"
              placeholder="Key label (e.g. CI/CD or Terminal)"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2 text-xs font-mono text-zinc-900 placeholder-zinc-500 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs"
            />
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 hover:bg-black text-white text-xs font-medium transition-colors shadow-xs shrink-0"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Create Key</span>
            </button>
          </form>

          <div className="space-y-2">
            <h3 className="text-xs font-mono text-zinc-600 uppercase tracking-wider font-semibold">Active Access Keys ({keys.length})</h3>
            {keys.length === 0 ? (
              <p className="text-xs font-mono text-zinc-600 py-3 text-center">No API keys created yet.</p>
            ) : (
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">{k.name}</div>
                      <div className="text-[11px] font-mono text-zinc-600">{k.keyPrefix}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-zinc-600 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
                      aria-label={`Revoke key ${k.name}`}
                      title="Revoke key"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

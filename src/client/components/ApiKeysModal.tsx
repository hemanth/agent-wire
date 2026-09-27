import React, { useState, useEffect } from 'react';
import { X, Key, Plus, Trash2, Check, Copy, ShieldCheck, AlertCircle } from 'lucide-react';
import { AgentWireApiKey } from '../../types.ts';
import { useModalA11y } from '../hooks/useModalA11y.ts';

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

  const modalRef = useModalA11y<HTMLDivElement>({ isOpen, onClose });

  const fetchKeys = async () => {
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Failed to load keys', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchKeys();
      setNewKey(null);
    }
  }, [isOpen]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName.trim() || 'Personal Key' })
      });
      if (res.ok) {
        const data = await res.json();
        setNewKey(data.key);
        setKeyName('');
        fetchKeys();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Revoke this API key? Any scripts using it will lose access.')) return;
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
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
              <p className="text-xs text-zinc-500">Authorize cURL and authenticate private agent endpoints</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close API Keys modal"
            className="p-1.5 rounded-lg hover:bg-black/5 text-zinc-500 hover:text-zinc-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {newKey && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
              <div className="flex items-center gap-2 text-emerald-900 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                <span>Save your API key</span>
              </div>
              <p className="text-[11px] text-emerald-800">
                Copy this key now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={newKey}
                  className="flex-1 bg-white border border-emerald-300 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-900 shadow-2xs select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(newKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-2xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              type="text"
              placeholder="Key label (e.g. CI/CD or Terminal)"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              className="flex-1 rounded-xl bg-zinc-50 border border-zinc-200 px-3.5 py-2 text-xs font-mono text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs"
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
            <h3 className="text-xs font-mono text-zinc-500 uppercase tracking-wider font-semibold">Active Access Keys ({keys.length})</h3>
            {keys.length === 0 ? (
              <p className="text-xs font-mono text-zinc-400 py-3 text-center">No API keys created yet.</p>
            ) : (
              <div className="space-y-2">
                {keys.map(k => (
                  <div key={k.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 bg-zinc-50/50">
                    <div>
                      <div className="text-xs font-semibold text-zinc-900">{k.name}</div>
                      <div className="text-[11px] font-mono text-zinc-500">{k.keyPrefix}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors"
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

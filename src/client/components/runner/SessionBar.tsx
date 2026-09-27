import React, { useState } from 'react';
import { Layers, RotateCcw, Database, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

interface SessionBarProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  sessionId: string;
  onSessionIdChange: (id: string) => void;
  messagesCount: number;
  memory: Record<string, any>;
  onMemoryChange: (mem: Record<string, any>) => void;
  onResetSession: () => void;
}

export const SessionBar: React.FC<SessionBarProps> = ({
  enabled,
  onToggle,
  sessionId,
  onSessionIdChange,
  messagesCount,
  memory,
  onMemoryChange,
  onResetSession
}) => {
  const [showMemoryEditor, setShowMemoryEditor] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const memoryKeys = Object.keys(memory || {});

  const handleAddMemory = () => {
    if (!newKey.trim()) return;
    onMemoryChange({ ...memory, [newKey.trim()]: newVal.trim() });
    setNewKey('');
    setNewVal('');
  };

  const handleDeleteMemory = (key: string) => {
    const updated = { ...memory };
    delete updated[key];
    onMemoryChange(updated);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-3 space-y-2 text-xs font-mono shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
          <span className="font-semibold text-zinc-900">Execution Mode:</span>
          <div className="flex items-center bg-zinc-200/80 p-0.5 rounded-lg text-[11px]">
            <button
              type="button"
              onClick={() => onToggle(false)}
              className={`px-2 py-0.5 rounded transition-all ${
                !enabled ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Stateless
            </button>
            <button
              type="button"
              onClick={() => onToggle(true)}
              className={`px-2 py-0.5 rounded transition-all ${
                enabled ? 'bg-white text-zinc-950 font-bold shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Stateful Thread
            </button>
          </div>
        </div>

        {enabled && (
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">History:</span>
            <span className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-900 font-semibold shadow-2xs">
              {messagesCount} turns
            </span>
            <button
              type="button"
              onClick={() => setShowMemoryEditor(!showMemoryEditor)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-zinc-100 border border-zinc-200 text-zinc-700 shadow-2xs transition-colors"
            >
              <Database className="w-3 h-3 text-zinc-500" aria-hidden="true" />
              <span>Memory ({memoryKeys.length})</span>
              {showMemoryEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              type="button"
              onClick={onResetSession}
              title="Reset session history and memory"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-zinc-200 text-zinc-600 shadow-2xs transition-colors"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              <span>Reset</span>
            </button>
          </div>
        )}
      </div>

      {enabled && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60">
          <label htmlFor="session-id-input" className="text-zinc-500 shrink-0">
            Session ID:
          </label>
          <input
            id="session-id-input"
            value={sessionId}
            onChange={e => onSessionIdChange(e.target.value)}
            className="flex-1 bg-white border border-zinc-200 rounded px-2 py-1 text-zinc-900 focus:outline-none focus:border-zinc-400 font-mono shadow-2xs"
            placeholder="e.g. ses_user_thread_42"
          />
        </div>
      )}

      {enabled && showMemoryEditor && (
        <div className="p-2.5 rounded-lg bg-white border border-zinc-200 space-y-2 animate-in fade-in duration-100">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-medium">
            <span>Persistent Working Memory (Injected into Agent Context)</span>
            <span>{memoryKeys.length} items</span>
          </div>

          {memoryKeys.length === 0 ? (
            <div className="text-[11px] text-zinc-400 py-1 italic">
              No memory variables set. Add key-value pairs below or pass via API.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {memoryKeys.map(k => (
                <div key={k} className="flex items-center justify-between bg-zinc-50 border border-zinc-200 px-2 py-1 rounded text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-zinc-900">{k}:</span>
                    <span className="text-zinc-600 truncate">{JSON.stringify(memory[k])}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteMemory(k)}
                    className="p-1 hover:text-rose-600 text-zinc-400 transition-colors"
                    aria-label={`Remove memory key ${k}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 pt-1">
            <input
              placeholder="Key"
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="w-1/3 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-900 focus:outline-none focus:border-zinc-400"
            />
            <input
              placeholder="Value"
              value={newVal}
              onChange={e => setNewVal(e.target.value)}
              className="flex-1 bg-zinc-50 border border-zinc-200 rounded px-2 py-1 text-[11px] text-zinc-900 focus:outline-none focus:border-zinc-400"
            />
            <button
              type="button"
              onClick={handleAddMemory}
              disabled={!newKey.trim()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-900 hover:bg-black disabled:opacity-40 text-white text-[11px] transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

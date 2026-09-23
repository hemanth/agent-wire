import React from 'react';
import { Layers, CheckCircle2, Key } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../../presets.ts';

interface ModelSelectorSectionProps {
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
  maxTokens?: number;
  setMaxTokens?: (val: number) => void;
}

export const ModelSelectorSection: React.FC<ModelSelectorSectionProps> = ({
  selectedModels,
  onToggleModel,
  openRouterKey,
  onOpenAuthModal,
  maxTokens = 2048,
  setMaxTokens
}) => {
  return (
    <section aria-labelledby="section-models-title" className="rounded-xl border border-zinc-800 bg-[#111113] p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <Layers className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <h2 id="section-models-title" className="text-sm font-medium text-zinc-200">
            2. OpenRouter Model Fallback Chain & Token Budget
          </h2>
        </div>
        {!openRouterKey && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-mono underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded self-start sm:self-auto"
          >
            <Key className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
            Connect OpenRouter Key
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-400 leading-relaxed">
        Select models in priority order. OpenRouter automatically fails over to the next candidate if the primary model is unavailable or rate-limited.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3" role="group" aria-label="Available models for fallback chain">
        {AVAILABLE_MODELS.map(m => {
          const isSelected = selectedModels.includes(m.id);
          const rank = selectedModels.indexOf(m.id);

          return (
            <div
              key={m.id}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onToggleModel(m.id)}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggleModel(m.id);
                }
              }}
              className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                isSelected
                  ? 'border-zinc-500 bg-zinc-900 text-zinc-100 shadow-sm'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs text-zinc-200 truncate">{m.name}</span>
                  {isSelected && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      #{rank + 1}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {m.provider} • {m.context}
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  isSelected ? 'border-zinc-100 bg-zinc-100' : 'border-zinc-700'
                }`}
                aria-hidden="true"
              >
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-zinc-950 fill-zinc-100" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Max output tokens control */}
      <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-zinc-400">
          <span className="font-medium text-zinc-300">Max Output Tokens:</span>{' '}
          <span className="text-[11px] text-zinc-500">Limits credit reservation to avoid OpenRouter 402 on low balances</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono" role="group" aria-label="Max token limits">
          {[1024, 2048, 4096].map(limit => (
            <button
              key={limit}
              type="button"
              onClick={() => setMaxTokens?.(limit)}
              className={`px-2.5 py-1 rounded-md border text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                maxTokens === limit
                  ? 'border-zinc-500 bg-zinc-800 text-zinc-100 font-medium'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              {limit} tokens
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

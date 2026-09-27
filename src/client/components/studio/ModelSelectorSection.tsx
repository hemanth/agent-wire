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
    <section aria-labelledby="section-models-title" className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 space-y-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shadow-2xs shrink-0">
            <Layers className="w-4 h-4 text-zinc-700" aria-hidden="true" />
          </div>
          <div>
            <h2 id="section-models-title" className="text-base font-bold text-zinc-950">
              2. OpenRouter Model Fallback Chain & Token Budget
            </h2>
            <p className="text-xs text-zinc-500">Auto-failover order when primary provider is throttled or down</p>
          </div>
        </div>
        {!openRouterKey && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 text-xs text-zinc-700 font-mono transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 self-start sm:self-auto shadow-2xs"
          >
            <Key className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            Connect OpenRouter Key
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-600 leading-relaxed">
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
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                isSelected
                  ? 'border-zinc-950 bg-zinc-50 text-zinc-950 ring-1 ring-zinc-950 shadow-2xs'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 shadow-2xs'
              }`}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-zinc-900 truncate">{m.name}</span>
                  {isSelected && (
                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-zinc-950 text-white font-bold shadow-2xs">
                      #{rank + 1}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5">
                  {m.provider} • {m.context}
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                  isSelected ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-300 bg-zinc-50'
                }`}
                aria-hidden="true"
              >
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Max output tokens control */}
      <div className="pt-4 border-t border-zinc-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="text-zinc-600">
          <span className="font-semibold text-zinc-900">Max Output Tokens:</span>{' '}
          <span className="text-[11px] text-zinc-500">Limits credit reservation to avoid OpenRouter 402 on low balances</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono" role="group" aria-label="Max token limits">
          {[1024, 2048, 4096].map(limit => (
            <button
              key={limit}
              type="button"
              onClick={() => setMaxTokens?.(limit)}
              className={`px-3 py-1.5 rounded-full border text-[11px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                maxTokens === limit
                  ? 'border-zinc-900 bg-zinc-950 text-white font-medium shadow-2xs'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 shadow-2xs'
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

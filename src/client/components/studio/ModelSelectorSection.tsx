import React from 'react';
import { Layers, CheckCircle2, Key } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../../presets.ts';

interface ModelSelectorSectionProps {
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
}

export const ModelSelectorSection: React.FC<ModelSelectorSectionProps> = ({
  selectedModels,
  onToggleModel,
  openRouterKey,
  onOpenAuthModal
}) => {
  return (
    <section aria-labelledby="section-models-title" className="rounded-2xl border border-white/10 bg-[#0C0F17] p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Layers className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <h2 id="section-models-title" className="text-sm font-semibold text-white">
            2. OpenRouter Model Fallback Chain
          </h2>
        </div>
        {!openRouterKey && (
          <button
            type="button"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-mono underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded self-start sm:self-auto"
          >
            <Key className="w-3.5 h-3.5" aria-hidden="true" />
            Connect OpenRouter Key
          </button>
        )}
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
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
              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isSelected
                  ? 'border-indigo-500/50 bg-indigo-950/20 text-white shadow-sm'
                  : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20'
              }`}
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white truncate">{m.name}</span>
                  {isSelected && (
                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 border border-indigo-500/40">
                      #{rank + 1}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {m.provider} • {m.context}
                </div>
              </div>
              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                  isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                }`}
                aria-hidden="true"
              >
                {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

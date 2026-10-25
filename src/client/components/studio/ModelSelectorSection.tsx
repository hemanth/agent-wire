import React from 'react';
import { Layers, CheckCircle2, Key, ShieldCheck, Braces, Sparkles } from 'lucide-react';
import { AVAILABLE_MODELS } from '../../../presets.ts';
import { AgentGuardrails } from '../../../types.ts';

interface ModelSelectorSectionProps {
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
  maxTokens?: number;
  setMaxTokens?: (val: number) => void;
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high';
  setReasoningEffort?: (val: 'none' | 'low' | 'medium' | 'high') => void;
  responseFormat?: 'text' | 'json_object' | 'json_schema';
  setResponseFormat?: (val: 'text' | 'json_object' | 'json_schema') => void;
  guardrails?: AgentGuardrails;
  setGuardrails?: (val: AgentGuardrails) => void;
}

export const ModelSelectorSection: React.FC<ModelSelectorSectionProps> = ({
  selectedModels,
  onToggleModel,
  openRouterKey,
  onOpenAuthModal,
  maxTokens = 2048,
  setMaxTokens,
  reasoningEffort = 'medium',
  setReasoningEffort,
  responseFormat = 'text',
  setResponseFormat,
  guardrails = { blockPromptInjection: true, redactPii: true },
  setGuardrails
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
                <div className="text-[11px] text-zinc-500 font-mono mt-0.5 flex items-center gap-1.5">
                  <span>{m.provider} • {m.context}</span>
                  {(m as any).supportsReasoning && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-200/80 text-zinc-800 font-semibold">
                      CoT
                    </span>
                  )}
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

      {/* Modern AI Stack Controls: Reasoning Effort, Structured Output & Runtime Guardrails */}
      <div className="pt-4 border-t border-zinc-200/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* Reasoning Effort */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <Sparkles className="w-3.5 h-3.5 text-zinc-700" aria-hidden="true" />
            <span>Reasoning Effort</span>
          </div>
          <div className="flex flex-wrap gap-1 font-mono" role="group" aria-label="Reasoning effort">
            {(['none', 'low', 'medium', 'high'] as const).map(level => (
              <button
                key={level}
                type="button"
                onClick={() => setReasoningEffort?.(level)}
                className={`px-2.5 py-1 rounded-md border text-[11px] capitalize transition-all ${
                  reasoningEffort === level
                    ? 'border-zinc-950 bg-zinc-950 text-white font-semibold'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        {/* Structured Output Mode */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <Braces className="w-3.5 h-3.5 text-zinc-700" aria-hidden="true" />
            <span>Output Contract</span>
          </div>
          <div className="flex flex-wrap gap-1 font-mono" role="group" aria-label="Output format">
            {(
              [
                { id: 'text', label: 'Markdown / Text' },
                { id: 'json_object', label: 'Strict JSON' }
              ] as const
            ).map(fmt => (
              <button
                key={fmt.id}
                type="button"
                onClick={() => setResponseFormat?.(fmt.id)}
                className={`px-2.5 py-1 rounded-md border text-[11px] transition-all ${
                  responseFormat === fmt.id
                    ? 'border-zinc-950 bg-zinc-950 text-white font-semibold'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {fmt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Runtime Guardrails */}
        <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" aria-hidden="true" />
            <span>Safety Guardrails</span>
          </div>
          <div className="flex flex-wrap gap-2 font-mono">
            <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={guardrails.blockPromptInjection ?? true}
                onChange={e =>
                  setGuardrails?.({ ...guardrails, blockPromptInjection: e.target.checked })
                }
                className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-500"
              />
              <span>Injection Shield</span>
            </label>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={guardrails.redactPii ?? true}
                onChange={e =>
                  setGuardrails?.({ ...guardrails, redactPii: e.target.checked })
                }
                className="rounded border-zinc-300 text-zinc-950 focus:ring-zinc-500"
              />
              <span>PII Redaction</span>
            </label>
          </div>
        </div>
      </div>
    </section>
  );
};

import React from 'react';
import { Sparkles } from 'lucide-react';

interface TemplateBarProps {
  onSelectTemplate: (index: number) => void;
}

export const TemplateBar: React.FC<TemplateBarProps> = ({ onSelectTemplate }) => {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Template quick starters">
      <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-indigo-400" aria-hidden="true" />
        Templates:
      </span>
      <button
        type="button"
        onClick={() => onSelectTemplate(0)}
        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-500 text-xs text-slate-300 hover:text-white border border-white/10 font-mono transition-colors"
      >
        Taste Critic
      </button>
      <button
        type="button"
        onClick={() => onSelectTemplate(1)}
        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-500 text-xs text-slate-300 hover:text-white border border-white/10 font-mono transition-colors"
      >
        PR Triager
      </button>
    </div>
  );
};

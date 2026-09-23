import React from 'react';
import { LayoutTemplate } from 'lucide-react';

interface TemplateBarProps {
  onSelectTemplate: (index: number) => void;
}

export const TemplateBar: React.FC<TemplateBarProps> = ({ onSelectTemplate }) => {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Template quick starters">
      <span className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
        <LayoutTemplate className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
        Presets:
      </span>
      <button
        type="button"
        onClick={() => onSelectTemplate(0)}
        className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 text-xs text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 font-mono transition-colors"
      >
        Taste Critic
      </button>
      <button
        type="button"
        onClick={() => onSelectTemplate(1)}
        className="px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 text-xs text-zinc-300 hover:text-zinc-100 border border-zinc-800 hover:border-zinc-700 font-mono transition-colors"
      >
        PR Triager
      </button>
    </div>
  );
};

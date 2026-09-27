import React from 'react';
import { LayoutTemplate } from 'lucide-react';

interface TemplateBarProps {
  onSelectTemplate: (index: number) => void;
}

export const TemplateBar: React.FC<TemplateBarProps> = ({ onSelectTemplate }) => {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Template quick starters">
      <span className="text-xs font-mono text-zinc-500 flex items-center gap-1.5">
        <LayoutTemplate className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
        Presets:
      </span>
      <button
        type="button"
        onClick={() => onSelectTemplate(0)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 text-xs text-zinc-800 hover:text-zinc-950 border border-zinc-200 shadow-2xs font-mono font-medium transition-all active:scale-[0.98]"
      >
        Taste Critic
      </button>
      <button
        type="button"
        onClick={() => onSelectTemplate(1)}
        className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 text-xs text-zinc-800 hover:text-zinc-950 border border-zinc-200 shadow-2xs font-mono font-medium transition-all active:scale-[0.98]"
      >
        PR Triager
      </button>
    </div>
  );
};

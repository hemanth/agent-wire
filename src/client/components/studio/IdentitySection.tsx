import React from 'react';
import { Bot, Globe, Lock } from 'lucide-react';

interface IdentitySectionProps {
  name: string;
  setName: (val: string) => void;
  slug: string;
  setSlug: (val: string) => void;
  tagline: string;
  setTagline: (val: string) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
  visibility: 'public' | 'private';
  setVisibility: (val: 'public' | 'private') => void;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  name,
  setName,
  slug,
  setSlug,
  tagline,
  setTagline,
  systemPrompt,
  setSystemPrompt,
  visibility,
  setVisibility
}) => {
  return (
    <section aria-labelledby="section-identity-title" className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 space-y-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shadow-2xs shrink-0">
            <Bot className="w-4 h-4 text-zinc-700" aria-hidden="true" />
          </div>
          <div>
            <h2 id="section-identity-title" className="text-base font-bold text-zinc-950">
              1. Identity & System Persona
            </h2>
            <p className="text-xs text-zinc-500">Define agent name, edge slug, and access permissions</p>
          </div>
        </div>

        {/* Permissions & Visibility Toggle */}
        <div className="flex items-center bg-zinc-100/90 p-1 rounded-full border border-zinc-200/80 shadow-2xs text-xs font-medium self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
              visibility === 'public'
                ? 'bg-white text-zinc-950 border border-zinc-200 shadow-2xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
            <span>Public URL</span>
          </button>
          <button
            type="button"
            onClick={() => setVisibility('private')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
              visibility === 'private'
                ? 'bg-white text-zinc-950 border border-zinc-200 shadow-2xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-950'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            <span>Private (Key Required)</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="agent-name" className="block text-xs font-mono text-zinc-700 font-medium mb-1.5">
            Agent Name <span className="text-rose-500" aria-hidden="true">*</span>
          </label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Taste & Design Critic"
            className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs transition-all"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="agent-slug" className="block text-xs font-mono text-zinc-700 font-medium mb-1.5">
            Slug / URL Identifier
          </label>
          <input
            id="agent-slug"
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="taste-critic"
            className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 font-mono focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs transition-all"
          />
        </div>
      </div>

      <div>
        <label htmlFor="agent-tagline" className="block text-xs font-mono text-zinc-700 font-medium mb-1.5">
          Tagline / One-Liner Mission
        </label>
        <input
          id="agent-tagline"
          type="text"
          value={tagline}
          onChange={e => setTagline(e.target.value)}
          placeholder="Briefly describe what this agent executes..."
          className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs transition-all"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="agent-system-prompt" className="block text-xs font-mono text-zinc-700 font-medium">
            System Instructions (Persona & Execution Guardrails) <span className="text-rose-500" aria-hidden="true">*</span>
          </label>
          <span className="text-[11px] font-mono text-zinc-500">
            {systemPrompt.length} chars
          </span>
        </div>
        <textarea
          id="agent-system-prompt"
          rows={5}
          value={systemPrompt}
          onChange={e => setSystemPrompt(e.target.value)}
          placeholder="Provide system prompt instructions..."
          className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 p-3.5 text-xs text-zinc-900 font-mono placeholder-zinc-400 leading-relaxed focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 shadow-2xs transition-all"
          required
          aria-required="true"
        />
      </div>
    </section>
  );
};

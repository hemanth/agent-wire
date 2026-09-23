import React from 'react';
import { Bot } from 'lucide-react';

interface IdentitySectionProps {
  name: string;
  setName: (val: string) => void;
  slug: string;
  setSlug: (val: string) => void;
  tagline: string;
  setTagline: (val: string) => void;
  systemPrompt: string;
  setSystemPrompt: (val: string) => void;
}

export const IdentitySection: React.FC<IdentitySectionProps> = ({
  name,
  setName,
  slug,
  setSlug,
  tagline,
  setTagline,
  systemPrompt,
  setSystemPrompt
}) => {
  return (
    <section aria-labelledby="section-identity-title" className="rounded-xl border border-zinc-800 bg-[#111113] p-5 sm:p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
        <Bot className="w-4 h-4 text-zinc-400" aria-hidden="true" />
        <h2 id="section-identity-title" className="text-sm font-medium text-zinc-200">
          1. Identity & System Persona
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="agent-name" className="block text-xs font-mono text-zinc-400 mb-1.5">
            Agent Name <span className="text-red-400" aria-hidden="true">*</span>
          </label>
          <input
            id="agent-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Taste & Design Critic"
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400"
            required
            aria-required="true"
          />
        </div>
        <div>
          <label htmlFor="agent-slug" className="block text-xs font-mono text-zinc-400 mb-1.5">
            Slug / URL Identifier
          </label>
          <input
            id="agent-slug"
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="taste-critic"
            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400"
          />
        </div>
      </div>

      <div>
        <label htmlFor="agent-tagline" className="block text-xs font-mono text-zinc-400 mb-1.5">
          Tagline / One-Liner Mission
        </label>
        <input
          id="agent-tagline"
          type="text"
          value={tagline}
          onChange={e => setTagline(e.target.value)}
          placeholder="Briefly describe what this agent executes..."
          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="agent-system-prompt" className="block text-xs font-mono text-zinc-400">
            System Instructions (Persona & Execution Guardrails) <span className="text-red-400" aria-hidden="true">*</span>
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
          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 p-3.5 text-xs text-zinc-200 font-mono placeholder-zinc-600 leading-relaxed focus:outline-none focus:border-zinc-600 focus-visible:ring-1 focus-visible:ring-zinc-400"
          required
          aria-required="true"
        />
      </div>
    </section>
  );
};

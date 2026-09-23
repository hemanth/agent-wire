import React from 'react';
import { BookOpen } from 'lucide-react';
import { AttachedSkill } from '../../../types.ts';

interface SkillsSectionProps {
  skills: AttachedSkill[];
  onToggleSkill: (id: string) => void;
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ skills, onToggleSkill }) => {
  const activeCount = skills.filter(s => s.enabled).length;

  return (
    <section aria-labelledby="section-skills-title" className="rounded-xl border border-zinc-800 bg-[#111113] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <BookOpen className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          <h2 id="section-skills-title" className="text-sm font-medium text-zinc-200">
            4. Attached Skills (SKILL.md Standards)
          </h2>
        </div>
        <span className="text-xs text-zinc-400 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
          {activeCount} of {skills.length} Enabled
        </span>
      </div>

      <p className="text-xs text-zinc-400">
        Skills inject structured procedural guidelines and domain constraints directly into the agent's context window.
      </p>

      <div className="space-y-3" role="group" aria-label="Available skill standards">
        {skills.map(skill => {
          const titleId = `skill-title-${skill.id}`;
          const descId = `skill-desc-${skill.id}`;

          return (
            <div
              key={skill.id}
              onClick={() => onToggleSkill(skill.id)}
              onKeyDown={e => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  onToggleSkill(skill.id);
                }
              }}
              role="switch"
              aria-checked={skill.enabled}
              aria-labelledby={titleId}
              aria-describedby={descId}
              tabIndex={0}
              className={`p-4 rounded-lg border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                skill.enabled
                  ? 'border-zinc-700 bg-zinc-900/60'
                  : 'border-zinc-800/80 bg-zinc-950 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span id={titleId} className="font-medium text-xs text-zinc-200">
                    {skill.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded">
                    {skill.id}
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${
                    skill.enabled ? 'bg-zinc-200' : 'bg-zinc-800'
                  }`}
                  aria-hidden="true"
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform ${
                      skill.enabled ? 'translate-x-4 bg-zinc-950' : 'translate-x-0 bg-zinc-500'
                    }`}
                  />
                </div>
              </div>
              <p id={descId} className="text-xs text-zinc-400 leading-relaxed">
                {skill.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

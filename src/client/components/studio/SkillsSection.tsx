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
    <section aria-labelledby="section-skills-title" className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 space-y-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shadow-2xs shrink-0">
            <BookOpen className="w-4 h-4 text-zinc-700" aria-hidden="true" />
          </div>
          <div>
            <h2 id="section-skills-title" className="text-base font-bold text-zinc-950">
              4. Attached Skills (SKILL.md Standards)
            </h2>
            <p className="text-xs text-zinc-500">Inject declarative engineering constraints into context</p>
          </div>
        </div>
        <span className="text-xs text-zinc-700 font-mono bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200 font-semibold">
          {activeCount} of {skills.length} Enabled
        </span>
      </div>

      <p className="text-xs text-zinc-600 leading-relaxed">
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
              className={`p-4 rounded-xl border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                skill.enabled
                  ? 'border-zinc-900 bg-zinc-50 shadow-2xs'
                  : 'border-zinc-200 bg-white opacity-70 hover:opacity-100 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span id={titleId} className={`font-semibold text-xs ${skill.enabled ? 'text-zinc-950' : 'text-zinc-700'}`}>
                    {skill.name}
                  </span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    skill.enabled
                      ? 'text-zinc-900 bg-white border-zinc-300 font-medium shadow-2xs'
                      : 'text-zinc-500 bg-zinc-100 border-zinc-200'
                  }`}>
                    {skill.id}
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${
                    skill.enabled ? 'bg-zinc-950' : 'bg-zinc-200'
                  }`}
                  aria-hidden="true"
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-transform bg-white shadow-xs ${
                      skill.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
              <p id={descId} className={`text-xs leading-relaxed ${skill.enabled ? 'text-zinc-700' : 'text-zinc-500'}`}>
                {skill.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

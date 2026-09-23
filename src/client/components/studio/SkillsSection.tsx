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
    <section aria-labelledby="section-skills-title" className="rounded-2xl border border-white/10 bg-[#0C0F17] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <BookOpen className="w-4 h-4 text-indigo-400" aria-hidden="true" />
          <h2 id="section-skills-title" className="text-sm font-semibold text-white">
            4. Attached Skills (SKILL.md Standards)
          </h2>
        </div>
        <span className="text-xs text-slate-300 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
          {activeCount} of {skills.length} Enabled
        </span>
      </div>

      <p className="text-xs text-slate-400">
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
              className={`p-4 rounded-xl border cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                skill.enabled
                  ? 'border-indigo-500/50 bg-indigo-950/20'
                  : 'border-white/10 bg-black/20 opacity-60 hover:opacity-90'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span id={titleId} className="font-semibold text-xs text-white">
                    {skill.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.2 rounded">
                    {skill.id}
                  </span>
                </div>
                <div
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors relative ${
                    skill.enabled ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                  aria-hidden="true"
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skill.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
              <p id={descId} className="text-xs text-slate-400 leading-relaxed">
                {skill.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};

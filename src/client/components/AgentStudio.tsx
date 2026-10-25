import React, { useState } from 'react';
import { Agent, AgentGuardrails, AttachedSkill, McpConnector } from '../../types.ts';
import { BUILTIN_SKILLS, PRESET_MCPS } from '../../presets.ts';
import { TemplateBar } from './studio/TemplateBar.tsx';
import { IdentitySection } from './studio/IdentitySection.tsx';
import { ModelSelectorSection } from './studio/ModelSelectorSection.tsx';
import { McpConnectorsSection } from './studio/McpConnectorsSection.tsx';
import { SkillsSection } from './studio/SkillsSection.tsx';
import { DeployStatusBar } from './studio/DeployStatusBar.tsx';

interface AgentStudioProps {
  onDeploySuccess: (agent: Agent) => void;
  openRouterKey: string | null;
  onOpenAuthModal: () => void;
}

export const AgentStudio: React.FC<AgentStudioProps> = ({
  onDeploySuccess,
  openRouterKey,
  onOpenAuthModal
}) => {
  const [name, setName] = useState('Taste & UI Critic');
  const [slug, setSlug] = useState('taste-critic');
  const [tagline, setTagline] = useState('Enforces Taste Skill design standards and generates Stitch UI layouts');
  const [systemPrompt, setSystemPrompt] = useState(
    `You are an elite Design Critic and Frontend Architect. Your job is to review proposed UI designs, components, or screens.\nYou strictly enforce high contrast, typographic hierarchy, responsive spacing, and elimination of AI-slop tropes (like gradient text, excessive cards, and bloated eyebrows).\nWhen relevant, call the Stitch MCP tools to inspect or generate alternative design screens.`
  );

  const [selectedModels, setSelectedModels] = useState<string[]>([
    'anthropic/claude-sonnet-4',
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.5-pro'
  ]);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [reasoningEffort, setReasoningEffort] = useState<'none' | 'low' | 'medium' | 'high'>('medium');
  const [responseFormat, setResponseFormat] = useState<'text' | 'json_object' | 'json_schema'>('text');
  const [guardrails, setGuardrails] = useState<AgentGuardrails>({
    blockPromptInjection: true,
    redactPii: true
  });

  const [mcps, setMcps] = useState<McpConnector[]>([PRESET_MCPS[0]]);
  const [probingMcpId, setProbingMcpId] = useState<string | null>(null);
  const [skills, setSkills] = useState<AttachedSkill[]>(BUILTIN_SKILLS);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      if (!prev.includes(modelId)) {
        return [...prev, modelId];
      }
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter(m => m !== modelId);
    });
  };

  const probeMcp = async (id: string, url: string) => {
    setProbingMcpId(id);
    try {
      const res = await fetch('/api/mcp/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setMcps(prev => prev.map(m => m.id === id ? { ...m, status: data.success ? 'connected' : 'error', tools: data.tools || m.tools || [], errorMessage: data.error } : m));
    } catch (err: any) {
      setMcps(prev => prev.map(m => (m.id === id ? { ...m, status: 'error', errorMessage: err.message } : m)));
    } finally {
      setProbingMcpId(null);
    }
  };

  const loadTemplate = (presetIndex: number) => {
    if (presetIndex === 0) {
      setName('Taste & UI Critic');
      setSlug('taste-critic');
      setTagline('Audits UI implementations against Taste Skill design standards');
      setSystemPrompt(
        `You are an elite Design Critic and Frontend Architect. Your job is to review proposed UI designs, components, or screens.\nYou strictly enforce high contrast, typographic hierarchy, responsive spacing, and elimination of AI-slop tropes.\nWhen relevant, call the Stitch MCP tools to inspect or generate alternative design screens.`
      );
      setMcps([PRESET_MCPS[0]]);
      setSkills(BUILTIN_SKILLS.map(s => ({ ...s, enabled: s.id === 'taste-skill' })));
    } else if (presetIndex === 1) {
      setName('GitHub PR & Issue Triager');
      setSlug('pr-triager');
      setTagline('Automates bug reproduction checks and security diff analysis');
      setSystemPrompt(
        `You are an autonomous engineering triage assistant.\nWhen given an issue or PR task, you query the GitHub MCP tools to fetch the issue details, examine the diff, check for security regressions, and propose actionable next steps.`
      );
      setMcps([PRESET_MCPS[1]]);
      setSkills(BUILTIN_SKILLS.map(s => ({ ...s, enabled: s.id === 'code-review-and-quality' })));
    }
  };

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || deploying) return;

    setDeploying(true);
    setError(null);

    try {
      const payload: Partial<Agent> = {
        name: name.trim(),
        slug: slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        tagline: tagline.trim(),
        systemPrompt: systemPrompt.trim(),
        models: selectedModels,
        temperature: 0.3,
        maxTokens,
        reasoningEffort,
        responseFormat,
        guardrails,
        mcps,
        skills,
        visibility,
        openRouterKey: openRouterKey || undefined
      };

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Failed to deploy: ${res.statusText}`);
      }

      const data = await res.json();
      onDeploySuccess(data.agent);
    } catch (err: any) {
      setError(err.message || 'Deploy failed');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200/80">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950 tracking-tight flex items-center gap-2.5">
            Agent Studio
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 font-semibold">
              Edge Deployer
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-zinc-600 mt-1">
            Configure persona, remote MCP tools, and skills, then click deploy to generate a live curlable REST endpoint.
          </p>
        </div>
        <TemplateBar onSelectTemplate={loadTemplate} />
      </div>

      <form onSubmit={handleDeploy} className="space-y-8">
        <IdentitySection
          name={name}
          setName={setName}
          slug={slug}
          setSlug={setSlug}
          tagline={tagline}
          setTagline={setTagline}
          systemPrompt={systemPrompt}
          setSystemPrompt={setSystemPrompt}
          visibility={visibility}
          setVisibility={setVisibility}
        />

        <ModelSelectorSection
          selectedModels={selectedModels}
          onToggleModel={toggleModel}
          openRouterKey={openRouterKey}
          onOpenAuthModal={onOpenAuthModal}
          maxTokens={maxTokens}
          setMaxTokens={setMaxTokens}
          reasoningEffort={reasoningEffort}
          setReasoningEffort={setReasoningEffort}
          responseFormat={responseFormat}
          setResponseFormat={setResponseFormat}
          guardrails={guardrails}
          setGuardrails={setGuardrails}
        />

        <McpConnectorsSection
          mcps={mcps}
          onAddMcp={conn => setMcps(prev => [...prev, conn])}
          onRemoveMcp={id => setMcps(prev => prev.filter(m => m.id !== id))}
          onProbeMcp={probeMcp}
          probingMcpId={probingMcpId}
        />

        <SkillsSection
          skills={skills}
          onToggleSkill={id => setSkills(prev => prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s)))}
        />

        <DeployStatusBar
          deploying={deploying}
          canDeploy={Boolean(name.trim())}
          error={error}
        />
      </form>
    </div>
  );
};

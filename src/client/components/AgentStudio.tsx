import React, { useState } from 'react';
import { Bot, Sparkles, Wrench, BookOpen, Layers, Plus, Trash2, CheckCircle2, AlertCircle, RefreshCw, Terminal, ArrowRight, Shield } from 'lucide-react';
import { Agent, AttachedSkill, McpConnector, McpTool } from '../../types.ts';
import { AVAILABLE_MODELS, BUILTIN_SKILLS, PRESET_MCPS } from '../../presets.ts';

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
  // Form State
  const [name, setName] = useState('Taste & UI Critic');
  const [slug, setSlug] = useState('taste-critic');
  const [tagline, setTagline] = useState('Enforces Taste Skill design standards and generates Stitch UI layouts');
  const [systemPrompt, setSystemPrompt] = useState(`You are an elite Design Critic and Frontend Architect. Your job is to review proposed UI designs, components, or screens.
You strictly enforce high contrast, typographic hierarchy, responsive spacing, and elimination of AI-slop tropes (like gradient text, excessive cards, and bloated eyebrows).
When relevant, call the Stitch MCP tools to inspect or generate alternative design screens.`);

  // Models Selection (Ordered list for fallback)
  const [selectedModels, setSelectedModels] = useState<string[]>([
    'anthropic/claude-3.5-sonnet',
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct'
  ]);

  // MCP Connectors
  const [mcps, setMcps] = useState<McpConnector[]>([PRESET_MCPS[0]]);
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpName, setNewMcpName] = useState('');
  const [probingMcpId, setProbingMcpId] = useState<string | null>(null);

  // Attached Skills
  const [skills, setSkills] = useState<AttachedSkill[]>(BUILTIN_SKILLS);

  // Deploy status
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toggle model selection
  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      if (selectedModels.length > 1) {
        setSelectedModels(selectedModels.filter(m => m !== modelId));
      }
    } else {
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  // Add MCP Server
  const handleAddMcp = () => {
    if (!newMcpUrl.trim()) return;
    const connector: McpConnector = {
      id: `mcp_${Date.now()}`,
      name: newMcpName.trim() || `MCP Server (${new URL(newMcpUrl).hostname})`,
      url: newMcpUrl.trim(),
      type: newMcpUrl.includes('/sse') ? 'sse' : 'http',
      status: 'unknown',
      tools: []
    };
    setMcps([...mcps, connector]);
    setNewMcpUrl('');
    setNewMcpName('');
    probeMcp(connector.id, connector.url);
  };

  // Add Preset MCP
  const handleAddPresetMcp = (preset: McpConnector) => {
    if (!mcps.some(m => m.id === preset.id || m.url === preset.url)) {
      setMcps([...mcps, preset]);
    }
  };

  // Live probe MCP Server
  const probeMcp = async (id: string, url: string) => {
    setProbingMcpId(id);
    try {
      const res = await fetch('/api/mcp/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      setMcps(prev => prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            status: data.success ? 'connected' : 'error',
            tools: data.tools || m.tools || [],
            errorMessage: data.error
          };
        }
        return m;
      }));
    } catch (err: any) {
      setMcps(prev => prev.map(m => m.id === id ? { ...m, status: 'error', errorMessage: err.message } : m));
    } finally {
      setProbingMcpId(null);
    }
  };

  // Remove MCP
  const removeMcp = (id: string) => {
    setMcps(mcps.filter(m => m.id !== id));
  };

  // Toggle Skill
  const toggleSkill = (id: string) => {
    setSkills(skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  // Template loaders
  const loadTemplate = (presetIndex: number) => {
    if (presetIndex === 0) {
      setName('Taste & UI Critic');
      setSlug('taste-critic');
      setTagline('Audits UI implementations against Taste Skill design standards');
      setSystemPrompt(`You are an elite Design Critic and Frontend Architect. Your job is to review proposed UI designs, components, or screens.
You strictly enforce high contrast, typographic hierarchy, responsive spacing, and elimination of AI-slop tropes.
When relevant, call the Stitch MCP tools to inspect or generate alternative design screens.`);
      setMcps([PRESET_MCPS[0]]);
      setSkills(BUILTIN_SKILLS.map(s => ({ ...s, enabled: s.id === 'taste-skill' })));
    } else if (presetIndex === 1) {
      setName('GitHub PR & Issue Triager');
      setSlug('pr-triager');
      setTagline('Automates bug reproduction checks and security diff analysis');
      setSystemPrompt(`You are an autonomous engineering triage assistant.
When given an issue or PR task, you query the GitHub MCP tools to fetch the issue details, examine the diff, check for security regressions, and propose actionable next steps.`);
      setMcps([PRESET_MCPS[1]]);
      setSkills(BUILTIN_SKILLS.map(s => ({ ...s, enabled: s.id === 'code-review-and-quality' })));
    }
  };

  // Submit & Deploy
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
        mcps,
        skills,
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Agent Studio
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Edge Deployer
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure persona, remote MCP tools, and skills, then click deploy to generate a live curlable REST endpoint.
          </p>
        </div>

        {/* Template Quick Starters */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-slate-500">Quick Starters:</span>
          <button
            type="button"
            onClick={() => loadTemplate(0)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white border border-white/10 font-mono transition-colors"
          >
            Taste Critic
          </button>
          <button
            type="button"
            onClick={() => loadTemplate(1)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white border border-white/10 font-mono transition-colors"
          >
            PR Triager
          </button>
        </div>
      </div>

      <form onSubmit={handleDeploy} className="space-y-8">
        
        {/* Section 1: Identity & Persona */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0F17] p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="w-4 h-4 text-indigo-400" />
            1. Identity & System Persona
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Taste & Design Critic"
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5">Slug / Identifier</label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="taste-critic"
                className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">Tagline / Mission</label>
            <input
              type="text"
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="What does this agent do?"
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1.5">
              System Instructions (Persona & Execution Guardrails)
            </label>
            <textarea
              rows={5}
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="Provide system prompt instructions..."
              className="w-full rounded-xl bg-black/40 border border-white/10 p-3.5 text-xs text-slate-200 font-mono placeholder-slate-500 leading-relaxed focus:outline-none focus:border-indigo-500/50"
              required
            />
          </div>
        </div>

        {/* Section 2: OpenRouter Models & Auto-Failover */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0F17] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Layers className="w-4 h-4 text-indigo-400" />
              2. OpenRouter Model Fallback Chain
            </div>
            {!openRouterKey && (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono underline"
              >
                Connect OpenRouter Key
              </button>
            )}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Select models in priority order. OpenRouter automatically fails over to the next model in the array if the primary model is unavailable or rate-limited.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_MODELS.map(m => {
              const isSelected = selectedModels.includes(m.id);
              const rank = selectedModels.indexOf(m.id);

              return (
                <div
                  key={m.id}
                  onClick={() => toggleModel(m.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-indigo-500/50 bg-indigo-950/20 text-white'
                      : 'border-white/10 bg-black/20 text-slate-400 hover:border-white/20'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-white truncate">{m.name}</span>
                      {isSelected && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-200">
                          #{rank + 1}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {m.provider} • {m.context}
                    </div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-slate-600'
                  }`}>
                    {isSelected && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Connectors to Remote MCPs */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0F17] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Wrench className="w-4 h-4 text-amber-400" />
              3. Connectors to Model Context Protocol (MCP) Servers
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {mcps.length} Connected
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Attach remote MCP servers (SSE or HTTP endpoints). The agent dynamically discovers tools via <code className="font-mono text-slate-300">tools/list</code> and executes them via <code className="font-mono text-slate-300">tools/call</code>.
          </p>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-mono text-slate-500">Presets:</span>
            {PRESET_MCPS.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleAddPresetMcp(p)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-slate-300 font-mono border border-white/10 transition-colors"
              >
                + {p.name}
              </button>
            ))}
          </div>

          {/* Connected MCP List */}
          <div className="space-y-3">
            {mcps.map(mcp => (
              <div key={mcp.id} className="p-3.5 rounded-xl border border-white/10 bg-black/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{mcp.name}</span>
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-slate-300 uppercase">
                      {mcp.type}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      mcp.status === 'connected' ? 'bg-emerald-400' : mcp.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                    }`} />
                  </div>
                  <div className="font-mono text-xs text-slate-400 truncate mt-0.5">
                    {mcp.url}
                  </div>
                  {mcp.tools && mcp.tools.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {mcp.tools.map((t, i) => (
                        <span key={i} className="px-2 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono" title={t.description}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {mcp.errorMessage && (
                    <div className="text-[11px] font-mono text-rose-400 mt-1">
                      {mcp.errorMessage}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => probeMcp(mcp.id, mcp.url)}
                    disabled={probingMcpId === mcp.id}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${probingMcpId === mcp.id ? 'animate-spin' : ''}`} />
                    Test Ping
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMcp(mcp.id)}
                    className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add custom MCP endpoint */}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              type="text"
              value={newMcpName}
              onChange={e => setNewMcpName(e.target.value)}
              placeholder="Server Name (optional)"
              className="sm:w-1/3 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
            <input
              type="url"
              value={newMcpUrl}
              onChange={e => setNewMcpUrl(e.target.value)}
              placeholder="Remote MCP Server URL (https://mcp.domain.com/sse or POST endpoint)"
              className="flex-1 rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
            <button
              type="button"
              onClick={handleAddMcp}
              disabled={!newMcpUrl.trim()}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-medium transition-colors"
            >
              Add Connector
            </button>
          </div>
        </div>

        {/* Section 4: Attached Skills */}
        <div className="rounded-2xl border border-white/10 bg-[#0C0F17] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <BookOpen className="w-4 h-4 text-indigo-400" />
              4. Attached Skills (SKILL.md Standards)
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {skills.filter(s => s.enabled).length} Enabled
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Skills inject structured, procedural domain instructions into the agent's context window.
          </p>

          <div className="space-y-3">
            {skills.map(skill => (
              <div
                key={skill.id}
                onClick={() => toggleSkill(skill.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  skill.enabled
                    ? 'border-indigo-500/50 bg-indigo-950/20'
                    : 'border-white/10 bg-black/20 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-white">{skill.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{skill.id}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={skill.enabled}
                    onChange={() => {}}
                    className="rounded border-white/20 text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{skill.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-4 border-t border-white/10">
          <div className="text-xs text-slate-500 font-mono">
            Output: <span className="text-slate-300">Permanent cURL Endpoint</span>
          </div>
          <button
            type="submit"
            disabled={deploying || !name.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-all shadow-xl shadow-indigo-600/30"
          >
            {deploying ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Deploying Agent...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Deploy Agent & Generate cURL
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

      </form>

    </div>
  );
};

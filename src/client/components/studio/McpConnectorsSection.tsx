import React, { useState } from 'react';
import { Wrench, Plus } from 'lucide-react';
import { McpConnector } from '../../../types.ts';
import { PRESET_MCPS } from '../../../presets.ts';
import { McpConnectorCard } from './McpConnectorCard.tsx';

interface McpConnectorsSectionProps {
  mcps: McpConnector[];
  onAddMcp: (connector: McpConnector) => void;
  onRemoveMcp: (id: string) => void;
  onProbeMcp: (id: string, url: string) => Promise<void>;
  probingMcpId: string | null;
}

export const McpConnectorsSection: React.FC<McpConnectorsSectionProps> = ({
  mcps,
  onAddMcp,
  onRemoveMcp,
  onProbeMcp,
  probingMcpId
}) => {
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpToken, setNewMcpToken] = useState('');

  const handleAddCustom = () => {
    if (!newMcpUrl.trim()) return;
    try {
      const parsed = new URL(newMcpUrl.trim());
      const connector: McpConnector = {
        id: `mcp_${Date.now()}`,
        name: newMcpName.trim() || `MCP (${parsed.hostname})`,
        url: newMcpUrl.trim(),
        type: newMcpUrl.includes('/sse') ? 'sse' : 'http',
        headers: newMcpToken.trim() ? { 'Authorization': newMcpToken.trim().startsWith('Bearer ') ? newMcpToken.trim() : `Bearer ${newMcpToken.trim()}` } : undefined,
        status: 'unknown',
        tools: []
      };
      onAddMcp(connector);
      setNewMcpUrl('');
      setNewMcpName('');
      setNewMcpToken('');
      onProbeMcp(connector.id, connector.url);
    } catch {
      alert('Please enter a valid URL (including https:// or http://)');
    }
  };

  const handleAddPreset = (preset: McpConnector) => {
    if (!mcps.some(m => m.id === preset.id || m.url === preset.url)) {
      onAddMcp(preset);
      onProbeMcp(preset.id, preset.url);
    }
  };

  return (
    <section aria-labelledby="section-mcp-title" className="rounded-2xl border border-zinc-200/80 bg-white/90 backdrop-blur-sm p-6 sm:p-7 space-y-5 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 border border-zinc-200/80 flex items-center justify-center text-zinc-700 shadow-2xs shrink-0">
            <Wrench className="w-4 h-4 text-zinc-700" aria-hidden="true" />
          </div>
          <div>
            <h2 id="section-mcp-title" className="text-base font-bold text-zinc-950">
              3. Connectors to Model Context Protocol (MCP) Servers
            </h2>
            <p className="text-xs text-zinc-500">Live SSE & HTTP tool protocol endpoints</p>
          </div>
        </div>
        <span className="text-xs text-zinc-700 font-mono bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200 font-semibold">
          {mcps.length} Connected
        </span>
      </div>

      <p className="text-xs text-zinc-600 leading-relaxed">
        Attach remote MCP servers (SSE or HTTP endpoints). The agent dynamically discovers tools via <code className="font-mono text-zinc-900 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">tools/list</code> and executes them via <code className="font-mono text-zinc-900 bg-zinc-100 border border-zinc-200 px-1.5 py-0.5 rounded">tools/call</code>.
      </p>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="MCP server presets">
        <span className="text-xs font-mono text-zinc-500">Presets:</span>
        {PRESET_MCPS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleAddPreset(p)}
            className="px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 text-xs text-zinc-800 font-mono border border-zinc-200 hover:border-zinc-300 shadow-2xs transition-all active:scale-[0.98]"
          >
            + {p.name}
          </button>
        ))}
      </div>

      {/* Connected MCP List */}
      <div className="space-y-3" role="list" aria-label="Connected MCP servers">
        {mcps.map(mcp => (
          <McpConnectorCard
            key={mcp.id}
            mcp={mcp}
            isProbing={probingMcpId === mcp.id}
            onProbe={onProbeMcp}
            onRemove={onRemoveMcp}
          />
        ))}
      </div>

      {/* Add custom MCP endpoint */}
      <div className="pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          <div className="sm:col-span-3">
            <label htmlFor="custom-mcp-name" className="sr-only">Server Name</label>
            <input
              id="custom-mcp-name"
              type="text"
              value={newMcpName}
              onChange={e => setNewMcpName(e.target.value)}
              placeholder="Name (optional)"
              className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 font-mono shadow-2xs transition-all"
            />
          </div>
          <div className="sm:col-span-5">
            <label htmlFor="custom-mcp-url" className="sr-only">Remote MCP Server URL</label>
            <input
              id="custom-mcp-url"
              type="url"
              value={newMcpUrl}
              onChange={e => setNewMcpUrl(e.target.value)}
              placeholder="Remote MCP URL (https://...)"
              className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 font-mono shadow-2xs transition-all"
            />
          </div>
          <div className="sm:col-span-3">
            <label htmlFor="custom-mcp-token" className="sr-only">Auth Bearer Token</label>
            <input
              id="custom-mcp-token"
              type="password"
              value={newMcpToken}
              onChange={e => setNewMcpToken(e.target.value)}
              placeholder="Bearer Token (optional)"
              className="w-full rounded-xl bg-zinc-50/60 border border-zinc-200 px-3 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-300 font-mono shadow-2xs transition-all"
            />
          </div>
          <div className="sm:col-span-1">
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!newMcpUrl.trim()}
              className="w-full h-full flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-zinc-950 hover:bg-black disabled:opacity-40 text-white border border-transparent text-xs font-medium transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

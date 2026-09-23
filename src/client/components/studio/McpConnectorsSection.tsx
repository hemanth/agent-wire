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

  const handleAddCustom = () => {
    if (!newMcpUrl.trim()) return;
    try {
      const parsed = new URL(newMcpUrl.trim());
      const connector: McpConnector = {
        id: `mcp_${Date.now()}`,
        name: newMcpName.trim() || `MCP (${parsed.hostname})`,
        url: newMcpUrl.trim(),
        type: newMcpUrl.includes('/sse') ? 'sse' : 'http',
        status: 'unknown',
        tools: []
      };
      onAddMcp(connector);
      setNewMcpUrl('');
      setNewMcpName('');
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
    <section aria-labelledby="section-mcp-title" className="rounded-2xl border border-white/10 bg-[#0C0F17] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Wrench className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <h2 id="section-mcp-title" className="text-sm font-semibold text-white">
            3. Connectors to Model Context Protocol (MCP) Servers
          </h2>
        </div>
        <span className="text-xs text-slate-300 font-mono bg-white/5 px-2 py-0.5 rounded border border-white/10">
          {mcps.length} Connected
        </span>
      </div>

      <p className="text-xs text-slate-400">
        Attach remote MCP servers (SSE or HTTP endpoints). The agent dynamically discovers tools via <code className="font-mono text-slate-300 bg-white/5 px-1 py-0.5 rounded">tools/list</code> and executes them via <code className="font-mono text-slate-300 bg-white/5 px-1 py-0.5 rounded">tools/call</code>.
      </p>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-1" role="group" aria-label="MCP server presets">
        <span className="text-[11px] font-mono text-slate-400">Presets:</span>
        {PRESET_MCPS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => handleAddPreset(p)}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-indigo-500 text-[11px] text-slate-300 font-mono border border-white/10 transition-colors"
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
          <div className="sm:col-span-4">
            <label htmlFor="custom-mcp-name" className="sr-only">Server Name</label>
            <input
              id="custom-mcp-name"
              type="text"
              value={newMcpName}
              onChange={e => setNewMcpName(e.target.value)}
              placeholder="Server Name (optional)"
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="custom-mcp-url" className="sr-only">Remote MCP Server URL</label>
            <input
              id="custom-mcp-url"
              type="url"
              value={newMcpUrl}
              onChange={e => setNewMcpUrl(e.target.value)}
              placeholder="Remote MCP URL (https://mcp.domain.com/sse or POST endpoint)"
              className="w-full rounded-xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 font-mono"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!newMcpUrl.trim()}
              className="w-full h-full flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              Add
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

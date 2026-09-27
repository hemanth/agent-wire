import React from 'react';
import { ExternalLink, Palette } from 'lucide-react';

export const PALETTE_TOKENS = [
  {
    name: 'Icy Blue',
    hex: '#A9DEF9',
    role: 'MCP Connectors',
    desc: 'Remote Model Context Protocol tool wiring (SSE/HTTP)'
  },
  {
    name: 'Mauve Lilac',
    hex: '#E4C1F9',
    role: 'Model Routing',
    desc: 'OpenRouter auto-failover (Claude, Gemini, Llama)'
  },
  {
    name: 'Vanilla Custard',
    hex: '#EDE7B1',
    role: 'Attached Skills',
    desc: 'SKILL.md domain guardrails & procedural standards'
  },
  {
    name: 'Frosted Mint',
    hex: '#D3F8E2',
    role: 'Edge Runtime',
    desc: 'Serverless execution with 0ms cold starts'
  },
  {
    name: 'Pink Mist',
    hex: '#F694C1',
    role: 'cURL Endpoint',
    desc: 'Public POST REST API accessible from any terminal'
  }
];

export const PaletteLegend: React.FC = () => {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 text-xs shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 text-zinc-800">
          <Palette className="w-4 h-4 text-zinc-600" aria-hidden="true" />
          <span className="font-bold text-xs text-zinc-950">
            System Architecture Color Map
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            via Coolors.co
          </span>
        </div>
        <a
          href="https://coolors.co/palette/d3f8e2-e4c1f9-f694c1-ede7b1-a9def9"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-zinc-600 hover:text-zinc-950 font-mono text-[11px] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 rounded"
        >
          <span>coolors.co/palette/d3f8e2-e4c1f9-f694c1-ede7b1-a9def9</span>
          <ExternalLink className="w-3 h-3 opacity-70" aria-hidden="true" />
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {PALETTE_TOKENS.map(token => (
          <div
            key={token.hex}
            className="p-3 rounded-xl border border-zinc-200/90 bg-white flex flex-col justify-between shadow-2xs hover:border-zinc-300 transition-all"
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 mb-1.5">
                <span className="font-semibold text-xs text-zinc-950 truncate">{token.role}</span>
                <div
                  className="w-2.5 h-2.5 rounded-full shadow-2xs shrink-0"
                  style={{ backgroundColor: token.hex }}
                  aria-hidden="true"
                />
              </div>
              <p className="text-[11px] text-zinc-500 leading-snug">
                {token.desc}
              </p>
            </div>
            <div className="mt-2.5 pt-1.5 border-t border-zinc-100 flex items-center justify-between text-[10px] font-mono text-zinc-400">
              <span>{token.name}</span>
              <span className="text-zinc-600 font-medium">{token.hex}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

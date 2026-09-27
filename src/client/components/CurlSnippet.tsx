import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { CodeBlock } from './CodeBlock';

interface CurlSnippetProps {
  agentId: string;
  agentName: string;
  origin?: string;
  task?: string;
  sessionId?: string;
  memory?: Record<string, any>;
}

export const CurlSnippet: React.FC<CurlSnippetProps> = ({
  agentId,
  agentName,
  origin = window.location.origin,
  task = 'Analyze this repository for security regressions and report findings.',
  sessionId,
  memory
}) => {
  const [copied, setCopied] = useState(false);
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python'>('curl');

  const endpointUrl = `${origin}/api/agents/${agentId}/run`;
  const hasMemory = memory && Object.keys(memory).length > 0;

  const sessionHeader = sessionId ? `  -H "X-Session-ID: ${sessionId}" \\\n` : '';
  const jsSessionHeader = sessionId ? `    "X-Session-ID": "${sessionId}",\n` : '';
  const pySessionHeader = sessionId ? `        "X-Session-ID": "${sessionId}",\n` : '';

  const bodyPayload: any = { task };
  if (sessionId) bodyPayload.sessionId = sessionId;
  if (hasMemory) bodyPayload.memory = memory;
  const jsonBodyString = JSON.stringify(bodyPayload, null, 2);

  const snippets = {
    curl: `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
${sessionHeader}  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \\
  -d '${JSON.stringify(bodyPayload)}'`,

    js: `const res = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
${jsSessionHeader}    "Authorization": "Bearer YOUR_OPENROUTER_KEY"
  },
  body: JSON.stringify(${jsonBodyString})
});
const data = await res.json();
console.log(data.result, data.steps);`,

    python: `import requests

res = requests.post(
    "${endpointUrl}",
    headers={
        "Content-Type": "application/json",
${pySessionHeader}        "Authorization": "Bearer YOUR_OPENROUTER_KEY"
    },
    json=${JSON.stringify(bodyPayload, null, 4)}
)
print(res.json()["result"])`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden text-xs font-mono shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-zinc-500 shrink-0" aria-hidden="true" />
          <span className="text-zinc-500 shrink-0 font-medium">Endpoint:</span>
          <span className="text-zinc-950 font-semibold truncate max-w-xs">{endpointUrl}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" role="tablist" aria-label="Code language snippets">
          {(['curl', 'js', 'python'] as const).map(lang => (
            <button
              key={lang}
              role="tab"
              aria-selected={activeLang === lang}
              onClick={() => setActiveLang(lang)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                activeLang === lang
                  ? 'bg-white text-zinc-950 border border-zinc-300 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {lang}
            </button>
          ))}
          <button
            onClick={handleCopy}
            aria-label={`Copy ${activeLang} snippet to clipboard`}
            className="flex items-center gap-1 ml-2 px-2.5 py-1 rounded-md bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-300 transition-colors shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                <span className="text-emerald-700 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-3.5 bg-[#0F172A] text-zinc-100 overflow-x-auto selection:bg-zinc-800 selection:text-white" tabIndex={0} aria-label={`${activeLang} code snippet`}>
        <CodeBlock code={snippets[activeLang]} language={activeLang} className="whitespace-pre text-xs" />
      </div>
    </div>
  );
};

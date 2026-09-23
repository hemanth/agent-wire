import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CurlSnippetProps {
  agentId: string;
  agentName: string;
  origin?: string;
  task?: string;
}

export const CurlSnippet: React.FC<CurlSnippetProps> = ({
  agentId,
  agentName,
  origin = window.location.origin,
  task = 'Analyze this repository for security regressions and report findings.'
}) => {
  const [copied, setCopied] = useState(false);
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python'>('curl');

  const endpointUrl = `${origin}/api/agents/${agentId}/run`;

  const snippets = {
    curl: `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \\
  -d '{"task": "${task}"}'`,

    js: `const res = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer YOUR_OPENROUTER_KEY"
  },
  body: JSON.stringify({
    task: "${task}"
  })
});
const data = await res.json();
console.log(data.result, data.steps);`,

    python: `import requests

res = requests.post(
    "${endpointUrl}",
    headers={
        "Content-Type": "application/json",
        "Authorization": "Bearer YOUR_OPENROUTER_KEY"
    },
    json={"task": "${task}"}
)
print(res.json()["result"])`
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden text-xs font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-hidden="true" />
          <span className="text-zinc-500 shrink-0">Endpoint:</span>
          <span className="text-zinc-200 font-medium truncate max-w-xs">{endpointUrl}</span>
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
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 font-medium'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {lang}
            </button>
          ))}
          <button
            onClick={handleCopy}
            aria-label={`Copy ${activeLang} snippet to clipboard`}
            className="flex items-center gap-1 ml-2 px-2.5 py-1 rounded-md bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3 text-zinc-400" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="p-3.5 text-zinc-300 overflow-x-auto selection:bg-zinc-800 selection:text-white" tabIndex={0} aria-label={`${activeLang} code snippet`}>
        <pre className="whitespace-pre font-mono leading-relaxed">{snippets[activeLang]}</pre>
      </div>
    </div>
  );
};

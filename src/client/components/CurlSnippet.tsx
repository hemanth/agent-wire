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
  task = "Analyze this repository for security regressions and report findings."
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
    <div className="rounded-xl border border-white/10 bg-[#06080D] overflow-hidden text-xs font-mono">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-slate-400">Endpoint:</span>
          <span className="text-indigo-300 font-semibold truncate max-w-xs">{endpointUrl}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {(['curl', 'js', 'python'] as const).map(lang => (
            <button
              key={lang}
              onClick={() => setActiveLang(lang)}
              className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors ${
                activeLang === lang
                  ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {lang}
            </button>
          ))}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 ml-2 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <div className="p-3 text-slate-300 overflow-x-auto selection:bg-indigo-500/30">
        <pre className="whitespace-pre">{snippets[activeLang]}</pre>
      </div>
    </div>
  );
};

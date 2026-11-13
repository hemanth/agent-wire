import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { CodeBlock } from './CodeBlock';
import { getPublicBaseUrl } from '../lib/runtime-init';

interface CurlSnippetProps {
  agentId: string;
  agentName: string;
  origin?: string;
  task?: string;
  sessionId?: string;
  userId?: string;
  memory?: Record<string, any>;
}

const LANGS = ['curl', 'js', 'python'] as const;

export const CurlSnippet: React.FC<CurlSnippetProps> = ({
  agentId,
  origin = getPublicBaseUrl(),
  task = 'Analyze this repository for security regressions and report findings.',
  sessionId,
  userId,
  memory
}) => {
  const [copied, setCopied] = useState(false);
  const [activeLang, setActiveLang] = useState<'curl' | 'js' | 'python'>('curl');

  const safeAgentId = encodeURIComponent(agentId.replace(/[^a-zA-Z0-9_-]/g, ''));
  const safeSessionId = sessionId ? sessionId.replace(/[^a-zA-Z0-9_:-]/g, '') : undefined;
  const safeUserId = userId ? userId.replace(/[^a-zA-Z0-9_.@:-]/g, '') : undefined;
  const endpointUrl = `${origin}/api/agents/${safeAgentId}/run`;
  const hasMemory = memory && Object.keys(memory).length > 0;

  const sessionHeader = safeUserId
    ? `  -H "X-User-ID: ${safeUserId}" \\\n`
    : safeSessionId
    ? `  -H "X-Session-ID: ${safeSessionId}" \\\n`
    : '';
  const jsSessionHeader = safeUserId
    ? `    "X-User-ID": "${safeUserId}",\n`
    : safeSessionId
    ? `    "X-Session-ID": "${safeSessionId}",\n`
    : '';
  const pySessionHeader = safeUserId
    ? `        "X-User-ID": "${safeUserId}",\n`
    : safeSessionId
    ? `        "X-Session-ID": "${safeSessionId}",\n`
    : '';

  const bodyPayload: any = { task };
  if (safeUserId) {
    bodyPayload.userId = safeUserId;
    if (hasMemory) bodyPayload.userMemory = memory;
  } else {
    if (safeSessionId) bodyPayload.sessionId = safeSessionId;
    if (hasMemory) bodyPayload.memory = memory;
  }
  const jsonBodyString = JSON.stringify(bodyPayload, null, 2);
  const shellSafePayload = JSON.stringify(bodyPayload).replace(/'/g, "'\\''");

  const snippets = {
    curl: `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
${sessionHeader}  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \\
  -d '${shellSafePayload}'`,

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

  const handleTabKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const nextIdx = e.key === 'ArrowRight' ? (idx + 1) % LANGS.length : (idx - 1 + LANGS.length) % LANGS.length;
      const nextLang = LANGS[nextIdx];
      setActiveLang(nextLang);
      document.getElementById(`snippet-tab-${nextLang}`)?.focus();
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden text-xs font-mono shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-zinc-200 bg-zinc-50">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="w-3.5 h-3.5 text-zinc-600 shrink-0" aria-hidden="true" />
          <span className="text-zinc-700 shrink-0 font-medium">Endpoint:</span>
          <span className="text-zinc-950 font-semibold truncate max-w-xs">{endpointUrl}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Code language snippets">
            {LANGS.map((lang, idx) => (
              <button
                key={lang}
                id={`snippet-tab-${lang}`}
                type="button"
                role="tab"
                aria-selected={activeLang === lang}
                aria-controls="snippet-tabpanel"
                onClick={() => setActiveLang(lang)}
                onKeyDown={e => handleTabKeyDown(e, idx)}
                className={`px-2 py-0.5 rounded text-[11px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                  activeLang === lang
                    ? 'bg-white text-zinc-950 border border-zinc-300 font-bold shadow-2xs'
                    : 'text-zinc-700 hover:text-zinc-950'
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
          <button
            type="button"
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
                <Copy className="w-3 h-3 text-zinc-600" aria-hidden="true" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div
        id="snippet-tabpanel"
        role="tabpanel"
        aria-labelledby={`snippet-tab-${activeLang}`}
        className="p-3.5 bg-[#0F172A] text-zinc-100 selection:bg-zinc-800 selection:text-white"
      >
        <CodeBlock code={snippets[activeLang]} language={activeLang} className="whitespace-pre text-xs" />
      </div>
    </div>
  );
};

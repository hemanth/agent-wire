// Subpath-aware fetch router (supports both root / and /ai/agent-wire/) + WebMCP registration + local key helper
declare global {
  interface Navigator {
    modelContext?: {
      registerTool?: (tool: {
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
        execute: (args: { agentId: string; input: string; sessionId?: string }) => Promise<unknown>;
      }) => void;
    };
  }
}

const AGENTWIRE_KEY_STORAGE = 'agentwire_live_api_key';

export function getBasePrefix(): string {
  if (typeof window === 'undefined') return '';
  return window.location.pathname.startsWith('/ai/agent-wire') ? '/ai/agent-wire' : '';
}

export function getPublicBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:8787';
  return `${window.location.origin}${getBasePrefix()}`;
}

export function getStoredWireApiKey(): string | null {
  try {
    return localStorage.getItem(AGENTWIRE_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredWireApiKey(key: string | null): void {
  try {
    if (key && key.trim()) {
      localStorage.setItem(AGENTWIRE_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(AGENTWIRE_KEY_STORAGE);
    }
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

(function initAgentWireRuntime() {
  if (typeof window === 'undefined') return;
  try {
    const basePrefix = getBasePrefix();
    if (basePrefix && typeof window.fetch === 'function') {
      const origFetch = window.fetch.bind(window);
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
        if (
          typeof input === 'string' &&
          /^\/(api\/|healthz\b|mcp\b|v1\/|\.well-known\/|openapi\.json|llms\.txt|llms-full\.txt|auth\.md|robots\.txt|index\.md)/.test(
            input
          )
        ) {
          return origFetch(basePrefix + input, init);
        }
        return origFetch(input, init);
      };
    }

    if (typeof navigator !== 'undefined' && navigator.modelContext && typeof navigator.modelContext.registerTool === 'function') {
      navigator.modelContext.registerTool({
        name: 'agentwire_run_agent',
        description: 'Execute a deployed AgentWire agent by ID with a prompt and optional sessionId.',
        inputSchema: {
          type: 'object',
          properties: {
            agentId: { type: 'string', description: 'Agent ID, e.g. agt_design_critic' },
            input: { type: 'string', description: 'Prompt or task payload' },
            sessionId: { type: 'string', description: 'Optional stateful session ID' }
          },
          required: ['agentId', 'input']
        },
        async execute(args) {
          const res = await window.fetch('/api/agents/' + encodeURIComponent(args.agentId) + '/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: args.input, sessionId: args.sessionId })
          });
          return await res.json();
        }
      });
    }
  } catch {
    // Non-fatal in non-browser or restricted environments
  }
})();

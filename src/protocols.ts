import type { Agent } from './types.ts';
import { BUILTIN_SKILLS } from './presets.ts';

export const AGENT_DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"',
  '</.well-known/agent-skills/index.json>; rel="service-desc"',
  '</.well-known/mcp/server-card.json>; rel="describedby"',
  '</.well-known/agent-card.json>; rel="describedby"',
  '</llms.txt>; rel="describedby"',
  '</.well-known/ai-catalog.json>; rel="ai-catalog"'
].join(', ');

export const CONTENT_SIGNAL_HEADER = 'ai-train=yes, search=yes, ai-input=yes';

export const AGENT_READY_HEADERS: Record<string, string> = {
  Link: AGENT_DISCOVERY_LINK_HEADER,
  'content-signal': CONTENT_SIGNAL_HEADER,
  Vary: 'Accept'
};

export function wantsMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader || !acceptHeader.includes('text/markdown')) return false;
  const parts = acceptHeader.split(',').map(p => p.trim());
  let mdQ = -1;
  let htmlQ = -1;
  for (const part of parts) {
    const [type, ...params] = part.split(';').map(s => s.trim());
    let q = 1.0;
    for (const param of params) {
      if (param.startsWith('q=')) q = parseFloat(param.slice(2)) || q;
    }
    if (type.toLowerCase() === 'text/markdown') mdQ = q;
    if (type.toLowerCase() === 'text/html') htmlQ = q;
  }
  return mdQ >= 0 && (htmlQ < 0 || mdQ >= htmlQ);
}

export async function sha256Hex(content: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function buildMarkdownOverview(origin: string, agents: Agent[]): string {
  const agentLines = agents
    .map(
      a =>
        `- **${a.name}** (\`${a.id}\`, slug: \`${a.slug}\`): ${a.tagline}\n  - Run Endpoint: \`POST ${origin}/api/agents/${a.id}/run\`\n  - A2A Card: \`GET ${origin}/api/agents/${a.id}/agent-card.json\`\n  - Eval Suite: \`POST ${origin}/api/agents/${a.id}/eval\`\n  - Models: ${a.models.map(m => `\`${m}\``).join(' -> ')}`
    )
    .join('\n');

  return `---
title: "AgentWire — Your Agent as a URL"
description: "Turn system personas, remote Model Context Protocol (MCP) connectors, and SKILL.md rules into curlable, A2A-compliant, and OpenAI-compatible serverless agent endpoints."
url: "${origin}/"
protocol_level: "Level 5: Agent-Native"
mcp_endpoint: "${origin}/mcp"
a2a_endpoint: "${origin}/api/a2a"
openai_compatible_base: "${origin}/v1"
---

# AgentWire — Your Agent as a URL

Turn prompts, remote MCP connectors, and \`SKILL.md\` engineering standards into curlable serverless agent endpoints supporting **MCP Streamable HTTP**, **Google A2A v1.0**, **OpenAI Chat Completions & Responses SDKs**, **SSE Streaming**, **Structured JSON Outputs**, **Reasoning Effort**, and **Automated Evals**.

## Active Agent Fleet

${agentLines}

## 1. Run Any Agent (JSON or SSE Stream)

\`\`\`bash
curl -X POST ${origin}/api/agents/agt_design_critic/run \\
  -H "Content-Type: application/json" \\
  -d '{
    "task": "Audit this hero button for WCAG AAA contrast and anti-slop rules",
    "reasoningEffort": "medium",
    "stream": false
  }'
\`\`\`

## 2. Native Model Context Protocol (MCP) Server

Connect Claude Desktop, Cursor, Windsurf, or any MCP client directly to \`${origin}/mcp\`:

\`\`\`bash
curl -X POST ${origin}/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}'
\`\`\`

## 3. Google Agent-to-Agent (A2A v1.0) Protocol

\`\`\`bash
curl -X POST ${origin}/api/a2a \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "task_1",
    "method": "tasks/send",
    "params": {
      "id": "a2a_task_01",
      "agentId": "agt_design_critic",
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "Audit our typography hierarchy"}]
      }
    }
  }'
\`\`\`

## 4. OpenAI SDK Drop-In Compatibility (\`/v1/chat/completions\` & \`/v1/responses\`)

\`\`\`bash
curl -X POST ${origin}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "agt_design_critic",
    "messages": [{"role": "user", "content": "Check contrast ratio requirements"}]
  }'
\`\`\`

## 5. Discovery Manifests

- API Catalog (RFC 9727): \`${origin}/.well-known/api-catalog\`
- MCP Server Card (SEP-1649): \`${origin}/.well-known/mcp/server-card.json\`
- A2A Agent Card (v1.0.0): \`${origin}/.well-known/agent-card.json\`
- Agent Skills Index (RFC v0.2.0): \`${origin}/.well-known/agent-skills/index.json\`
- Web Bot Auth JWKS (RFC 9421): \`${origin}/.well-known/http-message-signatures-directory\`
- OpenAPI 3.1.0 Spec: \`${origin}/openapi.json\`
- Auth & Rate Limits: \`${origin}/auth.md\`
`;
}

export function buildMcpServerCard(origin: string, agents: Agent[]) {
  return {
    $schema: 'https://modelcontextprotocol.io/schemas/server-card/v1.json',
    name: 'agent-wire-mcp-server',
    version: '2.0.0',
    serverInfo: {
      name: 'agent-wire-mcp',
      version: '2.0.0'
    },
    protocolVersion: '2025-03-26',
    description: 'AgentWire MCP Server exposing deployed multi-model agents, remote MCP tool bridges, and SKILL.md resources.',
    transport: {
      type: 'streamable-http',
      endpoint: '/mcp',
      url: `${origin}/mcp`,
      sseEndpoint: `${origin}/mcp`
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true
    },
    tools: [
      {
        name: 'list_agents',
        description: 'Lists all deployed agents in the AgentWire fleet with their models, MCP connectors, and skills.'
      },
      {
        name: 'run_agent',
        description: 'Executes a deployed AgentWire agent by id or slug with optional session memory and reasoning effort.'
      },
      {
        name: 'eval_agent',
        description: 'Runs the built-in quality, guardrail, and latency evaluation suite against an agent.'
      },
      ...agents.map(a => ({
        name: `agent_${a.slug.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        description: `${a.name}: ${a.tagline || 'Execute task on this deployed agent'}`
      }))
    ]
  };
}

export function buildA2AAgentCard(origin: string, agents: Agent[], targetAgent?: Agent) {
  const primary = targetAgent || agents[0];
  return {
    $schema: 'https://a2a-protocol.org/schemas/agent-card/v1.0.0.json',
    schemaVersion: '1.0.0',
    protocolVersion: '1.0',
    name: targetAgent ? targetAgent.name : 'AgentWire Multi-Agent Mesh',
    description: targetAgent
      ? targetAgent.tagline || targetAgent.systemPrompt
      : 'Autonomous multi-model agent fleet with Model Context Protocol (MCP) tool execution, SKILL.md guardrails, and A2A task delegation.',
    url: targetAgent ? `${origin}/api/agents/${targetAgent.id}` : origin,
    version: '2.0.0',
    provider: {
      organization: 'AgentWire',
      url: origin
    },
    defaultInputModes: ['text/plain', 'application/json'],
    defaultOutputModes: ['text/plain', 'application/json'],
    capabilities: {
      streaming: true,
      pushNotifications: false,
      stateTransitionHistory: true,
      tools: (targetAgent ? [targetAgent] : agents).map(a => ({
        name: a.slug,
        description: `${a.name}: ${a.tagline}`,
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task or prompt for the agent' },
            sessionId: { type: 'string', description: 'Optional stateful session identifier' },
            reasoningEffort: { type: 'string', enum: ['none', 'low', 'medium', 'high'] }
          },
          required: ['task']
        }
      }))
    },
    skills: (targetAgent ? targetAgent.skills : BUILTIN_SKILLS).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description
    })),
    authentication: {
      schemes: ['Bearer', 'X-AgentWire-Key'],
      credentialsUrl: `${origin}/auth.md`
    },
    communication: {
      preferredChannel: 'https',
      endpoints: {
        query: targetAgent ? `${origin}/api/agents/${targetAgent.id}/run` : `${origin}/api/a2a`,
        a2a: targetAgent ? `${origin}/api/agents/${targetAgent.id}/a2a` : `${origin}/api/a2a`,
        mcp: `${origin}/mcp`,
        openaiChatCompletions: `${origin}/v1/chat/completions`,
        openaiResponses: `${origin}/v1/responses`
      }
    }
  };
}

export async function buildAgentSkillsIndex(origin: string) {
  const skills = await Promise.all(
    BUILTIN_SKILLS.map(async s => {
      const hash = await sha256Hex(s.content);
      return {
        name: s.id,
        title: s.name,
        type: 'skill-md',
        description: s.description,
        entrypoint: `/.well-known/agent-skills/${s.id}/SKILL.md`,
        url: `${origin}/.well-known/agent-skills/${s.id}/SKILL.md`,
        sha256: hash,
        digest: `sha256:${hash}`
      };
    })
  );
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    version: '0.2.0',
    skills
  };
}

export function getSkillMarkdownById(skillId: string): string | null {
  const found = BUILTIN_SKILLS.find(s => s.id === skillId);
  if (!found) return null;
  return `---\nname: ${found.id}\ndescription: ${found.description}\n---\n\n${found.content}\n`;
}

export function buildApiCatalog(origin: string) {
  return {
    linkset: [
      {
        anchor: origin,
        rel: 'service-desc',
        href: `${origin}/openapi.json`,
        type: 'application/json'
      },
      {
        anchor: origin,
        rel: 'api-catalog',
        href: `${origin}/.well-known/api-catalog`,
        type: 'application/linkset+json'
      },
      {
        anchor: `${origin}/mcp`,
        rel: 'describedby',
        href: `${origin}/.well-known/mcp/server-card.json`,
        type: 'application/json'
      },
      {
        anchor: `${origin}/api/a2a`,
        rel: 'describedby',
        href: `${origin}/.well-known/agent-card.json`,
        type: 'application/json'
      },
      {
        anchor: origin,
        rel: 'service-doc',
        href: `${origin}/llms.txt`,
        type: 'text/plain'
      }
    ]
  };
}

export function buildAiCatalog(origin: string, agents: Agent[]) {
  return {
    schemaVersion: '1.0',
    name: 'AgentWire AI & Agent Discovery Catalog',
    url: origin,
    agentReadyLevel: 5,
    protocols: {
      mcp: `${origin}/.well-known/mcp/server-card.json`,
      a2a: `${origin}/.well-known/agent-card.json`,
      agentSkills: `${origin}/.well-known/agent-skills/index.json`,
      apiCatalog: `${origin}/.well-known/api-catalog`,
      openApi: `${origin}/openapi.json`,
      webBotAuthJwks: `${origin}/.well-known/http-message-signatures-directory`,
      oauthResource: `${origin}/.well-known/oauth-protected-resource`,
      llmsTxt: `${origin}/llms.txt`,
      authMd: `${origin}/auth.md`
    },
    endpoints: {
      mcpJsonRpc: `${origin}/mcp`,
      a2aJsonRpc: `${origin}/api/a2a`,
      openaiChatCompletions: `${origin}/v1/chat/completions`,
      openaiResponses: `${origin}/v1/responses`,
      openaiModels: `${origin}/v1/models`
    },
    agents: agents.map(a => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      runUrl: `${origin}/api/agents/${a.id}/run`,
      evalUrl: `${origin}/api/agents/${a.id}/eval`,
      agentCardUrl: `${origin}/api/agents/${a.id}/agent-card.json`
    }))
  };
}

export function buildOAuthProtectedResource(origin: string) {
  return {
    resource: origin,
    authorization_servers: [origin, 'https://openrouter.ai'],
    scopes_supported: ['agents:read', 'agents:write', 'agents:run', 'mcp:tools', 'a2a:tasks'],
    bearer_methods_supported: ['header']
  };
}

export const WEB_BOT_AUTH_JWKS = {
  keys: [
    {
      kty: 'OKP',
      crv: 'Ed25519',
      x: '11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo',
      kid: 'agentwire-ed25519-key-1',
      use: 'sig',
      alg: 'Ed25519'
    }
  ]
};

export function buildAuthMd(origin: string): string {
  return `# AgentWire Authentication & Rate Limits

## 1. Public vs. Private Agents
- **Public Agents** (\`visibility: "public"\`): Callable without an AgentWire key via \`POST ${origin}/api/agents/:id/run\`, \`POST ${origin}/mcp\`, \`POST ${origin}/api/a2a\`, and \`POST ${origin}/v1/chat/completions\`.
- **Private Agents** (\`visibility: "private"\`): Require a valid AgentWire API key (\`wire_live_...\`) passed in \`Authorization: Bearer wire_live_...\` or \`X-AgentWire-Key: wire_live_...\`.

## 2. Minting an AgentWire API Key
\`\`\`bash
curl -X POST ${origin}/api/keys \\
  -H "Content-Type: application/json" \\
  -d '{"name": "Autonomous Agent Key"}'
\`\`\`

## 3. Supplying an OpenRouter Key (BYOK)
Pass \`-H "X-OpenRouter-Key: sk-or-v1-..."\` or \`-H "Authorization: Bearer sk-or-v1-..."\` to execute live multi-model failover chains across Claude Sonnet 4, Gemini 2.5 Pro, OpenAI o3-mini, and DeepSeek R1.

## 4. Rate Limits & Tracing
- Sliding window rate limit: **60 requests / minute** per API key or IP.
- Responses include \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-AgentWire-Run-Id\`, \`X-AgentWire-Trace-Id\`, and W3C \`traceparent\`.
`;
}

export function buildRobotsTxt(origin: string): string {
  return `User-agent: *
Allow: /

Content-Signal: ai-train=yes, search=yes, ai-input=yes
Sitemap: ${origin}/openapi.json
`;
}

export function buildOpenApiSpec(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'AgentWire Modern AI Stack API',
      version: '2.0.0',
      description: 'Serverless multi-model agent runtime supporting REST, SSE Streaming, Model Context Protocol (MCP), Google A2A v1.0, OpenAI Chat Completions / Responses APIs, and Automated Evals.'
    },
    servers: [{ url: origin }],
    paths: {
      '/api/agents': {
        get: { summary: 'List all deployed agents', operationId: 'listAgents' },
        post: { summary: 'Deploy a new agent with MCPs, skills, guardrails, and model failover', operationId: 'createAgent' }
      },
      '/api/agents/{id}/run': {
        post: {
          summary: 'Execute an agent (supports JSON, SSE streaming, structured outputs, reasoning effort, and stateful sessions)',
          operationId: 'runAgent'
        }
      },
      '/api/agents/{id}/eval': {
        post: {
          summary: 'Run deterministic evaluation suite against an agent',
          operationId: 'evalAgent'
        }
      },
      '/mcp': {
        post: {
          summary: 'Model Context Protocol (MCP) Streamable HTTP JSON-RPC 2.0 endpoint',
          operationId: 'mcpJsonRpc'
        }
      },
      '/api/a2a': {
        post: {
          summary: 'Google Agent-to-Agent (A2A v1.0) JSON-RPC 2.0 endpoint (tasks/send, tasks/get, tasks/cancel)',
          operationId: 'a2aJsonRpc'
        }
      },
      '/v1/models': {
        get: {
          summary: 'OpenAI-compatible models list exposing all deployed agents',
          operationId: 'listOpenAiModels'
        }
      },
      '/v1/chat/completions': {
        post: {
          summary: 'OpenAI-compatible Chat Completions endpoint routed through AgentWire',
          operationId: 'createChatCompletion'
        }
      },
      '/v1/responses': {
        post: {
          summary: 'OpenAI-compatible Responses API endpoint routed through AgentWire',
          operationId: 'createResponse'
        }
      }
    }
  };
}

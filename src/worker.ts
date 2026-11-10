import type {
  Agent,
  RunAgentRequest,
  RunAgentResponse,
  AgentSession,
  AgentEvalCase
} from './types.ts';
import { BUILTIN_SKILLS, AVAILABLE_MODELS } from './presets.ts';
import {
  AGENT_DISCOVERY_LINK_HEADER,
  CONTENT_SIGNAL_HEADER,
  SECURITY_HEADERS,
  resolveCorsOrigin,
  wantsMarkdown,
  buildMarkdownOverview,
  buildMcpServerCard,
  buildA2AAgentCard,
  buildAgentSkillsIndex,
  getSkillMarkdownById,
  buildApiCatalog,
  buildAiCatalog,
  buildOAuthProtectedResource,
  getWebBotAuthJwks,
  buildAuthMd,
  buildRobotsTxt,
  buildOpenApiSpec
} from './protocols.ts';
import {
  type Env,
  type A2ATaskRecord,
  cryptoRandomHex,
  getClientIp,
  extractWireKey,
  validateApiKey,
  authorizePrivateAgent,
  checkRateLimit,
  getOrGenerateTrace,
  sanitizeAgentForPublic,
  sanitizeAgentsForPublic,
  sanitizeAgentForListing,
  filterPublicAgents,
  saveA2ATask,
  getA2ATask,
  createApiKey,
  listApiKeys,
  revokeApiKey,
  listAgentRuns,
  getSession,
  saveSession,
  listSessions,
  deleteSession,
  getAgent,
  saveAgent,
  listAgents,
  deleteAgent
} from './store.ts';
import {
  probeMcpServer,
  validateAgentInput,
  executeAgentCore,
  computeCallerPrincipalHash,
  runAgentEvaluationSuite
} from './engine.ts';
import { evaluateFeatureFlags } from './flags.ts';
import {
  classifyStatus,
  getErrorBudgetSummary,
  getMetricsSnapshot,
  getUptimeSeconds,
  logStructured,
  normalizeRouteTemplate,
  recordRequestMetric,
  scrubSecrets
} from './telemetry.ts';

export type { Env };

const MAX_REQUEST_BODY_BYTES = 262_144; // 256 KB

class PayloadTooLargeError extends Error {
  constructor() {
    super('Payload too large (maximum 256 KB).');
  }
}

async function readJsonBody<T = any>(request: Request, maxBytes = MAX_REQUEST_BODY_BYTES): Promise<T> {
  const declaredLen = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    throw new PayloadTooLargeError();
  }
  const reader = request.body?.getReader();
  if (!reader) {
    const raw = await request.text();
    if (raw.length > maxBytes) throw new PayloadTooLargeError();
    return JSON.parse(raw) as T;
  }
  const decoder = new TextDecoder();
  let total = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new PayloadTooLargeError();
      }
      text += decoder.decode(value, { stream: true });
    }
  }
  text += decoder.decode();
  if (!text.trim()) {
    throw new SyntaxError('Empty JSON body');
  }
  return JSON.parse(text) as T;
}

function rateLimitExceededResponse(
  limit: number,
  resetAfterSec: number,
  message: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      'Retry-After': String(resetAfterSec),
      'X-RateLimit-Limit': String(limit),
      'X-RateLimit-Remaining': '0'
    }
  });
}

function jsonResponse(
  data: unknown,
  corsHeaders: Record<string, string>,
  status = 200,
  pretty = false
): Response {
  return new Response(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function unauthorizedPrivateAgentResponse(corsHeaders: Record<string, string>): Response {
  return jsonResponse(
    { error: 'Unauthorized: This agent is private and requires a valid AgentWire API key (wire_live_...).' },
    corsHeaders,
    401
  );
}

function jsonRpcSuccess(
  id: string | number | null,
  result: unknown,
  corsHeaders: Record<string, string>
): Response {
  return jsonResponse({ jsonrpc: '2.0', id, result }, corsHeaders, 200);
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string,
  corsHeaders: Record<string, string>,
  status = 400
): Response {
  return jsonResponse({ jsonrpc: '2.0', id, error: { code, message } }, corsHeaders, status);
}

async function getVisibleDiscoveryAgents(request: Request, env: Env): Promise<Agent[]> {
  const all = await listAgents(env);
  const wireKey = extractWireKey(request);
  const validKey = wireKey ? await validateApiKey(wireKey, env) : null;
  return validKey ? sanitizeAgentsForPublic(all) : filterPublicAgents(all);
}

async function resolveOpenAiTargetAgent(requestedModel: string, env: Env): Promise<Agent | null> {
  const found = await getAgent(requestedModel, env);
  if (found) return found;
  if (AVAILABLE_MODELS.some(m => m.id === requestedModel)) {
    const base = await getAgent('agt_design_critic', env);
    if (base) {
      return {
        ...base,
        models: [requestedModel, ...base.models.filter(m => m !== requestedModel)]
      };
    }
  }
  return null;
}

async function handleWorkerRequest(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const basePath = (env.BASE_PATH || '').replace(/\/+$/, '');
  const origin = `${url.origin}${basePath}`;
  const clientIp = getClientIp(request);
  const evaluatedFlags = evaluateFeatureFlags(env, clientIp);

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // =========================================================================
  // 0a. HEALTH CHECK, RED METRICS & FEATURE FLAGS (PRODUCTION OBSERVABILITY)
  // =========================================================================
  if ((path === '/api/health' || path === '/healthz') && request.method === 'GET') {
    const agents = await listAgents(env);
    return jsonResponse(
      {
        status: 'ok',
        service: 'agent-wire',
        version: '1.0.0',
        environment: env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        uptimeSeconds: getUptimeSeconds(),
        storage: env.AGENTS_KV ? 'cloudflare_kv' : 'in_memory',
        agentsCount: agents.length,
        featureFlags: evaluatedFlags.values,
        errorBudget: getErrorBudgetSummary()
      },
      { ...corsHeaders, 'Cache-Control': 'no-cache' },
      200,
      true
    );
  }

  if (path === '/api/metrics' && request.method === 'GET') {
    return jsonResponse(
      getMetricsSnapshot(),
      { ...corsHeaders, 'Cache-Control': 'no-cache' },
      200,
      true
    );
  }

  if (path === '/api/flags' && request.method === 'GET') {
    return jsonResponse(
      {
        environment: env.ENVIRONMENT || 'development',
        flags: evaluatedFlags.definitions
      },
      { ...corsHeaders, 'Cache-Control': 'no-cache' },
      200,
      true
    );
  }

  // =========================================================================
  // 0. LEVEL 5 AGENT-NATIVE DISCOVERY & CONTENT NEGOTIATION ENDPOINTS
  // =========================================================================

  if ((path === '/' || path === '/index.html' || path === '/index.md') && request.method === 'GET') {
    if (path === '/index.md' || wantsMarkdown(request.headers.get('Accept'))) {
      const agents = await getVisibleDiscoveryAgents(request, env);
      const markdown = buildMarkdownOverview(origin, agents);
      const mdTokens = Math.ceil(markdown.length / 4);
      return new Response(markdown, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/markdown; charset=utf-8',
          'x-markdown-tokens': String(mdTokens),
          'x-original-tokens': String(mdTokens * 3)
        }
      });
    }
    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const mergedHeaders = new Headers(assetRes.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        mergedHeaders.set(k, v);
      }
      mergedHeaders.set('Cache-Control', 'no-cache');
      return new Response(assetRes.body, { status: assetRes.status, headers: mergedHeaders });
    }
  }

  if ((path === '/llms.txt' || path === '/llms-full.txt') && request.method === 'GET') {
    const agents = await getVisibleDiscoveryAgents(request, env);
    const markdown = buildMarkdownOverview(origin, agents);
    return new Response(markdown, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'x-markdown-tokens': String(Math.ceil(markdown.length / 4))
      }
    });
  }

  if (path === '/auth.md' && request.method === 'GET') {
    return new Response(buildAuthMd(origin), {
      headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' }
    });
  }

  if (path === '/robots.txt' && request.method === 'GET') {
    return new Response(buildRobotsTxt(origin), {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  if (path === '/openapi.json' && request.method === 'GET') {
    return jsonResponse(buildOpenApiSpec(origin), corsHeaders, 200, true);
  }

  if (path === '/.well-known/mcp/server-card.json' && request.method === 'GET') {
    const agents = await getVisibleDiscoveryAgents(request, env);
    return jsonResponse(buildMcpServerCard(origin, agents), corsHeaders, 200, true);
  }

  if (path === '/.well-known/agent-card.json' && request.method === 'GET') {
    const agents = await getVisibleDiscoveryAgents(request, env);
    return jsonResponse(buildA2AAgentCard(origin, agents), corsHeaders, 200, true);
  }

  if (path === '/.well-known/agent-skills/index.json' && request.method === 'GET') {
    const index = await buildAgentSkillsIndex(origin);
    return jsonResponse(index, corsHeaders, 200, true);
  }

  const skillDocMatch = path.match(/^\/\.well-known\/agent-skills\/([a-zA-Z0-9_-]+)\/SKILL\.md$/);
  if (skillDocMatch && request.method === 'GET') {
    const md = getSkillMarkdownById(skillDocMatch[1]);
    if (!md) {
      return new Response('Skill not found', { status: 404, headers: corsHeaders });
    }
    return new Response(md, {
      headers: { ...corsHeaders, 'Content-Type': 'text/markdown; charset=utf-8' }
    });
  }

  if (path === '/.well-known/api-catalog' && request.method === 'GET') {
    return new Response(JSON.stringify(buildApiCatalog(origin), null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/linkset+json; charset=utf-8' }
    });
  }

  if (path === '/.well-known/ai-catalog.json' && request.method === 'GET') {
    const agents = await getVisibleDiscoveryAgents(request, env);
    return jsonResponse(buildAiCatalog(origin, agents), corsHeaders, 200, true);
  }

  if (path === '/.well-known/oauth-protected-resource' && request.method === 'GET') {
    return jsonResponse(buildOAuthProtectedResource(origin), corsHeaders, 200, true);
  }

  if (path === '/.well-known/http-message-signatures-directory' && request.method === 'GET') {
    const jwks = await getWebBotAuthJwks(env);
    return jsonResponse(jwks, corsHeaders, 200, true);
  }

  // =========================================================================
  // 0b. NATIVE MODEL CONTEXT PROTOCOL (MCP) SERVER: /mcp and /api/mcp
  // =========================================================================
  if (path === '/mcp' || path === '/api/mcp') {
    if (request.method === 'GET') {
      const agents = await getVisibleDiscoveryAgents(request, env);
      return jsonResponse(buildMcpServerCard(origin, agents), corsHeaders, 200, true);
    }

    if (request.method === 'POST') {
      try {
        const rpc: any = await readJsonBody(request);
        if (!rpc || typeof rpc !== 'object' || Array.isArray(rpc)) {
          return jsonRpcError(null, -32600, 'Invalid JSON-RPC request object', corsHeaders, 400);
        }
        const hasId = Object.prototype.hasOwnProperty.call(rpc, 'id');
        const id = hasId ? rpc.id : null;
        const method = rpc.method;
        const params = rpc.params && typeof rpc.params === 'object' ? rpc.params : {};
        const visibleAgents = await getVisibleDiscoveryAgents(request, env);

        if (method === 'initialize') {
          return jsonRpcSuccess(
            id,
            {
              protocolVersion: '2025-03-26',
              serverInfo: { name: 'agent-wire-mcp', version: '2.0.0' },
              capabilities: {
                tools: { listChanged: true },
                resources: { listChanged: true },
                prompts: { listChanged: true }
              }
            },
            corsHeaders
          );
        }

        if (method === 'notifications/initialized') {
          if (!hasId) {
            return new Response(null, { status: 202, headers: corsHeaders });
          }
          return jsonRpcSuccess(id, {}, corsHeaders);
        }

        if (method === 'ping') {
          return jsonRpcSuccess(id, {}, corsHeaders);
        }

        if (method === 'tools/list') {
          const tools = [
            {
              name: 'list_agents',
              description: 'List deployed AgentWire agents, their fallback models, MCP connectors, and skills.',
              inputSchema: { type: 'object', properties: {} }
            },
            {
              name: 'run_agent',
              description: 'Execute a deployed AgentWire agent by id or slug.',
              inputSchema: {
                type: 'object',
                properties: {
                  agentId: { type: 'string', description: 'Agent ID or slug (e.g. agt_design_critic)' },
                  task: { type: 'string', description: 'Task or prompt to run' },
                  sessionId: { type: 'string', description: 'Optional session ID for multi-turn memory' },
                  reasoningEffort: { type: 'string', enum: ['none', 'low', 'medium', 'high'] }
                },
                required: ['agentId', 'task']
              }
            },
            {
              name: 'eval_agent',
              description: 'Runs the built-in quality, guardrail, and latency evaluation suite against an agent.',
              inputSchema: {
                type: 'object',
                properties: {
                  agentId: { type: 'string', description: 'Agent ID or slug (e.g. agt_design_critic)' }
                },
                required: ['agentId']
              }
            },
            ...visibleAgents.map(a => ({
              name: `agent_${a.slug.replace(/[^a-zA-Z0-9_]/g, '_')}`,
              description: `${a.name}: ${a.tagline || 'Run task on this agent'}`,
              inputSchema: {
                type: 'object',
                properties: {
                  task: { type: 'string', description: `Task for ${a.name}` },
                  sessionId: { type: 'string', description: 'Optional session ID' }
                },
                required: ['task']
              }
            }))
          ];
          return jsonRpcSuccess(id, { tools }, corsHeaders);
        }

        if (method === 'tools/call') {
          const toolName: string = typeof params.name === 'string' ? params.name : '';
          const toolArgs: any = params.arguments && typeof params.arguments === 'object' ? params.arguments : {};

          if (toolName === 'list_agents') {
            return jsonRpcSuccess(
              id,
              { content: [{ type: 'text', text: JSON.stringify(visibleAgents, null, 2) }] },
              corsHeaders
            );
          }

          if (toolName === 'eval_agent') {
            if (!evaluatedFlags.values.evalSuite) {
              return jsonRpcError(id, -32000, 'Evaluation suite is disabled by feature flag.', corsHeaders, 503);
            }
            const target = await getAgent(toolArgs.agentId || 'agt_design_critic', env);
            if (!target) {
              return jsonRpcError(id, -32602, `Agent not found: ${toolArgs.agentId}`, corsHeaders, 404);
            }
            if (!(await authorizePrivateAgent(target, request, env))) {
              return jsonRpcError(id, -32001, 'Unauthorized: Private agent requires a valid AgentWire API key.', corsHeaders, 401);
            }
            const summary = await runAgentEvaluationSuite(target, toolArgs.cases, request, env, corsHeaders);
            return jsonRpcSuccess(
              id,
              {
                content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
                structuredContent: summary,
                isError: summary.failed > 0
              },
              corsHeaders
            );
          }

          let targetAgentId: string;
          if (toolName === 'run_agent') {
            targetAgentId = typeof toolArgs.agentId === 'string' && toolArgs.agentId ? toolArgs.agentId : 'agt_design_critic';
          } else if (toolName.startsWith('agent_')) {
            const slugPart = toolName.slice('agent_'.length);
            const allAgents = await listAgents(env);
            const matched = allAgents.find(
              a => a.slug.replace(/[^a-zA-Z0-9_]/g, '_') === slugPart || a.id === slugPart
            );
            if (!matched) {
              return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`, corsHeaders, 404);
            }
            targetAgentId = matched.id;
          } else {
            return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`, corsHeaders, 400);
          }

          const targetAgent = await getAgent(targetAgentId, env);
          if (!targetAgent) {
            return jsonRpcError(id, -32602, `Agent not found for tool ${toolName}`, corsHeaders, 404);
          }

          const exec = await executeAgentCore(
            targetAgent,
            {
              task: toolArgs.input || toolArgs.task || toolArgs.prompt || 'Report capabilities',
              sessionId: toolArgs.sessionId,
              callerPrincipal: typeof toolArgs.user === 'string' ? toolArgs.user : undefined,
              mcpToken: typeof toolArgs.mcpToken === 'string' ? toolArgs.mcpToken : undefined,
              reasoningEffort: toolArgs.reasoningEffort
            },
            request,
            env,
            corsHeaders
          );

          if (exec.status === 401 || exec.status === 403 || exec.status === 429) {
            return jsonRpcError(
              id,
              -32001,
              (exec.body as { error?: string }).error || 'Request rejected',
              corsHeaders,
              exec.status
            );
          }

          const execBody = exec.body as RunAgentResponse;
          return jsonRpcSuccess(
            id,
            {
              content: [{ type: 'text', text: execBody.result || JSON.stringify(exec.body) }],
              structuredContent: exec.body,
              isError: exec.status >= 400,
              _meta: {
                runId: execBody.runId,
                traceId: execBody.traceId,
                modelUsed: execBody.modelUsed,
                durationMs: execBody.durationMs
              }
            },
            corsHeaders
          );
        }

        if (method === 'resources/list') {
          const resources = [
            ...visibleAgents.map(a => ({
              uri: `agent://${a.id}`,
              name: a.name,
              description: a.tagline,
              mimeType: 'application/json'
            })),
            ...BUILTIN_SKILLS.map(s => ({
              uri: `skill://${s.id}`,
              name: s.name,
              description: s.description,
              mimeType: 'text/markdown'
            }))
          ];
          return jsonRpcSuccess(id, { resources }, corsHeaders);
        }

        if (method === 'resources/read') {
          const uri: string = typeof params.uri === 'string' ? params.uri : '';
          if (uri.startsWith('agent://')) {
            const ag = await getAgent(uri.slice('agent://'.length), env);
            if (ag) {
              if (!(await authorizePrivateAgent(ag, request, env))) {
                return jsonRpcError(id, -32001, 'Unauthorized: Private agent requires a valid AgentWire API key.', corsHeaders, 401);
              }
              const publicAg = sanitizeAgentForPublic(ag);
              return jsonRpcSuccess(
                id,
                { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(publicAg, null, 2) }] },
                corsHeaders
              );
            }
          }
          if (uri.startsWith('skill://')) {
            const skillMd = getSkillMarkdownById(uri.slice('skill://'.length));
            if (skillMd) {
              return jsonRpcSuccess(
                id,
                { contents: [{ uri, mimeType: 'text/markdown', text: skillMd }] },
                corsHeaders
              );
            }
          }
          return jsonRpcError(id, -32002, `Resource not found: ${uri}`, corsHeaders, 404);
        }

        if (method === 'prompts/list') {
          const prompts = visibleAgents.map(a => ({
            name: a.slug,
            description: a.tagline,
            arguments: [{ name: 'task', description: 'Task to execute', required: true }]
          }));
          return jsonRpcSuccess(id, { prompts }, corsHeaders);
        }

        if (method === 'prompts/get') {
          const ag = await getAgent(params.name || 'agt_design_critic', env);
          if (!ag) {
            return jsonRpcError(id, -32602, 'Prompt not found', corsHeaders, 404);
          }
          if (!(await authorizePrivateAgent(ag, request, env))) {
            return jsonRpcError(id, -32001, 'Unauthorized: Private agent requires a valid AgentWire API key.', corsHeaders, 401);
          }
          return jsonRpcSuccess(
            id,
            {
              description: ag.tagline,
              messages: [
                { role: 'user', content: { type: 'text', text: `${ag.systemPrompt}\n\nTask: ${params.arguments?.task || ''}` } }
              ]
            },
            corsHeaders
          );
        }

        return jsonRpcError(id, -32601, `Unsupported MCP method: ${method}`, corsHeaders, 400);
      } catch (err: any) {
        if (err instanceof PayloadTooLargeError) {
          return jsonRpcError(null, -32600, err.message, corsHeaders, 413);
        }
        return jsonRpcError(null, -32700, 'Invalid JSON-RPC payload', corsHeaders, 400);
      }
    }
  }

  // =========================================================================
  // 0c. GOOGLE AGENT-TO-AGENT (A2A v1.0) PROTOCOL: /api/a2a & /api/agents/:id/a2a
  // =========================================================================
  const agentCardMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/agent-card\.json$/);
  if (agentCardMatch && request.method === 'GET') {
    const ag = await getAgent(agentCardMatch[1], env);
    if (!ag) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(ag, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    const agents = await getVisibleDiscoveryAgents(request, env);
    return jsonResponse(buildA2AAgentCard(origin, agents, sanitizeAgentForPublic(ag)), corsHeaders, 200, true);
  }

  const agentA2AMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/a2a$/);
  if ((path === '/api/a2a' || agentA2AMatch) && request.method === 'POST') {
    try {
      const rpc: any = await readJsonBody(request);
      if (!rpc || typeof rpc !== 'object' || Array.isArray(rpc)) {
        return jsonRpcError(null, -32600, 'Invalid A2A JSON-RPC request', corsHeaders, 400);
      }
      const hasId = Object.prototype.hasOwnProperty.call(rpc, 'id');
      const rpcId = hasId ? rpc.id : 'a2a_1';
      const method: string = rpc.method || 'tasks/send';
      const params: any = rpc.params && typeof rpc.params === 'object' ? rpc.params : {};

      if (method === 'tasks/send' || method === 'message/send') {
        const targetAgentId = agentA2AMatch?.[1] || params.agentId || 'agt_design_critic';
        const targetAgent = await getAgent(targetAgentId, env);
        if (!targetAgent) {
          return jsonRpcError(rpcId, -32602, `Agent not found: ${targetAgentId}`, corsHeaders, 404);
        }

        let taskId = `a2a_${Date.now()}_${cryptoRandomHex(4)}`;
        if (params.id !== undefined) {
          if (typeof params.id !== 'string' || !/^[a-zA-Z0-9_:-]{1,128}$/.test(params.id)) {
            return jsonRpcError(rpcId, -32602, 'Invalid task "id" format.', corsHeaders, 400);
          }
          if (getA2ATask(params.id)) {
            return jsonRpcError(rpcId, -32602, `Task "${params.id}" already exists.`, corsHeaders, 409);
          }
          taskId = params.id;
        }

        const parts = Array.isArray(params.message?.parts) ? params.message.parts : [];
        const textPart =
          parts.find((p: any) => p && p.type === 'text' && typeof p.text === 'string')?.text ||
          (typeof params.task === 'string' ? params.task : '') ||
          'Execute A2A task';

        const exec = await executeAgentCore(
          targetAgent,
          {
            task: textPart,
            sessionId: params.sessionId,
            callerPrincipal: typeof params.user === 'string' ? params.user : undefined,
            mcpToken: typeof params.mcpToken === 'string' ? params.mcpToken : undefined,
            reasoningEffort: params.reasoningEffort
          },
          request,
          env,
          corsHeaders
        );

        if (exec.status === 401 || exec.status === 403 || exec.status === 429) {
          return jsonRpcError(
            rpcId,
            -32001,
            (exec.body as { error?: string }).error || 'Request rejected',
            corsHeaders,
            exec.status
          );
        }

        const execBody = exec.body as RunAgentResponse;
        const taskRecord: A2ATaskRecord = {
          id: taskId,
          agentId: targetAgent.id,
          status: {
            state: exec.status >= 400 ? 'failed' : 'completed',
            timestamp: new Date().toISOString()
          },
          artifacts: [
            {
              name: 'agent-response',
              parts: [{ type: 'text', text: execBody.result || JSON.stringify(exec.body) }]
            }
          ],
          history: [
            { role: 'user', parts: [{ type: 'text', text: textPart }] },
            { role: 'agent', parts: [{ type: 'text', text: execBody.result || '' }] }
          ],
          metadata: {
            runId: execBody.runId,
            traceId: execBody.traceId,
            modelUsed: execBody.modelUsed,
            subAgentsCalled: execBody.subAgentsCalled || [],
            durationMs: execBody.durationMs
          }
        };

        saveA2ATask(taskId, taskRecord);
        return jsonRpcSuccess(rpcId, taskRecord, corsHeaders);
      }

      if (method === 'tasks/get') {
        const taskRecord = typeof params.id === 'string' ? getA2ATask(params.id) : undefined;
        if (!taskRecord) {
          return jsonRpcError(rpcId, -32001, 'Task not found', corsHeaders, 404);
        }
        const taskAgent = await getAgent(taskRecord.agentId, env);
        if (taskAgent && !(await authorizePrivateAgent(taskAgent, request, env))) {
          return jsonRpcError(rpcId, -32001, 'Unauthorized: Private agent task requires an AgentWire API key.', corsHeaders, 401);
        }
        return jsonRpcSuccess(rpcId, taskRecord, corsHeaders);
      }

      if (method === 'tasks/cancel') {
        const taskRecord = typeof params.id === 'string' ? getA2ATask(params.id) : undefined;
        if (!taskRecord) {
          return jsonRpcError(rpcId, -32001, 'Task not found', corsHeaders, 404);
        }
        const taskAgent = await getAgent(taskRecord.agentId, env);
        if (taskAgent && !(await authorizePrivateAgent(taskAgent, request, env))) {
          return jsonRpcError(rpcId, -32001, 'Unauthorized: Private agent task requires an AgentWire API key.', corsHeaders, 401);
        }
        taskRecord.status = { state: 'canceled', timestamp: new Date().toISOString() };
        return jsonRpcSuccess(rpcId, taskRecord, corsHeaders);
      }

      return jsonRpcError(rpcId, -32601, `Unsupported A2A method: ${method}`, corsHeaders, 400);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonRpcError(null, -32600, err.message, corsHeaders, 413);
      }
      return jsonRpcError(null, -32700, 'Invalid A2A JSON-RPC payload', corsHeaders, 400);
    }
  }

  // =========================================================================
  // 0d. OPENAI-COMPATIBLE SDK ENDPOINTS: /v1/models, /v1/chat/completions, /v1/responses
  // =========================================================================
  if (path.startsWith('/v1/') && !evaluatedFlags.values.openAiFacade) {
    return jsonResponse({ error: 'OpenAI-compatible facade is disabled by feature flag.' }, corsHeaders, 503);
  }

  if (path === '/v1/models' && request.method === 'GET') {
    const agents = await getVisibleDiscoveryAgents(request, env);
    const data = [
      ...agents.map(a => ({
        id: `agentwire/${a.slug}`,
        agentId: a.id,
        slug: a.slug,
        object: 'model',
        created: Math.floor(new Date(a.createdAt).getTime() / 1000),
        owned_by: 'agent-wire',
        description: a.tagline
      })),
      ...AVAILABLE_MODELS.map(m => ({
        id: m.id,
        object: 'model',
        created: 1740000000,
        owned_by: m.provider.toLowerCase(),
        description: `${m.name} (${m.context})`
      }))
    ];
    return jsonResponse({ object: 'list', data }, corsHeaders);
  }

  if (path === '/v1/chat/completions' && request.method === 'POST') {
    try {
      const body: any = await readJsonBody(request);
      const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'agt_design_critic';
      const targetAgent = await resolveOpenAiTargetAgent(requestedModel, env);
      if (!targetAgent) {
        return jsonResponse(
          {
            error: {
              message: `Model "${requestedModel}" not found.`,
              type: 'invalid_request_error',
              code: 'model_not_found'
            }
          },
          corsHeaders,
          404
        );
      }

      const exec = await executeAgentCore(
        targetAgent,
        {
          messages: body.messages,
          task: body.prompt,
          sessionId: typeof (body.session_id || body.sessionId) === 'string' ? (body.session_id || body.sessionId) : undefined,
          callerPrincipal: typeof body.user === 'string' ? body.user : undefined,
          mcpToken: typeof (body.mcp_token || body.mcpToken) === 'string' ? (body.mcp_token || body.mcpToken) : undefined,
          maxTokens: body.max_tokens || body.max_completion_tokens,
          reasoningEffort: body.reasoning_effort,
          responseFormat: body.response_format?.type
        },
        request,
        env,
        corsHeaders
      );

      if (exec.status >= 400) {
        return new Response(
          JSON.stringify({
            error: {
              message: (exec.body as { error?: string }).error || 'Agent execution rejected',
              type:
                exec.status === 401
                  ? 'authentication_error'
                  : exec.status === 403
                    ? 'permission_error'
                    : 'rate_limit_error'
            }
          }),
          { status: exec.status, headers: exec.headers }
        );
      }

      const execBody = exec.body as RunAgentResponse;

      if (body.stream) {
        const encoder = new TextEncoder();
        const completionId = `chatcmpl_${execBody.runId}`;
        const created = Math.floor(Date.now() / 1000);
        const stream = new ReadableStream({
          start(controller) {
            const chunk1 = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: targetAgent.id,
              choices: [{ index: 0, delta: { role: 'assistant', content: execBody.result }, finish_reason: null }]
            };
            const chunk2 = {
              id: completionId,
              object: 'chat.completion.chunk',
              created,
              model: targetAgent.id,
              choices: [{ index: 0, delta: {}, finish_reason: 'stop' }]
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk1)}\n\n`));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk2)}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          }
        });
        return new Response(stream, {
          headers: {
            ...exec.headers,
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache'
          }
        });
      }

      const completion = {
        id: `chatcmpl_${execBody.runId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: targetAgent.id,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: execBody.result
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: execBody.tokens?.prompt || 0,
          completion_tokens: execBody.tokens?.completion || 0,
          total_tokens: execBody.tokens?.total || 0
        },
        agentwire_meta: {
          runId: execBody.runId,
          traceId: execBody.traceId,
          modelUsed: execBody.modelUsed,
          toolsUsed: execBody.toolsUsed,
          durationMs: execBody.durationMs
        }
      };

      return new Response(JSON.stringify(completion, null, 2), {
        status: exec.status,
        headers: exec.headers
      });
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: { message: err.message, type: 'invalid_request_error' } }, corsHeaders, 413);
      }
      return jsonResponse({ error: { message: 'Invalid JSON request payload.', type: 'invalid_request_error' } }, corsHeaders, 400);
    }
  }

  if (path === '/v1/responses' && request.method === 'POST') {
    try {
      const body: any = await readJsonBody(request);
      const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'agt_design_critic';
      const targetAgent = await resolveOpenAiTargetAgent(requestedModel, env);
      if (!targetAgent) {
        return jsonResponse(
          {
            error: {
              message: `Model "${requestedModel}" not found.`,
              type: 'invalid_request_error',
              code: 'model_not_found'
            }
          },
          corsHeaders,
          404
        );
      }

      let inputStr = 'Hello';
      if (typeof body.input === 'string') {
        inputStr = body.input;
      } else if (Array.isArray(body.input)) {
        inputStr = body.input.map((i: any) => (typeof i === 'string' ? i : i?.content || i?.text || '')).join('\n');
      }

      const exec = await executeAgentCore(
        targetAgent,
        {
          task: inputStr,
          sessionId: typeof (body.session_id || body.sessionId) === 'string' ? (body.session_id || body.sessionId) : undefined,
          callerPrincipal: typeof body.user === 'string' ? body.user : undefined,
          mcpToken: typeof (body.mcp_token || body.mcpToken) === 'string' ? (body.mcp_token || body.mcpToken) : undefined,
          reasoningEffort: body.reasoning?.effort,
          maxTokens: body.max_output_tokens
        },
        request,
        env,
        corsHeaders
      );

      if (exec.status >= 400) {
        return new Response(
          JSON.stringify({
            error: {
              message: (exec.body as { error?: string }).error || 'Agent execution rejected',
              type:
                exec.status === 401
                  ? 'authentication_error'
                  : exec.status === 403
                    ? 'permission_error'
                    : 'rate_limit_error'
            }
          }),
          { status: exec.status, headers: exec.headers }
        );
      }

      const execBody = exec.body as RunAgentResponse;
      const responsePayload = {
        id: `resp_${execBody.runId}`,
        object: 'response',
        created_at: Math.floor(Date.now() / 1000),
        status: 'completed',
        model: targetAgent.id,
        output_text: execBody.result,
        output: [
          {
            type: 'message',
            id: `msg_${execBody.runId}`,
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: execBody.result,
                annotations: []
              }
            ]
          }
        ],
        usage: {
          input_tokens: execBody.tokens?.prompt || 0,
          output_tokens: execBody.tokens?.completion || 0,
          total_tokens: execBody.tokens?.total || 0
        },
        agentwire_meta: {
          runId: execBody.runId,
          traceId: execBody.traceId,
          steps: execBody.steps
        }
      };

      return new Response(JSON.stringify(responsePayload, null, 2), {
        status: exec.status,
        headers: exec.headers
      });
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: { message: err.message } }, corsHeaders, 413);
      }
      return jsonResponse({ error: { message: 'Invalid JSON request payload.' } }, corsHeaders, 400);
    }
  }

  // 1. List all agents (redacting private agent systemPrompt unless caller presents valid wire_live_... key)
  if (path === '/api/agents' && request.method === 'GET') {
    const wireKey = extractWireKey(request);
    const isAuthorized = Boolean(wireKey && (await validateApiKey(wireKey, env)));
    const list = (await listAgents(env)).map(a => sanitizeAgentForListing(a, isAuthorized));
    return jsonResponse(list, corsHeaders);
  }

  // 2. Create / Deploy an agent
  if (path === '/api/agents' && request.method === 'POST') {
    const rate = checkRateLimit(`mutate:agents:${clientIp}`, 30, 60000);
    if (!rate.allowed) {
      return rateLimitExceededResponse(30, rate.resetAfterSec, 'Rate limit exceeded on agent deployment.', corsHeaders);
    }
    try {
      const body: any = await readJsonBody(request);
      const validation = validateAgentInput(body);
      if (!validation.valid) {
        return jsonResponse({ error: validation.error }, corsHeaders, 400);
      }

      const id =
        typeof body.id === 'string' && /^[a-zA-Z0-9_-]{3,64}$/.test(body.id)
          ? body.id
          : `agt_${cryptoRandomHex(5)}`;
      const slug = (typeof body.slug === 'string' && body.slug.trim() ? body.slug.trim() : id).replace(/[^a-zA-Z0-9_-]/g, '-');

      // Prevent overwriting protected starter agents or unauthorized private agents
      const existingAll = await listAgents(env);
      const colliding = existingAll.find(a => a.id === id || a.slug === slug);
      if (colliding) {
        if (colliding.isProtected) {
          return jsonResponse({ error: 'Starter agents are protected and cannot be overwritten.' }, corsHeaders, 403);
        }
        if (!(await authorizePrivateAgent(colliding, request, env))) {
          return unauthorizedPrivateAgentResponse(corsHeaders);
        }
      }

      const visibility: 'public' | 'private' = body.visibility === 'private' ? 'private' : 'public';
      const normalizedSkills = Array.isArray(body.skills)
        ? body.skills.map((s: any, idx: number) => ({
            id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `skill_${idx + 1}`,
            name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : typeof s.id === 'string' ? s.id : `Skill ${idx + 1}`,
            description: typeof s.description === 'string' ? s.description : '',
            content: String(s.content || ''),
            enabled: s.enabled !== false
          }))
        : [];

      const agent: Agent = {
        id,
        name: (body.name || 'Untitled Agent').trim(),
        slug,
        tagline: body.tagline || '',
        systemPrompt: body.systemPrompt || '',
        models: body.models && body.models.length > 0 ? body.models : ['anthropic/claude-3.5-sonnet', 'google/gemini-2.5-flash'],
        temperature: typeof body.temperature === 'number' ? body.temperature : 0.4,
        maxTokens: typeof body.maxTokens === 'number' ? body.maxTokens : 2048,
        reasoningEffort: body.reasoningEffort || 'medium',
        responseFormat: body.responseFormat || 'text',
        outputSchema: body.outputSchema || undefined,
        guardrails: body.guardrails || {
          blockPromptInjection: true,
          redactPii: true,
          maxToolSteps: 5
        },
        subAgents: body.subAgents || [],
        mcps: body.mcps || [],
        skills: normalizedSkills,
        // Never persist an OpenRouter secret key onto a publicly callable agent
        openRouterKey:
          visibility === 'private' && typeof body.openRouterKey === 'string' && body.openRouterKey.trim()
            ? body.openRouterKey.trim()
            : undefined,
        visibility,
        ownerId: 'usr_local',
        isProtected: false,
        createdAt: colliding?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        invocationCount: colliding?.invocationCount || 0
      };

      await saveAgent(agent, env);
      return jsonResponse({ success: true, agent: sanitizeAgentForPublic(agent) }, corsHeaders, 201);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: err.message }, corsHeaders, 413);
      }
      return jsonResponse({ error: 'Invalid JSON payload for agent creation.' }, corsHeaders, 400);
    }
  }

  // 2b. Run History Endpoint: GET /api/agents/:id/runs
  const runsMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/runs$/);
  if (runsMatch && request.method === 'GET') {
    const agent = await getAgent(runsMatch[1], env);
    if (!agent) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    const runs = await listAgentRuns(agent.id, 30, env);
    return jsonResponse({ runs }, corsHeaders);
  }

  // 2c. Sessions & Memory Management Endpoints
  const sessionsMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/sessions$/);
  if (sessionsMatch) {
    const agent = await getAgent(sessionsMatch[1], env);
    if (!agent) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    if (request.method === 'GET') {
      const { callerPrincipalHash } = await computeCallerPrincipalHash(request, env);
      const sessions = (await listSessions(agent.id, env))
        .filter(s => !s.principalHash || s.principalHash === callerPrincipalHash)
        .map(({ principalHash: _ph, ...pub }) => pub);
      return jsonResponse({ sessions }, corsHeaders);
    }
    if (request.method === 'POST') {
      try {
        let body: any = {};
        try {
          body = await readJsonBody(request);
        } catch (parseErr: any) {
          if (parseErr instanceof PayloadTooLargeError) throw parseErr;
          body = {};
        }

        const sessionId =
          body.sessionId !== undefined ? String(body.sessionId) : `ses_${Date.now()}_${cryptoRandomHex(4)}`;
        if (!/^[a-zA-Z0-9_:-]{1,128}$/.test(sessionId)) {
          return jsonResponse({ error: 'Invalid sessionId format (1-128 alphanumeric/underscore/colon/hyphen characters).' }, corsHeaders, 400);
        }
        const safeMessages = Array.isArray(body.messages)
          ? body.messages
              .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
              .slice(-50)
              .map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content.slice(0, 16000),
                timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date().toISOString()
              }))
          : [];
        const safeMemory: Record<string, any> = {};
        if (body.memory && typeof body.memory === 'object' && !Array.isArray(body.memory)) {
          for (const [k, v] of Object.entries(body.memory)) {
            if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && k.length <= 128) {
              safeMemory[k] = v;
            }
          }
        }
        if (JSON.stringify(safeMemory).length > 16384) {
          return jsonResponse({ error: 'Session memory cannot exceed 16 KB.' }, corsHeaders, 400);
        }

        const session: AgentSession = {
          id: sessionId,
          agentId: agent.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: safeMessages,
          memory: safeMemory,
          runsCount: 0
        };
        await saveSession(session, env);
        return jsonResponse({ success: true, session }, corsHeaders, 201);
      } catch (err: any) {
        if (err instanceof PayloadTooLargeError) {
          return jsonResponse({ error: err.message }, corsHeaders, 413);
        }
        return jsonResponse({ error: 'Invalid session payload.' }, corsHeaders, 400);
      }
    }
  }

  const sessionItemMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/sessions\/([a-zA-Z0-9_:-]+)$/);
  if (sessionItemMatch) {
    const agent = await getAgent(sessionItemMatch[1], env);
    if (!agent) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    const sessionId = sessionItemMatch[2];
    const session = await getSession(agent.id, sessionId, env);
    const { callerPrincipalHash } = await computeCallerPrincipalHash(request, env);
    if (session?.principalHash && session.principalHash !== callerPrincipalHash) {
      return jsonResponse(
        { error: 'Forbidden: Session is bound to a different caller identity.' },
        corsHeaders,
        403
      );
    }
    if (request.method === 'GET') {
      if (!session) {
        return jsonResponse({ error: 'Session not found' }, corsHeaders, 404);
      }
      const { principalHash: _ph, ...publicSession } = session;
      return jsonResponse(publicSession, corsHeaders);
    }
    if (request.method === 'DELETE') {
      await deleteSession(agent.id, sessionId, env);
      return jsonResponse({ success: true }, corsHeaders);
    }
  }

  // 2d. API Key Management Endpoints
  if (path === '/api/keys' && request.method === 'GET') {
    const isAdmin = Boolean(env.ADMIN_SECRET && request.headers.get('X-Admin-Secret') === env.ADMIN_SECRET);
    if (isAdmin) {
      return jsonResponse({ keys: await listApiKeys(env) }, corsHeaders);
    }
    const wireKey = extractWireKey(request);
    const validKey = wireKey ? await validateApiKey(wireKey, env) : null;
    if (validKey) {
      const keys = await listApiKeys(env, env.ENVIRONMENT === 'production' ? validKey.id : undefined);
      return jsonResponse({ keys }, corsHeaders);
    }
    if (env.ENVIRONMENT === 'production') {
      return jsonResponse(
        { error: 'Unauthorized: Provide X-AgentWire-Key or Authorization: Bearer wire_live_... to inspect your API key.' },
        corsHeaders,
        401
      );
    }
    const keys = await listApiKeys(env);
    return jsonResponse({ keys }, corsHeaders);
  }

  if (path === '/api/keys' && request.method === 'POST') {
    const rate = checkRateLimit(`auth:keys:${clientIp}`, 20, 15 * 60 * 1000);
    if (!rate.allowed) {
      return rateLimitExceededResponse(20, rate.resetAfterSec, 'Rate limit exceeded on API key creation.', corsHeaders);
    }
    try {
      let body: any = {};
      try {
        body = await readJsonBody(request);
      } catch (parseErr: any) {
        if (parseErr instanceof PayloadTooLargeError) throw parseErr;
        body = {};
      }
      if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length > 100)) {
        return jsonResponse({ error: 'Key "name" must be a string up to 100 characters.' }, corsHeaders, 400);
      }
      const name = (body.name || 'Personal API Key').trim() || 'Personal API Key';
      const { key, record } = await createApiKey(name, env);
      return jsonResponse({ success: true, key, keyMeta: record }, corsHeaders, 201);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: err.message }, corsHeaders, 413);
      }
      return jsonResponse({ error: 'Failed to create API key.' }, corsHeaders, 400);
    }
  }

  const keyMatch = path.match(/^\/api\/keys\/([a-zA-Z0-9_-]+)$/);
  if (keyMatch && request.method === 'DELETE') {
    const rate = checkRateLimit(`auth:keys:${clientIp}`, 20, 15 * 60 * 1000);
    if (!rate.allowed) {
      return rateLimitExceededResponse(20, rate.resetAfterSec, 'Rate limit exceeded on API key revocation.', corsHeaders);
    }
    const targetId = keyMatch[1];
    const isAdmin = Boolean(env.ADMIN_SECRET && request.headers.get('X-Admin-Secret') === env.ADMIN_SECRET);
    if (!isAdmin && env.ENVIRONMENT === 'production') {
      const wireKey = extractWireKey(request);
      const validKey = wireKey ? await validateApiKey(wireKey, env) : null;
      if (!validKey) {
        return jsonResponse(
          { error: 'Unauthorized: Provide the AgentWire API key being revoked in X-AgentWire-Key or Authorization.' },
          corsHeaders,
          401
        );
      }
      const outcome = await revokeApiKey(targetId, env, validKey.keyHash);
      if (outcome === 'forbidden') {
        return jsonResponse({ error: 'Forbidden: You can only revoke your own API key.' }, corsHeaders, 403);
      }
      return jsonResponse({ success: true }, corsHeaders);
    }
    await revokeApiKey(targetId, env);
    return jsonResponse({ success: true }, corsHeaders);
  }

  // 3. Get single agent
  const agentMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)$/);
  if (agentMatch && request.method === 'GET') {
    const agent = await getAgent(agentMatch[1], env);
    if (!agent) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    return jsonResponse(sanitizeAgentForPublic(agent), corsHeaders);
  }

  // 4. Delete agent (with protected & private agent guards)
  if (agentMatch && request.method === 'DELETE') {
    const rate = checkRateLimit(`mutate:agents:${clientIp}`, 30, 60000);
    if (!rate.allowed) {
      return rateLimitExceededResponse(30, rate.resetAfterSec, 'Rate limit exceeded on agent deletion.', corsHeaders);
    }
    const id = agentMatch[1];
    const agent = await getAgent(id, env);
    if (!agent) {
      return jsonResponse({ error: 'Agent not found' }, corsHeaders, 404);
    }
    if (agent.isProtected) {
      return jsonResponse({ error: 'Starter agents are protected and cannot be deleted.' }, corsHeaders, 403);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }
    await deleteAgent(agent.id, env);
    return jsonResponse({ success: true }, corsHeaders);
  }

  // 5. Test/Probe an MCP server URL
  if (path === '/api/mcp/probe' && request.method === 'POST') {
    const rate = checkRateLimit(`mutate:probe:${clientIp}`, 30, 60000);
    if (!rate.allowed) {
      return rateLimitExceededResponse(30, rate.resetAfterSec, 'Rate limit exceeded on MCP probing.', corsHeaders);
    }
    try {
      const { url: mcpUrl, headers } = await readJsonBody(request);
      if (!mcpUrl || typeof mcpUrl !== 'string' || mcpUrl.length > 2048) {
        return jsonResponse({ success: false, error: 'Missing or invalid url parameter' }, corsHeaders, 400);
      }
      const safeHeaders = headers && typeof headers === 'object' && !Array.isArray(headers) ? headers : {};
      const tools = await probeMcpServer(mcpUrl, safeHeaders);
      return jsonResponse({ success: true, toolsCount: tools.length, tools }, corsHeaders);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ success: false, error: err.message }, corsHeaders, 413);
      }
      return jsonResponse(
        { success: false, error: scrubSecrets(err?.message || 'MCP probe failed') },
        corsHeaders,
        400
      );
    }
  }

  // 6. OpenRouter PKCE Code Exchange Proxy (Strict Auth Rate Limit: <= 10 attempts / 15 min, S256 only)
  if (path === '/api/auth/openrouter-exchange' && request.method === 'POST') {
    const authRate = checkRateLimit(`auth:openrouter:${clientIp}`, 10, 15 * 60 * 1000);
    if (!authRate.allowed) {
      return rateLimitExceededResponse(
        10,
        authRate.resetAfterSec,
        'Too many authentication attempts. Try again in 15 minutes.',
        corsHeaders
      );
    }
    try {
      const { code, code_verifier, code_challenge_method } = await readJsonBody(request);
      if (
        typeof code !== 'string' ||
        !code.trim() ||
        code.length > 512 ||
        typeof code_verifier !== 'string' ||
        !code_verifier.trim() ||
        code_verifier.length > 512 ||
        (code_challenge_method !== undefined && code_challenge_method !== 'S256')
      ) {
        return jsonResponse({ error: 'Invalid PKCE code, code_verifier, or code_challenge_method (S256 required).' }, corsHeaders, 400);
      }
      const resp = await fetch('https://openrouter.ai/api/v1/auth/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.trim(),
          code_verifier: code_verifier.trim(),
          code_challenge_method: 'S256'
        }),
        signal: AbortSignal.timeout(8000)
      });
      const data = await resp.json();
      return jsonResponse(data, corsHeaders, resp.status);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: err.message }, corsHeaders, 413);
      }
      return jsonResponse({ error: 'OpenRouter code exchange failed.' }, corsHeaders, 400);
    }
  }

  // 7. THE MAIN CURLABLE RUNNER: POST /api/agents/:id/run (Supports JSON & Real-Time SSE Streaming)
  const runMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/run$/);
  if (runMatch && request.method === 'POST') {
    const id = runMatch[1];
    const agent = await getAgent(id, env);

    if (!agent) {
      return jsonResponse({ error: `Agent "${id}" not found on this deployment.` }, corsHeaders, 404);
    }

    let payload: RunAgentRequest = { task: '' };
    try {
      payload = await readJsonBody<RunAgentRequest>(request);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: err.message }, corsHeaders, 413);
      }
      payload = { task: '' };
    }

    const exec = await executeAgentCore(agent, payload, request, env, corsHeaders);
    const execBody = exec.body as RunAgentResponse;

    const wantsStream =
      payload.stream === true ||
      (request.headers.get('Accept') || '').includes('text/event-stream');

    if (wantsStream && exec.status === 200) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          for (const step of execBody.steps || []) {
            controller.enqueue(encoder.encode(`event: step\ndata: ${JSON.stringify(step)}\n\n`));
          }
          const words = String(execBody.result || '').split(/(\s+)/);
          const chunkSize = Math.max(1, Math.ceil(words.length / 6));
          for (let i = 0; i < words.length; i += chunkSize) {
            const delta = words.slice(i, i + chunkSize).join('');
            if (delta) {
              controller.enqueue(encoder.encode(`event: delta\ndata: ${JSON.stringify({ delta })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`event: result\ndata: ${JSON.stringify(execBody)}\n\n`));
          controller.enqueue(encoder.encode(`event: done\ndata: [DONE]\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        status: 200,
        headers: {
          ...exec.headers,
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache'
        }
      });
    }

    return new Response(JSON.stringify(exec.body, null, 2), {
      status: exec.status,
      headers: exec.headers
    });
  }

  // 8. BUILT-IN AGENT EVALUATION SUITE: POST /api/agents/:id/eval
  const evalMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/eval$/);
  if (evalMatch && request.method === 'POST') {
    if (!evaluatedFlags.values.evalSuite) {
      return jsonResponse({ error: 'Evaluation suite is disabled by feature flag.' }, corsHeaders, 503);
    }
    const id = evalMatch[1];
    const agent = await getAgent(id, env);
    if (!agent) {
      return jsonResponse({ error: `Agent "${id}" not found.` }, corsHeaders, 404);
    }
    if (!(await authorizePrivateAgent(agent, request, env))) {
      return unauthorizedPrivateAgentResponse(corsHeaders);
    }

    let body: { cases?: AgentEvalCase[] } = {};
    try {
      body = await readJsonBody(request);
    } catch (err: any) {
      if (err instanceof PayloadTooLargeError) {
        return jsonResponse({ error: err.message }, corsHeaders, 413);
      }
    }

    const evalSummary = await runAgentEvaluationSuite(agent, body?.cases, request, env, corsHeaders);
    return jsonResponse(evalSummary, corsHeaders, 200, true);
  }

  // Fallback to Cloudflare Workers static assets if bound on non-API GET/HEAD requests
  if (
    env.ASSETS &&
    (request.method === 'GET' || request.method === 'HEAD') &&
    !path.startsWith('/api/') &&
    !path.startsWith('/v1/') &&
    !path.startsWith('/mcp') &&
    !path.startsWith('/.well-known/')
  ) {
    const assetRes = await env.ASSETS.fetch(request);
    const mergedHeaders = new Headers(assetRes.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      mergedHeaders.set(k, v);
    }
    return new Response(assetRes.body, { status: assetRes.status, headers: mergedHeaders });
  }

  // Default 404 for unmatched API routes
  return jsonResponse(
    { error: 'Endpoint not found. Use /api/health, /api/agents, /api/agents/:id/run, /mcp, /api/a2a, or /v1/chat/completions' },
    corsHeaders,
    404
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const reqStart = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = url.origin;
    const { traceId, traceparent } = getOrGenerateTrace(request);
    const incomingReqId = request.headers.get('X-Request-Id');
    const requestId =
      incomingReqId && /^[a-zA-Z0-9._-]{1,128}$/.test(incomingReqId)
        ? incomingReqId
        : `req_${traceId.slice(0, 16)}`;
    const allowedOrigin = resolveCorsOrigin(
      request.headers.get('Origin'),
      origin,
      env.ALLOWED_ORIGINS,
      env.ENVIRONMENT
    );

    const baseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Accept, Authorization, X-Request-Id, X-Admin-Secret, X-OpenRouter-Key, X-Agent-Key, X-AgentWire-Key, X-Session-ID, X-AgentWire-Session-Id, X-MCP-Authorization, X-MCP-Token, traceparent',
      'Access-Control-Expose-Headers':
        'X-Request-Id, X-AgentWire-Run-Id, X-AgentWire-Trace-Id, X-AgentWire-Duration-Ms, X-AgentWire-Session-Id, X-RateLimit-Limit, X-RateLimit-Remaining, traceparent',
      'X-Request-Id': requestId,
      traceparent,
      Link: AGENT_DISCOVERY_LINK_HEADER,
      'content-signal': CONTENT_SIGNAL_HEADER,
      Vary: 'Accept, Accept-Encoding, Origin',
      ...SECURITY_HEADERS
    };

    try {
      const response = await handleWorkerRequest(request, env, baseHeaders);
      const durationMs = Date.now() - reqStart;
      recordRequestMetric(path, response.status, durationMs);
      if (response.status >= 500) {
        logStructured('error', 'http.request_5xx', {
          requestId,
          traceId,
          entryPoint: path.startsWith('/mcp') ? 'mcp' : path.includes('/a2a') ? 'a2a' : path.startsWith('/v1/') ? 'openai_v1' : 'http',
          method: request.method,
          route: normalizeRouteTemplate(path),
          statusClass: classifyStatus(response.status),
          durationMs
        });
      }
      return response;
    } catch (err: any) {
      const durationMs = Date.now() - reqStart;
      recordRequestMetric(path, 500, durationMs);
      logStructured('error', 'http.unhandled_exception', {
        requestId,
        traceId,
        entryPoint: 'http',
        method: request.method,
        route: normalizeRouteTemplate(path),
        statusClass: '5xx',
        durationMs,
        reason: err?.message || String(err)
      });
      return jsonResponse(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Something went wrong'
          },
          requestId
        },
        baseHeaders,
        500
      );
    }
  }
};

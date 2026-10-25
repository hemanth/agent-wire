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
  wantsMarkdown,
  buildMarkdownOverview,
  buildMcpServerCard,
  buildA2AAgentCard,
  buildAgentSkillsIndex,
  getSkillMarkdownById,
  buildApiCatalog,
  buildAiCatalog,
  buildOAuthProtectedResource,
  WEB_BOT_AUTH_JWKS,
  buildAuthMd,
  buildRobotsTxt,
  buildOpenApiSpec
} from './protocols.ts';
import {
  type Env,
  type A2ATaskRecord,
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
  executeAgentCore,
  runAgentEvaluationSuite
} from './engine.ts';

export type { Env };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const origin = url.origin;

    // Universal CORS + Agent-Ready Level 5 Discovery Headers
    const corsHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-OpenRouter-Key, X-Agent-Key, X-AgentWire-Key, X-Session-ID, X-AgentWire-Session-Id, X-MCP-Authorization, X-MCP-Token, traceparent',
      Link: AGENT_DISCOVERY_LINK_HEADER,
      'content-signal': CONTENT_SIGNAL_HEADER,
      Vary: 'Accept'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // =========================================================================
    // 0. LEVEL 5 AGENT-NATIVE DISCOVERY & CONTENT NEGOTIATION ENDPOINTS
    // =========================================================================

    if ((path === '/' || path === '/index.html' || path === '/index.md') && request.method === 'GET') {
      if (path === '/index.md' || wantsMarkdown(request.headers.get('Accept'))) {
        const agents = await listAgents(env);
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
    }

    if ((path === '/llms.txt' || path === '/llms-full.txt') && request.method === 'GET') {
      const agents = await listAgents(env);
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
      return new Response(JSON.stringify(buildOpenApiSpec(origin), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (path === '/.well-known/mcp/server-card.json' && request.method === 'GET') {
      const agents = await listAgents(env);
      return new Response(JSON.stringify(buildMcpServerCard(origin, agents), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (path === '/.well-known/agent-card.json' && request.method === 'GET') {
      const agents = await listAgents(env);
      return new Response(JSON.stringify(buildA2AAgentCard(origin, agents), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (path === '/.well-known/agent-skills/index.json' && request.method === 'GET') {
      const index = await buildAgentSkillsIndex(origin);
      return new Response(JSON.stringify(index, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
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
      const agents = await listAgents(env);
      return new Response(JSON.stringify(buildAiCatalog(origin, agents), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (path === '/.well-known/oauth-protected-resource' && request.method === 'GET') {
      return new Response(JSON.stringify(buildOAuthProtectedResource(origin), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    if (path === '/.well-known/http-message-signatures-directory' && request.method === 'GET') {
      return new Response(JSON.stringify(WEB_BOT_AUTH_JWKS, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    // =========================================================================
    // 0b. NATIVE MODEL CONTEXT PROTOCOL (MCP) SERVER: /mcp and /api/mcp
    // =========================================================================
    if (path === '/mcp' || path === '/api/mcp') {
      if (request.method === 'GET') {
        const agents = await listAgents(env);
        return new Response(JSON.stringify(buildMcpServerCard(origin, agents), null, 2), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      if (request.method === 'POST') {
        try {
          const rpc: any = await request.json();
          const id = rpc.id ?? 1;
          const method = rpc.method;
          const params = rpc.params || {};
          const agents = await listAgents(env);

          if (method === 'initialize') {
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  protocolVersion: '2025-03-26',
                  serverInfo: { name: 'agent-wire-mcp', version: '2.0.0' },
                  capabilities: {
                    tools: { listChanged: true },
                    resources: { listChanged: true },
                    prompts: { listChanged: true }
                  }
                }
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (method === 'notifications/initialized' || method === 'ping') {
            return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: {} }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (method === 'tools/list') {
            const tools = [
              {
                name: 'list_agents',
                description: 'List all deployed AgentWire agents, their fallback models, MCP connectors, and skills.',
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
              ...agents.map(a => ({
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
            return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { tools } }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (method === 'tools/call') {
            const toolName: string = params.name || '';
            const toolArgs: any = params.arguments || {};

            if (toolName === 'list_agents') {
              return new Response(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [{ type: 'text', text: JSON.stringify(agents, null, 2) }]
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            if (toolName === 'eval_agent') {
              const target = await getAgent(toolArgs.agentId || 'agt_design_critic', env);
              if (!target) {
                return new Response(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id,
                    error: { code: -32602, message: `Agent not found: ${toolArgs.agentId}` }
                  }),
                  { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
              const summary = await runAgentEvaluationSuite(target, toolArgs.cases, request, env, corsHeaders);
              return new Response(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  result: {
                    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }],
                    structuredContent: summary,
                    isError: summary.failed > 0
                  }
                }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            let targetAgentId = toolArgs.agentId;
            if (!targetAgentId && toolName.startsWith('agent_')) {
              const slugPart = toolName.slice('agent_'.length);
              const matched = agents.find(
                a => a.slug.replace(/[^a-zA-Z0-9_]/g, '_') === slugPart || a.id === slugPart
              );
              if (matched) targetAgentId = matched.id;
            }

            const targetAgent = await getAgent(targetAgentId || 'agt_design_critic', env);
            if (!targetAgent) {
              return new Response(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id,
                  error: { code: -32602, message: `Agent not found for tool ${toolName}` }
                }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }

            const exec = await executeAgentCore(
              targetAgent,
              {
                task: toolArgs.input || toolArgs.task || toolArgs.prompt || 'Report capabilities',
                sessionId: toolArgs.sessionId,
                reasoningEffort: toolArgs.reasoningEffort
              },
              request,
              env,
              corsHeaders
            );

            const execBody = exec.body as RunAgentResponse;
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  content: [{ type: 'text', text: execBody.result || JSON.stringify(exec.body) }],
                  structuredContent: exec.body,
                  isError: exec.status >= 400,
                  _meta: {
                    runId: execBody.runId,
                    traceId: execBody.traceId,
                    modelUsed: execBody.modelUsed,
                    durationMs: execBody.durationMs
                  }
                }
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (method === 'resources/list') {
            const resources = [
              ...agents.map(a => ({
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
            return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { resources } }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (method === 'resources/read') {
            const uri: string = params.uri || '';
            if (uri.startsWith('agent://')) {
              const ag = await getAgent(uri.slice('agent://'.length), env);
              if (ag) {
                return new Response(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id,
                    result: {
                      contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(ag, null, 2) }]
                    }
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
            if (uri.startsWith('skill://')) {
              const skillMd = getSkillMarkdownById(uri.slice('skill://'.length));
              if (skillMd) {
                return new Response(
                  JSON.stringify({
                    jsonrpc: '2.0',
                    id,
                    result: {
                      contents: [{ uri, mimeType: 'text/markdown', text: skillMd }]
                    }
                  }),
                  { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                );
              }
            }
            return new Response(
              JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32002, message: `Resource not found: ${uri}` } }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          if (method === 'prompts/list') {
            const prompts = agents.map(a => ({
              name: a.slug,
              description: a.tagline,
              arguments: [{ name: 'task', description: 'Task to execute', required: true }]
            }));
            return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: { prompts } }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          if (method === 'prompts/get') {
            const ag = await getAgent(params.name || 'agt_design_critic', env);
            if (!ag) {
              return new Response(
                JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Prompt not found' } }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id,
                result: {
                  description: ag.tagline,
                  messages: [
                    { role: 'user', content: { type: 'text', text: `${ag.systemPrompt}\n\nTask: ${params.arguments?.task || ''}` } }
                  ]
                }
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unsupported MCP method: ${method}` } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: err.message } }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
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
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const agents = await listAgents(env);
      return new Response(JSON.stringify(buildA2AAgentCard(origin, agents, ag), null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' }
      });
    }

    const agentA2AMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/a2a$/);
    if ((path === '/api/a2a' || agentA2AMatch) && request.method === 'POST') {
      try {
        const rpc: any = await request.json();
        const rpcId = rpc.id ?? 'a2a_1';
        const method: string = rpc.method || 'tasks/send';
        const params: any = rpc.params || {};

        if (method === 'tasks/send' || method === 'message/send') {
          const targetAgentId = agentA2AMatch?.[1] || params.agentId || 'agt_design_critic';
          const targetAgent = await getAgent(targetAgentId, env);
          if (!targetAgent) {
            return new Response(
              JSON.stringify({ jsonrpc: '2.0', id: rpcId, error: { code: -32602, message: `Agent not found: ${targetAgentId}` } }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          const parts = params.message?.parts || [];
          const textPart = parts.find((p: any) => p.type === 'text')?.text || params.task || 'Execute A2A task';
          const taskId = params.id || `a2a_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

          const exec = await executeAgentCore(
            targetAgent,
            {
              task: textPart,
              sessionId: params.sessionId,
              reasoningEffort: params.reasoningEffort
            },
            request,
            env,
            corsHeaders
          );

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

          return new Response(JSON.stringify({ jsonrpc: '2.0', id: rpcId, result: taskRecord }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (method === 'tasks/get') {
          const taskRecord = getA2ATask(params.id);
          if (!taskRecord) {
            return new Response(
              JSON.stringify({ jsonrpc: '2.0', id: rpcId, error: { code: -32001, message: 'Task not found' } }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: rpcId, result: taskRecord }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (method === 'tasks/cancel') {
          const taskRecord = getA2ATask(params.id);
          if (!taskRecord) {
            return new Response(
              JSON.stringify({ jsonrpc: '2.0', id: rpcId, error: { code: -32001, message: 'Task not found' } }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          taskRecord.status = { state: 'canceled', timestamp: new Date().toISOString() };
          return new Response(JSON.stringify({ jsonrpc: '2.0', id: rpcId, result: taskRecord }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: rpcId, error: { code: -32601, message: `Unsupported A2A method: ${method}` } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: err.message } }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // =========================================================================
    // 0d. OPENAI-COMPATIBLE SDK ENDPOINTS: /v1/models, /v1/chat/completions, /v1/responses
    // =========================================================================
    if (path === '/v1/models' && request.method === 'GET') {
      const agents = await listAgents(env);
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
      return new Response(JSON.stringify({ object: 'list', data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (path === '/v1/chat/completions' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const requestedModel = body.model || 'agt_design_critic';
        const targetAgent = (await getAgent(requestedModel, env)) || (await listAgents(env))[0];
        const exec = await executeAgentCore(
          targetAgent,
          {
            messages: body.messages,
            task: body.prompt,
            maxTokens: body.max_tokens || body.max_completion_tokens,
            reasoningEffort: body.reasoning_effort,
            responseFormat: body.response_format?.type
          },
          request,
          env,
          corsHeaders
        );

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
        return new Response(JSON.stringify({ error: { message: err.message, type: 'invalid_request_error' } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/v1/responses' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const requestedModel = body.model || 'agt_design_critic';
        const targetAgent = (await getAgent(requestedModel, env)) || (await listAgents(env))[0];
        const inputStr =
          typeof body.input === 'string'
            ? body.input
            : Array.isArray(body.input)
            ? body.input.map((i: any) => i.content || i.text || '').join('\n')
            : 'Hello';

        const exec = await executeAgentCore(
          targetAgent,
          {
            task: inputStr,
            reasoningEffort: body.reasoning?.effort,
            maxTokens: body.max_output_tokens
          },
          request,
          env,
          corsHeaders
        );

        const execBody = exec.body as RunAgentResponse;
        const responsePayload = {
          id: `resp_${execBody.runId}`,
          object: 'response',
          created_at: Math.floor(Date.now() / 1000),
          status: exec.status >= 400 ? 'failed' : 'completed',
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
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 1. List all agents
    if (path === '/api/agents' && request.method === 'GET') {
      const list = await listAgents(env);
      return new Response(JSON.stringify(list), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 2. Create / Deploy an agent
    if (path === '/api/agents' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const id = body.id || `agt_${Math.random().toString(36).substring(2, 9)}`;
        const agent: Agent = {
          id,
          name: body.name || 'Untitled Agent',
          slug: body.slug || id,
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
          skills: body.skills || [],
          openRouterKey: body.openRouterKey || undefined,
          visibility: body.visibility === 'private' ? 'private' : 'public',
          ownerId: body.ownerId || 'usr_local',
          isProtected: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          invocationCount: 0
        };

        await saveAgent(agent, env);

        return new Response(JSON.stringify({ success: true, agent }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 2b. Run History Endpoint: GET /api/agents/:id/runs
    const runsMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/runs$/);
    if (runsMatch && request.method === 'GET') {
      const id = runsMatch[1];
      const agent = await getAgent(id, env);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      const runs = await listAgentRuns(agent.id, 30, env);
      return new Response(JSON.stringify({ runs }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 2c. Sessions & Memory Management Endpoints
    const sessionsMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/sessions$/);
    if (sessionsMatch) {
      const id = sessionsMatch[1];
      const agent = await getAgent(id, env);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (request.method === 'GET') {
        const sessions = await listSessions(agent.id, env);
        return new Response(JSON.stringify({ sessions }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (request.method === 'POST') {
        try {
          const body: any = await request.json().catch(() => ({}));
          const sessionId = body.sessionId || `ses_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const session: AgentSession = {
            id: sessionId,
            agentId: agent.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: body.messages || [],
            memory: body.memory || {},
            runsCount: 0
          };
          await saveSession(session, env);
          return new Response(JSON.stringify({ success: true, session }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
    }

    const sessionItemMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/sessions\/([a-zA-Z0-9_:-]+)$/);
    if (sessionItemMatch) {
      const agent = await getAgent(sessionItemMatch[1], env);
      const agentId = agent?.id || sessionItemMatch[1];
      const sessionId = sessionItemMatch[2];
      const session = await getSession(agentId, sessionId, env);
      if (request.method === 'GET') {
        if (!session) {
          return new Response(JSON.stringify({ error: 'Session not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
        return new Response(JSON.stringify(session), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      if (request.method === 'DELETE') {
        await deleteSession(agentId, sessionId, env);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 2d. API Key Management Endpoints
    if (path === '/api/keys' && request.method === 'GET') {
      const keys = await listApiKeys(env);
      return new Response(JSON.stringify({ keys }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (path === '/api/keys' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const name = body.name || 'Personal API Key';
        const { key, record } = await createApiKey(name, env);
        return new Response(JSON.stringify({ success: true, key, keyMeta: record }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    const keyMatch = path.match(/^\/api\/keys\/([a-zA-Z0-9_-]+)$/);
    if (keyMatch && request.method === 'DELETE') {
      const keyId = keyMatch[1];
      await revokeApiKey(keyId, env);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 3. Get single agent
    const agentMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)$/);
    if (agentMatch && request.method === 'GET') {
      const id = agentMatch[1];
      const agent = await getAgent(id, env);
      if (!agent) {
        return new Response(JSON.stringify({ error: 'Agent not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      return new Response(JSON.stringify(agent), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 4. Delete agent (with protected agent guard)
    if (agentMatch && request.method === 'DELETE') {
      const id = agentMatch[1];
      const agent = await getAgent(id, env);
      if (agent?.isProtected) {
        return new Response(JSON.stringify({ error: 'Starter agents are protected and cannot be deleted.' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
      await deleteAgent(agent?.id || id, env);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 5. Test/Probe an MCP server URL
    if (path === '/api/mcp/probe' && request.method === 'POST') {
      try {
        const { url: mcpUrl, headers } = (await request.json()) as any;
        if (!mcpUrl) throw new Error('Missing url parameter');
        const tools = await probeMcpServer(mcpUrl, headers || {});
        return new Response(JSON.stringify({ success: true, toolsCount: tools.length, tools }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 6. OpenRouter PKCE Code Exchange Proxy
    if (path === '/api/auth/openrouter-exchange' && request.method === 'POST') {
      try {
        const { code, code_verifier, code_challenge_method } = (await request.json()) as any;
        const resp = await fetch('https://openrouter.ai/api/v1/auth/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            code_verifier,
            code_challenge_method: code_challenge_method || 'S256'
          })
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          status: resp.status,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 7. THE MAIN CURLABLE RUNNER: POST /api/agents/:id/run (Supports JSON & Real-Time SSE Streaming)
    const runMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/run$/);
    if (runMatch && request.method === 'POST') {
      const id = runMatch[1];
      const agent = await getAgent(id, env);

      if (!agent) {
        return new Response(JSON.stringify({ error: `Agent "${id}" not found on this deployment.` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let payload: RunAgentRequest;
      try {
        payload = await request.json();
      } catch {
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
      const id = evalMatch[1];
      const agent = await getAgent(id, env);
      if (!agent) {
        return new Response(JSON.stringify({ error: `Agent "${id}" not found.` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      let body: { cases?: AgentEvalCase[] } = {};
      try {
        body = await request.json();
      } catch {}

      const evalSummary = await runAgentEvaluationSuite(agent, body.cases, request, env, corsHeaders);

      return new Response(JSON.stringify(evalSummary, null, 2), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Default 404 for unmatched API routes
    return new Response(JSON.stringify({ error: 'Endpoint not found. Use /api/agents, /api/agents/:id/run, /mcp, /api/a2a, or /v1/chat/completions' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

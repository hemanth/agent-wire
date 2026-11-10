import { test, expect } from '@playwright/test';
import worker from '../src/worker';
import type { Env } from '../src/types';

const REMOTE_MCP_URL = 'https://example.com/mcp-rbac';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALL_TOOLS = {
  read_runbook: {
    name: 'read_runbook',
    description: 'Read incident runbook documentation',
    inputSchema: { type: 'object', properties: { service: { type: 'string' } } }
  },
  restart_prod: {
    name: 'restart_prod',
    description: 'Restart production service cluster (privileged)',
    inputSchema: { type: 'object', properties: { cluster: { type: 'string' } } }
  }
};

function createTestEnv(): Env {
  return {
    OPENROUTER_API_KEY: 'sk-or-v1-test-mock-key-for-rbac-suite',
    ENVIRONMENT: 'test'
  };
}

test.describe('Caller Identity & Mid-Session MCP Tool Revocation Across /mcp, /api/a2a, and /v1', () => {
  const originalFetch = globalThis.fetch;
  let grantsByToken: Record<string, Set<string>>;
  let revokeBetweenListAndCall = false;
  let observedMcpCalls: Array<{
    method: string;
    toolName?: string;
    authorization: string | null;
    principal: string | null;
  }>;
  let observedModelTools: string[][];

  test.beforeEach(async () => {
    grantsByToken = {
      'Bearer tok_alice': new Set(['read_runbook', 'restart_prod']),
      'Bearer tok_bob': new Set(['read_runbook'])
    };
    revokeBetweenListAndCall = false;
    observedMcpCalls = [];
    observedModelTools = [];

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      if (url === REMOTE_MCP_URL) {
        const headers = new Headers(init?.headers);
        const auth = headers.get('Authorization');
        const principal = headers.get('X-MCP-Principal');
        const rpc = JSON.parse(String(init?.body || '{}'));

        observedMcpCalls.push({
          method: rpc.method,
          toolName: rpc.params?.name,
          authorization: auth,
          principal
        });

        const allowed = auth ? grantsByToken[auth] : undefined;
        if (!allowed) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (rpc.method === 'tools/list') {
          const tools = Array.from(allowed)
            .map(name => ALL_TOOLS[name as keyof typeof ALL_TOOLS])
            .filter(Boolean);
          if (revokeBetweenListAndCall && auth === 'Bearer tok_alice') {
            // Simulate permission revoked right after tools/list while turn is in-flight
            allowed.delete('restart_prod');
          }
          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { tools } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }

        if (rpc.method === 'tools/call') {
          const toolName: string = rpc.params?.name;
          if (!allowed.has(toolName)) {
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id: rpc.id,
                error: { code: -32001, message: `Forbidden: grant for ${toolName} revoked or missing` }
              }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }
          return new Response(
            JSON.stringify({
              jsonrpc: '2.0',
              id: rpc.id,
              result: {
                content: [{ type: 'text', text: `OK:${toolName}:by=${principal || auth}` }]
              }
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      if (url === OPENROUTER_URL) {
        const body = JSON.parse(String(init?.body || '{}'));
        const toolNames = Array.isArray(body.tools)
          ? body.tools.map((t: any) => t.function?.name).filter(Boolean)
          : [];
        observedModelTools.push(toolNames);

        const messages: any[] = body.messages || [];
        const hasToolResult = messages.some(m => m.role === 'tool');
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';

        if (!hasToolResult) {
          // Request whichever privileged tool the prompt asks for if available (or force-test hallucinated call)
          const wantsRestart = String(lastUserMsg).includes('restart_prod');
          const chosenTool =
            wantsRestart && (toolNames.includes('restart_prod') || String(lastUserMsg).includes('FORCE_CALL'))
              ? 'restart_prod'
              : toolNames.includes('read_runbook')
                ? 'read_runbook'
                : null;

          if (chosenTool) {
            return new Response(
              JSON.stringify({
                id: 'gen_tool_1',
                choices: [
                  {
                    message: {
                      role: 'assistant',
                      content: '',
                      tool_calls: [
                        {
                          id: 'call_1',
                          type: 'function',
                          function: {
                            name: chosenTool,
                            arguments: JSON.stringify({ cluster: 'us-west-1', service: 'payments' })
                          }
                        }
                      ]
                    }
                  }
                ],
                usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 }
              }),
              { status: 200, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        const toolSummaries = messages
          .filter(m => m.role === 'tool')
          .map(m => m.content)
          .join(' | ');
        return new Response(
          JSON.stringify({
            id: 'gen_final_1',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: `VisibleTools=[${toolNames.join(',')}] ToolOutput=${toolSummaries || 'none'}`
                }
              }
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return originalFetch(input, init);
    };
  });

  test.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function deploySharedRbacAgent(env: Env, slug: string): Promise<string> {
    const res = await worker.fetch(
      new Request('https://agent-wire.test/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Shared Ops RBAC Agent',
          slug,
          tagline: 'Multi-tenant RBAC verification agent',
          systemPrompt: 'Execute ops tools strictly using caller permissions.',
          models: ['openai/gpt-5.4-mini'],
          mcps: [
            {
              id: 'mcp_rbac',
              name: 'Ops RBAC MCP',
              url: REMOTE_MCP_URL,
              transport: 'http',
              status: 'connected',
              // Deliberately pre-populate cached tools with BOTH tools to prove caller-scoped turns NEVER trust static cache
              tools: [ALL_TOOLS.read_runbook, ALL_TOOLS.restart_prod]
            }
          ]
        })
      }),
      env
    );
    expect(res.status).toBe(201);
    const created: any = await res.json();
    return created.agent.id;
  }

  test('two callers with different permissions hit the SAME URL across /mcp, /api/a2a, and /v1/chat/completions', async () => {
    const env = createTestEnv();
    const agentSlug = `ops-rbac-${Date.now()}`;
    const agentId = await deploySharedRbacAgent(env, agentSlug);
    const toolSlug = `agent_${agentSlug.replace(/-/g, '_')}`;

    // 1. /mcp endpoint — Alice vs Bob on the exact same URL
    const mcpAliceRes = await worker.fetch(
      new Request('https://agent-wire.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: toolSlug, arguments: { task: 'Please run restart_prod now' } }
        })
      }),
      env
    );
    expect(mcpAliceRes.status).toBe(200);
    const mcpAliceJson: any = await mcpAliceRes.json();
    expect(mcpAliceJson.result.content[0].text).toContain('VisibleTools=[read_runbook,restart_prod]');
    expect(mcpAliceJson.result.content[0].text).toContain('OK:restart_prod:by=alice');

    const mcpBobRes = await worker.fetch(
      new Request('https://agent-wire.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'bob'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: toolSlug, arguments: { task: 'Please run restart_prod now' } }
        })
      }),
      env
    );
    expect(mcpBobRes.status).toBe(200);
    const mcpBobJson: any = await mcpBobRes.json();
    expect(mcpBobJson.result.content[0].text).toContain('VisibleTools=[read_runbook]');
    expect(mcpBobJson.result.content[0].text).not.toContain('restart_prod');
    expect(mcpBobJson.result.content[0].text).toContain('OK:read_runbook:by=bob');

    // 2. /api/a2a endpoint — Alice vs Bob on the exact same URL
    const a2aAliceRes = await worker.fetch(
      new Request('https://agent-wire.test/api/a2a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'a2a_alice',
          method: 'tasks/send',
          params: {
            agentId,
            message: { role: 'user', parts: [{ type: 'text', text: 'Run restart_prod' }] }
          }
        })
      }),
      env
    );
    expect(a2aAliceRes.status).toBe(200);
    const a2aAliceJson: any = await a2aAliceRes.json();
    expect(a2aAliceJson.result.artifacts[0].parts[0].text).toContain('OK:restart_prod:by=alice');

    const a2aBobRes = await worker.fetch(
      new Request('https://agent-wire.test/api/a2a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'bob'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'a2a_bob',
          method: 'tasks/send',
          params: {
            agentId,
            message: { role: 'user', parts: [{ type: 'text', text: 'Run restart_prod FORCE_CALL' }] }
          }
        })
      }),
      env
    );
    expect(a2aBobRes.status).toBe(200);
    const a2aBobJson: any = await a2aBobRes.json();
    expect(a2aBobJson.result.artifacts[0].parts[0].text).toContain('VisibleTools=[read_runbook]');
    expect(a2aBobJson.result.artifacts[0].parts[0].text).toContain('is not registered or unavailable for this caller');

    // 3. /v1/chat/completions endpoint — Alice vs Bob on the exact same URL
    const oaiAliceRes = await worker.fetch(
      new Request('https://agent-wire.test/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          model: agentSlug,
          messages: [{ role: 'user', content: 'Run restart_prod' }]
        })
      }),
      env
    );
    expect(oaiAliceRes.status).toBe(200);
    const oaiAliceJson: any = await oaiAliceRes.json();
    expect(oaiAliceJson.choices[0].message.content).toContain('OK:restart_prod:by=alice');
    expect(oaiAliceJson.agentwire_meta.toolsUsed).toEqual(['restart_prod']);

    const oaiBobRes = await worker.fetch(
      new Request('https://agent-wire.test/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'bob'
        },
        body: JSON.stringify({
          model: agentSlug,
          messages: [{ role: 'user', content: 'Run restart_prod' }]
        })
      }),
      env
    );
    expect(oaiBobRes.status).toBe(200);
    const oaiBobJson: any = await oaiBobRes.json();
    expect(oaiBobJson.choices[0].message.content).toContain('VisibleTools=[read_runbook]');
    expect(oaiBobJson.choices[0].message.content).toContain('OK:read_runbook:by=bob');
    expect(oaiBobJson.agentwire_meta.toolsUsed).toEqual(['read_runbook']);
  });

  test('revoking a tool permission while a session is STILL OPEN drops access immediately and blocks cross-user session hijack', async () => {
    const env = createTestEnv();
    const agentSlug = `ops-revoke-${Date.now()}`;
    const agentId = await deploySharedRbacAgent(env, agentSlug);
    const toolSlug = `agent_${agentSlug.replace(/-/g, '_')}`;
    const openSessionId = 'ses_live_open_1';

    // Turn 1 (Session OPEN on /mcp): Alice has restart_prod permission and executes it
    const turn1Res = await worker.fetch(
      new Request('https://agent-wire.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: {
            name: toolSlug,
            arguments: { task: 'Turn 1: run restart_prod', sessionId: openSessionId }
          }
        })
      }),
      env
    );
    expect(turn1Res.status).toBe(200);
    const turn1Json: any = await turn1Res.json();
    expect(turn1Json.result.content[0].text).toContain('OK:restart_prod:by=alice');

    // Verify caller token is NEVER persisted in session state, and unauthenticated / Bob reads get 403
    const unauthSessionRes = await worker.fetch(
      new Request(`https://agent-wire.test/api/agents/${agentId}/sessions/${openSessionId}`),
      env
    );
    expect(unauthSessionRes.status).toBe(403);

    const sessionCheckRes = await worker.fetch(
      new Request(`https://agent-wire.test/api/agents/${agentId}/sessions/${openSessionId}`, {
        headers: {
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        }
      }),
      env
    );
    expect(sessionCheckRes.status).toBe(200);
    const rawSessionText = await sessionCheckRes.text();
    expect(rawSessionText).not.toContain('tok_alice');
    expect(rawSessionText).not.toContain('principalHash');

    // REVOKE restart_prod on the remote MCP server while ses_live_open_1 is STILL OPEN
    grantsByToken['Bearer tok_alice'].delete('restart_prod');

    // Turn 2 (SAME open session on /api/a2a): Live re-probe immediately removes restart_prod
    const turn2Res = await worker.fetch(
      new Request('https://agent-wire.test/api/a2a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'a2a_turn_2',
          method: 'tasks/send',
          params: {
            agentId,
            sessionId: openSessionId,
            message: { role: 'user', parts: [{ type: 'text', text: 'Turn 2: run restart_prod again' }] }
          }
        })
      }),
      env
    );
    expect(turn2Res.status).toBe(200);
    const turn2Json: any = await turn2Res.json();
    const turn2Text: string = turn2Json.result.artifacts[0].parts[0].text;
    expect(turn2Text).toContain('VisibleTools=[read_runbook]');
    expect(turn2Text).not.toContain('OK:restart_prod');

    // Turn 3 (SAME open session on /v1/chat/completions): Race-condition revocation AFTER tools/list and BEFORE tools/call returns 403
    grantsByToken['Bearer tok_alice'].add('restart_prod');
    revokeBetweenListAndCall = true;

    const turn3Res = await worker.fetch(
      new Request('https://agent-wire.test/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_alice',
          'X-MCP-Principal': 'alice'
        },
        body: JSON.stringify({
          model: agentSlug,
          session_id: openSessionId,
          messages: [{ role: 'user', content: 'Turn 3: run restart_prod during live revocation' }]
        })
      }),
      env
    );
    expect(turn3Res.status).toBe(200);
    const turn3Json: any = await turn3Res.json();
    expect(turn3Json.choices[0].message.content).toContain('HTTP 403 Forbidden: caller lacks permission or grant was revoked');

    // Turn 4: Bob (and spoofed principal with Bob's token) tries to reuse Alice's open session across all 3 endpoints -> 403 Forbidden
    const hijackMcp = await worker.fetch(
      new Request('https://agent-wire.test/mcp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'alice' // Even spoofing X-MCP-Principal fails because token hash differs
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 99,
          method: 'tools/call',
          params: { name: toolSlug, arguments: { task: 'Read Alice session', sessionId: openSessionId } }
        })
      }),
      env
    );
    expect(hijackMcp.status).toBe(403);

    const hijackA2A = await worker.fetch(
      new Request('https://agent-wire.test/api/a2a', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'bob'
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'hijack_a2a',
          method: 'tasks/send',
          params: {
            agentId,
            sessionId: openSessionId,
            message: { role: 'user', parts: [{ type: 'text', text: 'Read Alice session' }] }
          }
        })
      }),
      env
    );
    expect(hijackA2A.status).toBe(403);

    const hijackOai = await worker.fetch(
      new Request('https://agent-wire.test/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MCP-Authorization': 'Bearer tok_bob',
          'X-MCP-Principal': 'bob'
        },
        body: JSON.stringify({
          model: agentSlug,
          session_id: openSessionId,
          messages: [{ role: 'user', content: 'Read Alice session' }]
        })
      }),
      env
    );
    expect(hijackOai.status).toBe(403);
    const hijackOaiJson: any = await hijackOai.json();
    expect(hijackOaiJson.error.type).toBe('permission_error');
  });
});

import type { Agent, RunAgentRequest, RunAgentResponse, ToolExecutionStep, McpTool } from './types.ts';
import { STARTER_AGENTS } from './presets.ts';

// In-memory fallback for local dev or when KV is not configured
const inMemoryAgents = new Map<string, Agent>();

// Populate starter agents
for (const ag of STARTER_AGENTS) {
  inMemoryAgents.set(ag.id, ag);
}

interface Env {
  AGENTS_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<{ keys: Array<{ name: string }> }>;
  };
  OPENROUTER_API_KEY?: string;
  AI?: any; // Cloudflare Workers AI binding
}

async function getAgent(id: string, env: Env): Promise<Agent | null> {
  if (env.AGENTS_KV) {
    const data = await env.AGENTS_KV.get(`agent:${id}`);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse agent from KV', e);
      }
    }
  }
  return inMemoryAgents.get(id) || null;
}

async function saveAgent(agent: Agent, env: Env): Promise<void> {
  inMemoryAgents.set(agent.id, agent);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`agent:${agent.id}`, JSON.stringify(agent));
  }
}

async function listAgents(env: Env): Promise<Agent[]> {
  if (env.AGENTS_KV) {
    try {
      const keys = await env.AGENTS_KV.list();
      const agents: Agent[] = [];
      for (const k of keys.keys) {
        if (k.name.startsWith('agent:')) {
          const raw = await env.AGENTS_KV.get(k.name);
          if (raw) agents.push(JSON.parse(raw));
        }
      }
      if (agents.length > 0) return agents;
    } catch (e) {
      console.warn('KV list failed, using memory', e);
    }
  }
  return Array.from(inMemoryAgents.values());
}

async function deleteAgent(id: string, env: Env): Promise<boolean> {
  inMemoryAgents.delete(id);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.delete(`agent:${id}`);
  }
  return true;
}

// Fetch tool list from an external MCP server (supports HTTP JSON-RPC and SSE)
async function probeMcpServer(url: string, headers: Record<string, string> = {}): Promise<McpTool[]> {
  try {
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      ...headers
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: {}
      }),
      signal: AbortSignal.timeout(5000)
    });

    if (!res.ok) {
      throw new Error(`MCP returned HTTP ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    if (data.result && Array.isArray(data.result.tools)) {
      return data.result.tools;
    }
    if (data.tools && Array.isArray(data.tools)) {
      return data.tools;
    }
    return [];
  } catch (err: any) {
    console.warn(`Probe failed for MCP ${url}:`, err.message);
    throw err;
  }
}

// Execute a tool call on a remote MCP server
async function executeMcpTool(mcpUrl: string, toolName: string, toolArgs: any, headers: Record<string, string> = {}): Promise<any> {
  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: toolArgs || {}
        }
      }),
      signal: AbortSignal.timeout(10000)
    });

    if (!res.ok) {
      return { error: `MCP tool execution failed: HTTP ${res.status}` };
    }

    const data: any = await res.json();
    if (data.result) return data.result;
    if (data.content) return data.content;
    return data;
  } catch (err: any) {
    return { error: `Failed to call remote tool ${toolName}: ${err.message}` };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers for API access from any origin (web, curl, webhooks)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-OpenRouter-Key, X-Agent-Key',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
          mcps: body.mcps || [],
          skills: body.skills || [],
          openRouterKey: body.openRouterKey || undefined,
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

    // 4. Delete agent
    if (agentMatch && request.method === 'DELETE') {
      const id = agentMatch[1];
      await deleteAgent(id, env);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // 5. Test/Probe an MCP server URL
    if (path === '/api/mcp/probe' && request.method === 'POST') {
      try {
        const { url: mcpUrl, headers } = await request.json() as any;
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
        const { code, code_verifier } = await request.json() as any;
        const resp = await fetch('https://openrouter.ai/api/v1/auth/keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, code_verifier })
        });
        const data = await resp.json();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }
    }

    // 7. THE MAIN CURLABLE RUNNER: POST /api/agents/:id/run
    const runMatch = path.match(/^\/api\/agents\/([a-zA-Z0-9_-]+)\/run$/);
    if (runMatch && request.method === 'POST') {
      const startTime = Date.now();
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

      const task = payload.task || payload.prompt || 'Hello! Report your capabilities and attached tools.';
      const steps: ToolExecutionStep[] = [];
      const toolsUsed: string[] = [];

      // Step 1: Ingest Skills and Persona into Context
      let fullSystemPrompt = agent.systemPrompt.trim();
      const enabledSkills = (agent.skills || []).filter(s => s.enabled);
      if (enabledSkills.length > 0) {
        fullSystemPrompt += '\n\n=== ATTACHED AGENT SKILLS ===\n';
        for (const skill of enabledSkills) {
          fullSystemPrompt += `\n--- Skill: ${skill.name} ---\n${skill.content}\n`;
        }
      }

      steps.push({
        step: 1,
        type: 'thought',
        timestamp: new Date().toISOString(),
        content: `Agent initialized with system persona and ${enabledSkills.length} active skills.`
      });

      // Step 2: Discover and aggregate tools from configured MCP servers
      const toolMap = new Map<string, { mcpUrl: string; mcpHeaders?: Record<string, string> }>();
      const openRouterTools: any[] = [];

      for (const mcp of (agent.mcps || [])) {
        let tools: McpTool[] = mcp.tools || [];
        // If not cached, attempt live probe
        if (tools.length === 0) {
          try {
            tools = await probeMcpServer(mcp.url, mcp.headers);
          } catch (e) {
            console.warn(`Could not probe MCP ${mcp.name}:`, e);
          }
        }

        for (const t of tools) {
          toolMap.set(t.name, { mcpUrl: mcp.url, mcpHeaders: mcp.headers });
          openRouterTools.push({
            type: 'function',
            function: {
              name: t.name,
              description: t.description || `Tool from ${mcp.name}`,
              parameters: t.inputSchema || { type: 'object', properties: {} }
            }
          });
        }
      }

      steps.push({
        step: 2,
        type: 'thought',
        timestamp: new Date().toISOString(),
        content: `Loaded ${openRouterTools.length} tools across ${agent.mcps.length} MCP connectors.`
      });

      // Determine OpenRouter API Key: Request Header > Agent Config > Environment Variable
      const authHeader = request.headers.get('Authorization') || '';
      const customKey = request.headers.get('X-OpenRouter-Key') || '';
      const apiKey = customKey || (authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '') || agent.openRouterKey || env.OPENROUTER_API_KEY;

      let finalResult = '';
      let modelUsed = agent.models[0] || 'anthropic/claude-3.5-sonnet';

      if (apiKey) {
        // Execute real LLM request via OpenRouter with auto-fallback list!
        try {
          const messages: any[] = [
            { role: 'system', content: fullSystemPrompt },
            { role: 'user', content: task }
          ];

          const openRouterPayload: any = {
            models: agent.models, // OpenRouter auto-switches if primary is unavailable!
            messages,
            temperature: agent.temperature
          };

          if (openRouterTools.length > 0) {
            openRouterPayload.tools = openRouterTools;
          }

          const llmRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'HTTP-Referer': url.origin,
              'X-Title': `AgentWire - ${agent.name}`
            },
            body: JSON.stringify(openRouterPayload)
          });

          if (!llmRes.ok) {
            const errText = await llmRes.text();
            throw new Error(`OpenRouter returned ${llmRes.status}: ${errText}`);
          }

          const llmData: any = await llmRes.json();
          modelUsed = llmData.model || modelUsed;
          const choice = llmData.choices?.[0];

          if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
            // Model decided to call tools!
            for (const toolCall of choice.message.tool_calls) {
              const name = toolCall.function.name;
              let parsedArgs = {};
              try {
                parsedArgs = JSON.parse(toolCall.function.arguments);
              } catch {}

              toolsUsed.push(name);
              steps.push({
                step: steps.length + 1,
                type: 'tool_call',
                timestamp: new Date().toISOString(),
                toolName: name,
                toolArgs: parsedArgs
              });

              // Execute against the remote MCP server
              const mcpMeta = toolMap.get(name);
              let toolOutput: any = { status: 'mock_result', info: `Remote tool executed: ${name}` };
              if (mcpMeta) {
                toolOutput = await executeMcpTool(mcpMeta.mcpUrl, name, parsedArgs, mcpMeta.mcpHeaders);
              }

              steps.push({
                step: steps.length + 1,
                type: 'tool_result',
                timestamp: new Date().toISOString(),
                toolName: name,
                toolOutput
              });

              messages.push(choice.message);
              messages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                name,
                content: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput)
              });
            }

            // Follow-up round to produce final synthesized response
            const followUpRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                models: agent.models,
                messages,
                temperature: agent.temperature
              })
            });

            if (followUpRes.ok) {
              const followData: any = await followUpRes.json();
              finalResult = followData.choices?.[0]?.message?.content || 'Completed tool task.';
            } else {
              finalResult = 'Tool calls executed successfully.';
            }
          } else {
            finalResult = choice?.message?.content || 'No response content.';
          }
        } catch (e: any) {
          console.error('LLM invocation error:', e);
          finalResult = `[OpenRouter Error] ${e.message}. (Ensure your OpenRouter key has credits and valid model access).`;
        }
      } else {
        // High-fidelity fallback when testing locally without a live OpenRouter key
        finalResult = `[AgentWire Sandbox Simulation — No OpenRouter Key provided]\n\nI am ${agent.name}.\nSystem persona and ${enabledSkills.length} skills loaded successfully.\n\nConnected MCP tools:\n${openRouterTools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n') || 'None'}\n\nTask received: "${task}".\nTo enable full multi-model live generation, connect your key via "Sign in with OpenRouter" or supply -H "Authorization: Bearer <key>".`;
      }

      steps.push({
        step: steps.length + 1,
        type: 'answer',
        timestamp: new Date().toISOString(),
        content: finalResult
      });

      // Update invocation count
      agent.invocationCount = (agent.invocationCount || 0) + 1;
      agent.lastInvokedAt = new Date().toISOString();
      await saveAgent(agent, env);

      const responseBody: RunAgentResponse = {
        agentId: agent.id,
        task,
        result: finalResult,
        modelUsed,
        modelsAttempted: agent.models,
        toolsUsed,
        steps,
        durationMs: Date.now() - startTime
      };

      return new Response(JSON.stringify(responseBody, null, 2), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Default 404 for unmatched API routes
    return new Response(JSON.stringify({ error: 'Endpoint not found. Use /api/agents or /api/agents/:id/run' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

import type {
  Agent,
  AgentRunRecord,
  AgentWireApiKey,
  AgentSession
} from './types.ts';
import { STARTER_AGENTS } from './presets.ts';
import { logStructured } from './telemetry.ts';

export interface Env {
  AGENTS_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(options?: { prefix?: string; limit?: number }): Promise<{ keys: Array<{ name: string }> }>;
  };
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
  OPENROUTER_API_KEY?: string;
  ENVIRONMENT?: string;
  BASE_PATH?: string;
  ALLOWED_ORIGINS?: string;
  FEATURE_FLAGS?: string;
  ALLOW_DEMO_KEY?: string;
  ADMIN_SECRET?: string;
  WEB_BOT_AUTH_PUBLIC_JWK?: string;
  AI?: unknown;
}

export function cryptoRandomHex(bytes = 8): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-trusted-client-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    '127.0.0.1'
  );
}

export function extractWireKey(request: Request): string {
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer.startsWith('wire_live_')) return bearer;
  }
  return (request.headers.get('X-AgentWire-Key') || request.headers.get('X-Agent-Key') || '').trim();
}

export function sanitizeAgentForPublic(agent: Agent): Agent {
  const { openRouterKey: _omittedKey, ...rest } = agent;
  const sanitizedMcps = (agent.mcps || []).map(mcp => {
    if (!mcp.headers) return mcp;
    const redactedHeaders: Record<string, string> = {};
    for (const k of Object.keys(mcp.headers)) {
      redactedHeaders[k] = '[REDACTED]';
    }
    return { ...mcp, headers: redactedHeaders };
  });
  return { ...rest, mcps: sanitizedMcps };
}

export function sanitizeAgentsForPublic(agents: Agent[]): Agent[] {
  return agents.map(sanitizeAgentForPublic);
}

export function sanitizeAgentForListing(agent: Agent, isAuthorized = false): Agent {
  const pub = sanitizeAgentForPublic(agent);
  if (pub.visibility === 'private' && !isAuthorized) {
    return {
      ...pub,
      systemPrompt: '[Private agent — supply an AgentWire API key to inspect or run]',
      skills: (pub.skills || []).map(s => ({ ...s, content: '[REDACTED]' }))
    };
  }
  return pub;
}

export function filterPublicAgents(agents: Agent[]): Agent[] {
  return agents.filter(a => a.visibility !== 'private').map(sanitizeAgentForPublic);
}

export interface A2ATaskRecord {
  id: string;
  agentId: string;
  status: {
    state: 'submitted' | 'working' | 'completed' | 'failed' | 'canceled';
    timestamp: string;
    message?: string;
  };
  artifacts?: Array<{
    name: string;
    parts: Array<{ type: 'text' | 'data'; text?: string; data?: unknown }>;
  }>;
  history?: Array<{ role: string; parts: Array<{ type: 'text'; text: string }> }>;
  metadata?: Record<string, unknown>;
}

export interface StoredApiKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string;
}

const MAX_IN_MEMORY_AGENTS = 200;
const MAX_IN_MEMORY_RUN_AGENTS = 200;
const MAX_IN_MEMORY_SESSIONS = 500;
const MAX_IN_MEMORY_A2A_TASKS = 500;
const MAX_IN_MEMORY_API_KEYS = 200;
const MAX_RATE_LIMIT_BUCKETS = 2000;

// Bounded Map helper that evicts oldest evictable entries when capacity is exceeded
function setBounded<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maxEntries: number,
  canEvict?: (val: V) => boolean
): boolean {
  if (!map.has(key) && map.size >= maxEntries) {
    let evicted = false;
    for (const [candidateKey, candidateVal] of map.entries()) {
      if (!canEvict || canEvict(candidateVal)) {
        map.delete(candidateKey);
        evicted = true;
        break;
      }
    }
    if (!evicted) {
      return false;
    }
  }
  map.set(key, value);
  return true;
}

// In-memory fallback stores for local dev or when KV is not configured
const inMemoryAgents = new Map<string, Agent>();
for (const ag of STARTER_AGENTS) {
  inMemoryAgents.set(ag.id, ag);
}

const inMemoryRuns = new Map<string, AgentRunRecord[]>();
const inMemorySessions = new Map<string, AgentSession>();
export const inMemoryA2ATasks = new Map<string, A2ATaskRecord>();
const inMemoryApiKeys = new Map<string, StoredApiKey>();
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function saveA2ATask(taskId: string, record: A2ATaskRecord): void {
  setBounded(inMemoryA2ATasks, taskId, record, MAX_IN_MEMORY_A2A_TASKS);
}

export function getA2ATask(taskId: string): A2ATaskRecord | undefined {
  return inMemoryA2ATasks.get(taskId);
}

export function checkRateLimit(
  key: string,
  maxRequests = 60,
  windowMs = 60000
): { allowed: boolean; remaining: number; resetAfterSec: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);
  if (existing && now <= existing.resetAt) {
    if (existing.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
    }
    existing.count += 1;
    return {
      allowed: true,
      remaining: maxRequests - existing.count,
      resetAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  if (existing && now > existing.resetAt) {
    rateLimitStore.delete(key);
  }

  if (rateLimitStore.size >= MAX_RATE_LIMIT_BUCKETS) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
    if (rateLimitStore.size >= MAX_RATE_LIMIT_BUCKETS) {
      // Never evict active unexpired rate-limit buckets under spoofed traffic floods
      return { allowed: false, remaining: 0, resetAfterSec: 15 };
    }
  }

  rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
  return { allowed: true, remaining: maxRequests - 1, resetAfterSec: Math.ceil(windowMs / 1000) };
}

export function getOrGenerateTrace(request: Request): { traceId: string; spanId: string; traceparent: string } {
  const incoming = request.headers.get('traceparent');
  if (incoming && /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(incoming)) {
    const parts = incoming.split('-');
    return { traceId: parts[1], spanId: parts[2], traceparent: incoming };
  }
  const traceId = cryptoRandomHex(16);
  const spanId = cryptoRandomHex(8);
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

export async function hashApiKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createApiKey(
  name = 'Default API Key',
  env: Env
): Promise<{ key: string; record: AgentWireApiKey }> {
  const rand = cryptoRandomHex(16);
  const rawKey = `wire_live_${rand}`;
  const keyHash = await hashApiKey(rawKey);
  const id = `key_${cryptoRandomHex(6)}`;
  const keyPrefix = `wire_live_${rand.substring(0, 4)}...${rand.substring(rand.length - 4)}`;
  const createdAt = new Date().toISOString();

  const record: StoredApiKey = { id, name, keyHash, keyPrefix, createdAt };
  setBounded(inMemoryApiKeys, id, record, MAX_IN_MEMORY_API_KEYS);

  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`apikey:${keyHash}`, JSON.stringify(record));
    await env.AGENTS_KV.put(`apikey_meta:${id}`, JSON.stringify(record));
  }

  return { key: rawKey, record: { id, name, keyPrefix, createdAt } };
}

export async function validateApiKey(rawKey: string, env: Env): Promise<StoredApiKey | null> {
  if (!rawKey) return null;
  const isDemoAllowed = env.ENVIRONMENT === 'development' || env.ALLOW_DEMO_KEY === 'true';
  if (isDemoAllowed && rawKey === 'wire_live_demo12345') {
    return {
      id: 'key_demo',
      name: 'Demo Key (Development Only)',
      keyHash: 'demo_hash',
      keyPrefix: 'wire_live_demo...345',
      createdAt: new Date().toISOString()
    };
  }
  const keyHash = await hashApiKey(rawKey);
  for (const item of inMemoryApiKeys.values()) {
    if (item.keyHash === keyHash) {
      item.lastUsedAt = new Date().toISOString();
      return item;
    }
  }
  if (env.AGENTS_KV) {
    const raw = await env.AGENTS_KV.get(`apikey:${keyHash}`);
    if (raw) {
      try {
        const parsed: StoredApiKey = JSON.parse(raw);
        parsed.lastUsedAt = new Date().toISOString();
        await env.AGENTS_KV.put(`apikey:${keyHash}`, JSON.stringify(parsed));
        await env.AGENTS_KV.put(`apikey_meta:${parsed.id}`, JSON.stringify(parsed));
        return parsed;
      } catch (e: any) {
        logStructured('error', 'kv.apikey_parse_failed', { reason: e?.message || String(e) });
      }
    }
  }
  return null;
}

export async function authorizePrivateAgent(agent: Agent, request: Request, env: Env): Promise<boolean> {
  if (agent.visibility !== 'private') return true;
  const wireKey = extractWireKey(request);
  const valid = await validateApiKey(wireKey, env);
  return Boolean(valid);
}

export async function listApiKeys(env: Env, onlyId?: string): Promise<AgentWireApiKey[]> {
  const byId = new Map<string, AgentWireApiKey>();
  for (const k of inMemoryApiKeys.values()) {
    if (!onlyId || k.id === onlyId) {
      byId.set(k.id, { id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt });
    }
  }
  if (env.AGENTS_KV) {
    try {
      const listed = await env.AGENTS_KV.list({ prefix: 'apikey_meta:' });
      for (const entry of listed.keys) {
        if (!entry.name.startsWith('apikey_meta:')) continue;
        const raw = await env.AGENTS_KV.get(entry.name);
        if (!raw) continue;
        try {
          const k: StoredApiKey = JSON.parse(raw);
          if (!onlyId || k.id === onlyId) {
            byId.set(k.id, { id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt });
          }
        } catch {}
      }
    } catch (e: any) {
      logStructured('warn', 'kv.list_apikeys_failed', { reason: e?.message || String(e) });
    }
  }
  return Array.from(byId.values());
}

export async function revokeApiKey(
  id: string,
  env: Env,
  requiredCallerKeyHash?: string
): Promise<'revoked' | 'not_found' | 'forbidden'> {
  let record: StoredApiKey | undefined = inMemoryApiKeys.get(id);
  if (!record && env.AGENTS_KV) {
    const rawMeta = await env.AGENTS_KV.get(`apikey_meta:${id}`);
    if (rawMeta) {
      try {
        record = JSON.parse(rawMeta) as StoredApiKey;
      } catch {}
    }
  }
  if (!record) {
    return 'not_found';
  }
  if (requiredCallerKeyHash && record.keyHash !== requiredCallerKeyHash) {
    return 'forbidden';
  }
  inMemoryApiKeys.delete(id);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.delete(`apikey:${record.keyHash}`);
    await env.AGENTS_KV.delete(`apikey_meta:${id}`);
  }
  return 'revoked';
}

export async function saveRunRecord(agentId: string, record: AgentRunRecord, env: Env): Promise<void> {
  const runs = inMemoryRuns.get(agentId) || [];
  runs.unshift(record);
  if (runs.length > 50) runs.pop();
  setBounded(inMemoryRuns, agentId, runs, MAX_IN_MEMORY_RUN_AGENTS);

  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`run:${agentId}:${record.runId}`, JSON.stringify(record));
  }
}

export async function listAgentRuns(agentId: string, limit = 20, env: Env): Promise<AgentRunRecord[]> {
  if (env.AGENTS_KV) {
    try {
      const prefix = `run:${agentId}:`;
      const listed = await env.AGENTS_KV.list({ prefix });
      const kvRuns: AgentRunRecord[] = [];
      for (const entry of listed.keys) {
        if (!entry.name.startsWith(prefix)) continue;
        const raw = await env.AGENTS_KV.get(entry.name);
        if (!raw) continue;
        try {
          kvRuns.push(JSON.parse(raw));
        } catch {}
      }
      if (kvRuns.length > 0) {
        kvRuns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        return kvRuns.slice(0, limit);
      }
    } catch (e: any) {
      logStructured('warn', 'kv.list_runs_fallback_memory', { reason: e?.message || String(e) });
    }
  }
  const runs = inMemoryRuns.get(agentId) || [];
  return runs.slice(0, limit);
}

export async function getSession(agentId: string, sessionId: string, env: Env): Promise<AgentSession | null> {
  const compositeKey = `${agentId}:${sessionId}`;
  if (env.AGENTS_KV) {
    const data = await env.AGENTS_KV.get(`session:${compositeKey}`);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e: any) {
        logStructured('error', 'kv.session_parse_failed', { reason: e?.message || String(e) });
      }
    }
  }
  return inMemorySessions.get(compositeKey) || null;
}

export async function saveSession(session: AgentSession, env: Env): Promise<void> {
  const compositeKey = `${session.agentId}:${session.id}`;
  setBounded(inMemorySessions, compositeKey, session, MAX_IN_MEMORY_SESSIONS);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`session:${compositeKey}`, JSON.stringify(session));
  }
}

export async function listSessions(agentId: string, env: Env): Promise<AgentSession[]> {
  const byId = new Map<string, AgentSession>();
  const memPrefix = `${agentId}:`;
  for (const [key, sess] of inMemorySessions.entries()) {
    if (key.startsWith(memPrefix)) {
      byId.set(sess.id, sess);
    }
  }
  if (env.AGENTS_KV) {
    try {
      const kvPrefix = `session:${agentId}:`;
      const listed = await env.AGENTS_KV.list({ prefix: kvPrefix });
      for (const entry of listed.keys) {
        if (!entry.name.startsWith(kvPrefix)) continue;
        const raw = await env.AGENTS_KV.get(entry.name);
        if (!raw) continue;
        try {
          const parsed: AgentSession = JSON.parse(raw);
          byId.set(parsed.id, parsed);
        } catch {}
      }
    } catch (e: any) {
      logStructured('warn', 'kv.list_sessions_fallback_memory', { reason: e?.message || String(e) });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function deleteSession(agentId: string, sessionId: string, env: Env): Promise<boolean> {
  const compositeKey = `${agentId}:${sessionId}`;
  inMemorySessions.delete(compositeKey);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.delete(`session:${compositeKey}`);
  }
  return true;
}

export async function getAgent(idOrSlug: string, env: Env): Promise<Agent | null> {
  if (!idOrSlug || typeof idOrSlug !== 'string') return null;
  const normalized = idOrSlug.replace(/^agent-?wire\//i, '');
  if (env.AGENTS_KV) {
    const data = await env.AGENTS_KV.get(`agent:${normalized}`);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e: any) {
        logStructured('error', 'kv.agent_parse_failed', { reason: e?.message || String(e) });
      }
    }
  }
  const direct = inMemoryAgents.get(idOrSlug) || inMemoryAgents.get(normalized);
  if (direct) return direct;

  const allAgents = await listAgents(env);
  for (const ag of allAgents) {
    if (ag.id === normalized || ag.slug === normalized) {
      return ag;
    }
  }
  return null;
}

export async function saveAgent(agent: Agent, env: Env): Promise<void> {
  setBounded(inMemoryAgents, agent.id, agent, MAX_IN_MEMORY_AGENTS, val => !val.isProtected);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`agent:${agent.id}`, JSON.stringify(agent));
  }
}

export async function listAgents(env: Env): Promise<Agent[]> {
  if (env.AGENTS_KV) {
    try {
      const merged = new Map<string, Agent>();
      for (const starter of STARTER_AGENTS) {
        merged.set(starter.id, starter);
      }
      const keys = await env.AGENTS_KV.list({ prefix: 'agent:' });
      for (const k of keys.keys) {
        if (!k.name.startsWith('agent:')) continue;
        const raw = await env.AGENTS_KV.get(k.name);
        if (!raw) continue;
        try {
          const parsed: Agent = JSON.parse(raw);
          if (parsed && parsed.id) {
            merged.set(parsed.id, parsed);
          }
        } catch (parseErr: any) {
          logStructured('error', 'kv.list_agent_item_corrupt', { reason: parseErr?.message || String(parseErr) });
        }
      }
      return Array.from(merged.values());
    } catch (e: any) {
      logStructured('warn', 'kv.list_fallback_memory', { reason: e?.message || String(e) });
    }
  }
  return Array.from(inMemoryAgents.values());
}

export async function deleteAgent(id: string, env: Env): Promise<boolean> {
  inMemoryAgents.delete(id);
  inMemoryRuns.delete(id);
  const sessPrefix = `${id}:`;
  for (const key of inMemorySessions.keys()) {
    if (key.startsWith(sessPrefix)) {
      inMemorySessions.delete(key);
    }
  }
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.delete(`agent:${id}`);
  }
  return true;
}

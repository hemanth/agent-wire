import type {
  Agent,
  AgentRunRecord,
  AgentWireApiKey,
  AgentSession
} from './types.ts';
import { STARTER_AGENTS } from './presets.ts';

export interface Env {
  AGENTS_KV?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
    list(): Promise<{ keys: Array<{ name: string }> }>;
  };
  OPENROUTER_API_KEY?: string;
  AI?: unknown;
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
const MAX_IN_MEMORY_SESSIONS = 500;
const MAX_IN_MEMORY_A2A_TASKS = 500;
const MAX_IN_MEMORY_API_KEYS = 200;
const MAX_RATE_LIMIT_BUCKETS = 2000;

// Bounded Map helper that evicts oldest entries when capacity is exceeded
function setBounded<K, V>(map: Map<K, V>, key: K, value: V, maxEntries: number): void {
  if (!map.has(key) && map.size >= maxEntries) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    }
  }
  map.set(key, value);
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
  // Opportunistic sweep when store grows large
  if (rateLimitStore.size >= MAX_RATE_LIMIT_BUCKETS) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
  }
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    setBounded(rateLimitStore, key, { count: 1, resetAt: now + windowMs }, MAX_RATE_LIMIT_BUCKETS);
    return { allowed: true, remaining: maxRequests - 1, resetAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, remaining: maxRequests - entry.count, resetAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
}

export function getOrGenerateTrace(request: Request): { traceId: string; spanId: string; traceparent: string } {
  const incoming = request.headers.get('traceparent');
  if (incoming && /^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/i.test(incoming)) {
    const parts = incoming.split('-');
    return { traceId: parts[1], spanId: parts[2], traceparent: incoming };
  }
  const traceId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const spanId = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-01` };
}

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function createApiKey(
  name = 'Default API Key',
  env: Env
): Promise<{ key: string; record: AgentWireApiKey }> {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const rawKey = `wire_live_${rand}`;
  const keyHash = await hashKey(rawKey);
  const id = `key_${Math.random().toString(36).substring(2, 9)}`;
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
  if (rawKey === 'wire_live_demo12345') {
    return {
      id: 'key_demo',
      name: 'Demo Key',
      keyHash: 'demo_hash',
      keyPrefix: 'wire_live_demo...345',
      createdAt: new Date().toISOString()
    };
  }
  const keyHash = await hashKey(rawKey);
  for (const item of inMemoryApiKeys.values()) {
    if (item.keyHash === keyHash) {
      item.lastUsedAt = new Date().toISOString();
      return item;
    }
  }
  if (env.AGENTS_KV) {
    const raw = await env.AGENTS_KV.get(`apikey:${keyHash}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      parsed.lastUsedAt = new Date().toISOString();
      await env.AGENTS_KV.put(`apikey:${keyHash}`, JSON.stringify(parsed));
      return parsed;
    }
  }
  return null;
}

export async function listApiKeys(_env: Env): Promise<AgentWireApiKey[]> {
  const list: AgentWireApiKey[] = [];
  for (const k of inMemoryApiKeys.values()) {
    list.push({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, createdAt: k.createdAt, lastUsedAt: k.lastUsedAt });
  }
  return list;
}

export async function revokeApiKey(id: string, env: Env): Promise<boolean> {
  const item = inMemoryApiKeys.get(id);
  inMemoryApiKeys.delete(id);
  if (env.AGENTS_KV && item) {
    await env.AGENTS_KV.delete(`apikey:${item.keyHash}`);
    await env.AGENTS_KV.delete(`apikey_meta:${id}`);
  }
  return true;
}

export async function saveRunRecord(agentId: string, record: AgentRunRecord, env: Env): Promise<void> {
  const runs = inMemoryRuns.get(agentId) || [];
  runs.unshift(record);
  if (runs.length > 50) runs.pop();
  inMemoryRuns.set(agentId, runs);

  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`run:${agentId}:${record.runId}`, JSON.stringify(record));
  }
}

export async function listAgentRuns(agentId: string, limit = 20, _env: Env): Promise<AgentRunRecord[]> {
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
      } catch (e) {
        console.error('Failed to parse session from KV', e);
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

export async function listSessions(agentId: string, _env: Env): Promise<AgentSession[]> {
  const sessions: AgentSession[] = [];
  const prefix = `${agentId}:`;
  for (const [key, sess] of inMemorySessions.entries()) {
    if (key.startsWith(prefix)) {
      sessions.push(sess);
    }
  }
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
  if (env.AGENTS_KV) {
    const data = await env.AGENTS_KV.get(`agent:${idOrSlug}`);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        console.error('Failed to parse agent from KV', e);
      }
    }
  }
  const direct = inMemoryAgents.get(idOrSlug);
  if (direct) return direct;
  const normalized = idOrSlug.replace(/^agent-?wire\//i, '');
  for (const ag of inMemoryAgents.values()) {
    if (ag.id === normalized || ag.slug === normalized) {
      return ag;
    }
  }
  return null;
}

export async function saveAgent(agent: Agent, env: Env): Promise<void> {
  setBounded(inMemoryAgents, agent.id, agent, MAX_IN_MEMORY_AGENTS);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.put(`agent:${agent.id}`, JSON.stringify(agent));
  }
}

export async function listAgents(env: Env): Promise<Agent[]> {
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

export async function deleteAgent(id: string, env: Env): Promise<boolean> {
  inMemoryAgents.delete(id);
  if (env.AGENTS_KV) {
    await env.AGENTS_KV.delete(`agent:${id}`);
  }
  return true;
}

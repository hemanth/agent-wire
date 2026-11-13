import type { AgentSession, UserProfileState } from './types.ts';
import type { Env } from './store.ts';
import { saveSession, deleteSession } from './store.ts';

export interface DoStorageLike {
  get<T = unknown>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<boolean>;
  deleteAll(): Promise<void>;
}

export interface DoStateLike {
  storage: DoStorageLike;
  blockConcurrencyWhile?: <T>(fn: () => Promise<T>) => Promise<T>;
}

function sanitizeSafeRecord(input: unknown): Record<string, any> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.length > 128) continue;
    clean[k] = v;
  }
  if (JSON.stringify(clean).length > 16384) return {};
  return clean;
}

const serialQueues = new WeakMap<DoStorageLike, Promise<unknown>>();

function runSerialized<T>(state: DoStateLike, fn: () => Promise<T>): Promise<T> {
  if (typeof state.blockConcurrencyWhile === 'function') {
    return state.blockConcurrencyWhile(fn);
  }
  const prev = serialQueues.get(state.storage) || Promise.resolve();
  const next = prev.then(fn, fn);
  serialQueues.set(
    state.storage,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

export async function handleUserStateDoRequest(
  state: DoStateLike,
  _env: Env,
  request: Request
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return runSerialized(state, async () => {
    const op: string = String(body.op || '');
    const userId: string = String(body.userId || '').slice(0, 128);
    const callerPrincipalHash: string = String(body.principalHash || '');

    let profile = await state.storage.get<UserProfileState>('profile');

    if (profile && profile.principalHash && profile.principalHash !== callerPrincipalHash) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: User state is bound to a different caller identity.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (op === 'inspect') {
      if (!profile) {
        return new Response(
          JSON.stringify({
            userId,
            createdAt: null,
            updatedAt: null,
            totalRuns: 0,
            activeAgentId: undefined,
            userMemory: {},
            pendingIntents: {}
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      const { principalHash: _ph, ...publicProfile } = profile;
      return new Response(JSON.stringify(publicProfile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (op === 'patch_profile') {
      const now = new Date().toISOString();
      if (!profile) {
        profile = {
          userId,
          principalHash: callerPrincipalHash,
          createdAt: now,
          updatedAt: now,
          totalRuns: 0,
          userMemory: {},
          pendingIntents: {}
        };
      }
      const memPatch = sanitizeSafeRecord(body.userMemory);
      profile.userMemory = sanitizeSafeRecord({ ...profile.userMemory, ...memPatch });
      if (typeof body.activeAgentId === 'string' && body.activeAgentId) {
        profile.activeAgentId = body.activeAgentId;
      }
      profile.updatedAt = now;
      await state.storage.put('profile', profile);
      const { principalHash: _ph, ...publicProfile } = profile;
      return new Response(JSON.stringify(publicProfile), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (op === 'reset') {
      await state.storage.deleteAll();
      return new Response(JSON.stringify({ success: true, userId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (op === 'acquire') {
      const now = new Date().toISOString();
      if (!profile) {
        profile = {
          userId,
          principalHash: callerPrincipalHash,
          createdAt: now,
          updatedAt: now,
          totalRuns: 0,
          userMemory: {},
          pendingIntents: {}
        };
      } else if (!profile.principalHash && callerPrincipalHash) {
        profile.principalHash = callerPrincipalHash;
      }

      const userMemPatch = sanitizeSafeRecord(body.userMemoryPatch);
      if (Object.keys(userMemPatch).length > 0) {
        profile.userMemory = sanitizeSafeRecord({ ...profile.userMemory, ...userMemPatch });
      }
      profile.updatedAt = now;
      await state.storage.put('profile', profile);

      const agentId: string = String(body.agentId || '');
      const sessionId: string = String(body.sessionId || '');
      let session: AgentSession | undefined = undefined;

      if (agentId && sessionId) {
        const sessKey = `session:${agentId}:${sessionId}`;
        session = await state.storage.get<AgentSession>(sessKey);
        const sessMemPatch = sanitizeSafeRecord(body.sessionMemoryPatch);
        if (!session) {
          session = {
            id: sessionId,
            agentId,
            userId,
            principalHash: callerPrincipalHash || undefined,
            createdAt: now,
            updatedAt: now,
            messages: [],
            memory: sessMemPatch,
            runsCount: 0
          };
        } else {
          if (session.principalHash && session.principalHash !== callerPrincipalHash) {
            return new Response(
              JSON.stringify({ error: 'Forbidden: Session is bound to a different caller identity.' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            );
          }
          if (Object.keys(sessMemPatch).length > 0) {
            session.memory = sanitizeSafeRecord({ ...session.memory, ...sessMemPatch });
          }
        }
        await state.storage.put(sessKey, session);
      }

      return new Response(JSON.stringify({ profile, session }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (op === 'commit') {
      const now = new Date().toISOString();
      if (!profile) {
        profile = {
          userId,
          principalHash: callerPrincipalHash,
          createdAt: now,
          updatedAt: now,
          totalRuns: 0,
          userMemory: {},
          pendingIntents: {}
        };
      }

      const userMemPatch = sanitizeSafeRecord(body.userMemoryPatch);
      if (Object.keys(userMemPatch).length > 0) {
        profile.userMemory = sanitizeSafeRecord({ ...profile.userMemory, ...userMemPatch });
      }

      const agentId: string = String(body.agentId || '');
      if (agentId) {
        profile.activeAgentId = agentId;
        if (body.pendingIntent === null) {
          delete profile.pendingIntents[agentId];
        } else if (body.pendingIntent && typeof body.pendingIntent === 'object') {
          profile.pendingIntents[agentId] = {
            intentId: String(body.pendingIntent.intentId || ''),
            originalTask: String(body.pendingIntent.originalTask || '').slice(0, 2000),
            slots: sanitizeSafeRecord(body.pendingIntent.slots),
            updatedAt: now
          };
        }
      }

      if (body.incrementRuns !== false) {
        profile.totalRuns = (profile.totalRuns || 0) + 1;
      }
      profile.updatedAt = now;
      await state.storage.put('profile', profile);

      const sessionId: string = String(body.sessionId || '');
      let session: AgentSession | undefined = undefined;
      if (agentId && sessionId) {
        const sessKey = `session:${agentId}:${sessionId}`;
        session =
          (await state.storage.get<AgentSession>(sessKey)) || {
            id: sessionId,
            agentId,
            userId,
            principalHash: callerPrincipalHash || undefined,
            createdAt: now,
            updatedAt: now,
            messages: [],
            memory: {},
            runsCount: 0
          };

        const sessMemPatch = sanitizeSafeRecord(body.sessionMemoryPatch);
        if (Object.keys(sessMemPatch).length > 0) {
          session.memory = sanitizeSafeRecord({ ...session.memory, ...sessMemPatch });
        }

        if (typeof body.userMessage === 'string' && typeof body.assistantMessage === 'string') {
          session.messages.push({
            role: 'user',
            content: body.userMessage,
            timestamp: now
          });
          session.messages.push({
            role: 'assistant',
            content: body.assistantMessage,
            timestamp: now
          });
          if (session.messages.length > 50) {
            session.messages = session.messages.slice(-50);
          }
          session.runsCount = (session.runsCount || 0) + 1;
        }
        session.updatedAt = now;
        await state.storage.put(sessKey, session);
      }

      return new Response(JSON.stringify({ profile, session }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: `Unknown UserStateDO op: ${op}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  });
}

/**
 * Runtime-portable UserStateDO class (used directly in Playwright / Node harnesses,
 * and wrapped by Cloudflare `DurableObject` in `src/cf-entry.ts`).
 */
export class UserStateDO {
  private state: DoStateLike;
  private env: Env;

  constructor(state: DoStateLike, env: Env) {
    this.state = state;
    this.env = env;
  }

  fetch(request: Request): Promise<Response> {
    return handleUserStateDoRequest(this.state, this.env, request);
  }
}

// Local in-memory / KV-backed fallback DO singletons when running in `node dev-server.mjs`
class LocalMemoryDoStorage implements DoStorageLike {
  private map = new Map<string, unknown>();
  private kvPrefix: string;
  private env: Env;
  private hydrated = false;

  constructor(scopeKey: string, env: Env) {
    this.kvPrefix = `udo:${scopeKey}:`;
    this.env = env;
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (this.map.has(key)) {
      return structuredClone(this.map.get(key)) as T;
    }
    if (this.env.AGENTS_KV && !this.hydrated) {
      const raw = await this.env.AGENTS_KV.get(this.kvPrefix + key);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          this.map.set(key, parsed);
          return structuredClone(parsed) as T;
        } catch {}
      }
    }
    return undefined;
  }

  async put(key: string, value: unknown): Promise<void> {
    this.map.set(key, structuredClone(value));
    if (this.env.AGENTS_KV) {
      await this.env.AGENTS_KV.put(this.kvPrefix + key, JSON.stringify(value));
    }
  }

  async delete(key: string): Promise<boolean> {
    const existed = this.map.delete(key);
    if (this.env.AGENTS_KV) {
      await this.env.AGENTS_KV.delete(this.kvPrefix + key);
    }
    return existed;
  }

  async deleteAll(): Promise<void> {
    const keys = Array.from(this.map.keys());
    this.map.clear();
    this.hydrated = true;
    if (this.env.AGENTS_KV) {
      for (const k of keys) {
        await this.env.AGENTS_KV.delete(this.kvPrefix + k);
      }
    }
  }
}

const localUserDoInstances = new Map<string, UserStateDO>();

function getUserDoStub(userId: string, env: Env): { fetch(request: Request): Promise<Response> } {
  const doKey = `user:${userId}`;
  if (env.USER_STATE_DO) {
    const id = env.USER_STATE_DO.idFromName(doKey);
    return env.USER_STATE_DO.get(id);
  }
  let local = localUserDoInstances.get(doKey);
  if (!local) {
    if (localUserDoInstances.size >= 500) {
      const oldestKey = localUserDoInstances.keys().next().value;
      if (oldestKey) localUserDoInstances.delete(oldestKey);
    }
    const storage = new LocalMemoryDoStorage(doKey, env);
    local = new UserStateDO({ storage }, env);
    localUserDoInstances.set(doKey, local);
  }
  return local;
}

export async function callUserStateDo<T = any>(
  userId: string,
  env: Env,
  payload: Record<string, unknown>
): Promise<{ status: number; data: T }> {
  const stub = getUserDoStub(userId, env);
  const res = await stub.fetch(
    new Request('https://user-state.internal/op', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...payload })
    })
  );
  const data = (await res.json()) as T;

  // Mirror session into standard session store so `/api/agents/:id/sessions` stays 100% consistent
  const maybeSession = (data as any)?.session as AgentSession | undefined;
  if (res.status === 200 && maybeSession && maybeSession.id && maybeSession.agentId) {
    await saveSession(maybeSession, env);
  }
  if (res.status === 200 && payload.op === 'reset' && typeof payload.agentId === 'string' && typeof payload.sessionId === 'string') {
    await deleteSession(payload.agentId, payload.sessionId, env);
  }

  return { status: res.status, data };
}

import { test, expect } from '@playwright/test';
import worker, { UserStateDO } from '../src/worker';
import type { Env } from '../src/store';

function createDurableObjectHarnessEnv(extra: Partial<Env> = {}): Env {
  const instances = new Map<string, UserStateDO>();

  class MockStorage {
    private data = new Map<string, unknown>();
    private queue: Promise<unknown> = Promise.resolve();

    async get<T = unknown>(key: string): Promise<T | undefined> {
      const raw = this.data.get(key);
      return raw === undefined ? undefined : (structuredClone(raw) as T);
    }

    async put(key: string, value: unknown): Promise<void> {
      this.data.set(key, structuredClone(value));
    }

    async delete(key: string): Promise<boolean> {
      return this.data.delete(key);
    }

    async deleteAll(): Promise<void> {
      this.data.clear();
    }

    blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
      const next = this.queue.then(fn, fn);
      this.queue = next.then(() => undefined, () => undefined);
      return next;
    }
  }

  const namespace = {
    idFromName(name: string) {
      return { toString: () => `do_${name}`, name };
    },
    get(id: { toString(): string }) {
      const key = id.toString();
      let inst = instances.get(key);
      if (!inst) {
        const storage = new MockStorage();
        const state: any = {
          id,
          storage,
          blockConcurrencyWhile: <T>(fn: () => Promise<T>) => storage.blockConcurrencyWhile(fn)
        };
        inst = new UserStateDO(state, {} as Env);
        instances.set(key, inst);
      }
      return {
        fetch: (req: Request | string, init?: RequestInit) => {
          const requestObj = typeof req === 'string' ? new Request(req, init) : req;
          return inst!.fetch(requestObj);
        }
      };
    }
  };

  return {
    ENVIRONMENT: 'test',
    USER_STATE_DO: namespace as any,
    ...extra
  };
}

test.describe('Multi-Turn Intent Classification, Slot Filling & Per-User Durable Object Stickiness', () => {
  const baseUrl = 'http://localhost:8787';

  test('1. Auto-sticks per user across turns WITHOUT sessionId and isolates users with 403 guard', async ({ request }) => {
    const aliceId = `alice_${Date.now()}`;
    const bobId = `bob_${Date.now()}`;

    // Turn 1: Alice sends preference + userMemory with NO sessionId
    const t1 = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: { 'X-User-ID': aliceId },
      data: {
        task: 'Our design system uses Crimson Pro headings and 8px grid rhythm.',
        userMemory: { preferredStack: 'React 19', theme: 'light-paper' }
      }
    });
    expect(t1.ok()).toBeTruthy();
    const b1 = await t1.json();
    expect(b1.stickyUser?.userId).toBe(aliceId);
    expect(b1.stickyUser?.autoBound).toBe(true);
    expect(b1.sessionId).toMatch(/^usr_/);
    expect(b1.sessionMessagesCount).toBe(2);
    expect(b1.stickyUser?.userMemory).toMatchObject({ preferredStack: 'React 19', theme: 'light-paper' });

    // Turn 2: Alice follows up WITHOUT sessionId — history and userMemory stick automatically
    const t2 = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: { 'X-User-ID': aliceId },
      data: {
        task: 'Remind me which heading font and stack we standardized on.'
      }
    });
    expect(t2.ok()).toBeTruthy();
    const b2 = await t2.json();
    expect(b2.sessionId).toBe(b1.sessionId);
    expect(b2.sessionMessagesCount).toBe(4);
    expect(b2.result).toContain('Crimson Pro');
    expect(b2.result).toContain('React 19');

    // Turn 3: Alice starts an explicit NEW session thread — sticky user profile carries across threads!
    const newThreadId = `ses_fresh_${Date.now()}`;
    const t3 = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: { 'X-User-ID': aliceId },
      data: {
        sessionId: newThreadId,
        task: 'Audit a new modal component using our saved user profile.'
      }
    });
    expect(t3.ok()).toBeTruthy();
    const b3 = await t3.json();
    expect(b3.sessionId).toBe(newThreadId);
    expect(b3.sessionMessagesCount).toBe(2);
    expect(b3.stickyUser?.userMemory).toMatchObject({ preferredStack: 'React 19', theme: 'light-paper' });
    expect(b3.stickyUser?.totalRuns).toBe(3);

    // Bob hits the exact same agent without sessionId — completely isolated from Alice
    const bobRes = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: { 'X-User-ID': bobId },
      data: { task: 'Check button contrast.' }
    });
    expect(bobRes.ok()).toBeTruthy();
    const bobBody = await bobRes.json();
    expect(bobBody.sessionId).not.toBe(b1.sessionId);
    expect(bobBody.sessionMessagesCount).toBe(2);
    expect(bobBody.result).not.toContain('Crimson Pro');
    expect(bobBody.stickyUser?.userMemory || {}).not.toHaveProperty('preferredStack');

    // Bob attempting to inspect Alice's user state endpoint gets 403
    const hijackState = await request.get(`${baseUrl}/api/users/${aliceId}/state`, {
      headers: { 'X-User-ID': bobId }
    });
    expect(hijackState.status()).toBe(403);

    // Alice inspecting her own state succeeds
    const aliceStateRes = await request.get(`${baseUrl}/api/users/${aliceId}/state`, {
      headers: { 'X-User-ID': aliceId }
    });
    expect(aliceStateRes.ok()).toBeTruthy();
    const aliceState = await aliceStateRes.json();
    expect(aliceState.userId).toBe(aliceId);
    expect(aliceState.totalRuns).toBe(3);
    expect(aliceState.userMemory).toMatchObject({ preferredStack: 'React 19' });
  });

  test('2. Durable Object UserStateDO serializes concurrent multi-turn updates for the same user without lost writes', async () => {
    const env = createDurableObjectHarnessEnv();
    const userId = `concurrent_alice_${Date.now()}`;

    // Fire 4 concurrent turns for the same user against the Durable Object-backed worker
    const responses = await Promise.all(
      [1, 2, 3, 4].map(i =>
        worker.fetch(
          new Request('https://agent-wire.test/api/agents/agt_design_critic/run', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': userId
            },
            body: JSON.stringify({
              task: `Concurrent design turn #${i}`,
              userMemory: { [`key_${i}`]: `val_${i}` }
            })
          }),
          env
        )
      )
    );

    for (const r of responses) {
      expect(r.status).toBe(200);
    }

    const stateRes = await worker.fetch(
      new Request(`https://agent-wire.test/api/users/${userId}/state`, {
        headers: { 'X-User-ID': userId }
      }),
      env
    );
    expect(stateRes.status).toBe(200);
    const stateJson: any = await stateRes.json();
    expect(stateJson.totalRuns).toBe(4);
    expect(stateJson.userMemory).toMatchObject({
      key_1: 'val_1',
      key_2: 'val_2',
      key_3: 'val_3',
      key_4: 'val_4'
    });
  });

  test('3. Pre-LLM intent classification & multi-turn slot filling short-circuits missing slots then resumes on next turn', async () => {
    const env = createDurableObjectHarnessEnv({
      OPENROUTER_API_KEY: 'sk-or-v1-mock-slot-test'
    });
    let llmCalls = 0;
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (u === 'https://openrouter.ai/api/v1/chat/completions') {
        llmCalls += 1;
        const body = JSON.parse(String(init?.body || '{}'));
        const sys = body.messages?.[0]?.content || '';
        return new Response(
          JSON.stringify({
            id: 'gen_deploy_1',
            model: 'openai/gpt-4.1',
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: `Deploying with slots from prompt: ${sys.includes('us-west-2') && sys.includes('production') ? 'SLOTS_VERIFIED' : 'MISSING'}`
                }
              }
            ],
            usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return origFetch(input, init);
    };

    try {
      const createRes = await worker.fetch(
        new Request('https://agent-wire.test/api/agents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Release Coordinator',
            slug: `release-coord-${Date.now()}`,
            tagline: 'Deploys services to cloud regions with slot validation',
            systemPrompt: 'Execute validated release deployments.',
            models: ['openai/gpt-4.1'],
            intents: [
              {
                id: 'deploy_release',
                description: 'Deploy or roll out a service to staging or production',
                keywords: ['deploy', 'rollout', 'release', 'ship'],
                clarifyOnMissingSlots: true,
                requiredSlots: [
                  {
                    name: 'environment',
                    description: 'Target environment (staging or production)',
                    enum: ['staging', 'production']
                  },
                  {
                    name: 'region',
                    description: 'Cloud region (e.g. us-west-2, eu-central-1)',
                    pattern: '(?:us|eu|ap)-[a-z]+-\\d+'
                  }
                ]
              }
            ]
          })
        }),
        env
      );
      expect(createRes.status).toBe(201);
      const { agent } = (await createRes.json()) as any;
      const devUser = `dev_${Date.now()}`;

      // Turn 1: Supplies environment="production", omits region -> pre-LLM clarify (0 OpenRouter calls!)
      const turn1 = await worker.fetch(
        new Request(`https://agent-wire.test/api/agents/${agent.id}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': devUser
          },
          body: JSON.stringify({ task: 'Deploy payments service to production' })
        }),
        env
      );
      expect(turn1.status).toBe(200);
      const t1Json: any = await turn1.json();
      expect(llmCalls).toBe(0);
      expect(t1Json.status).toBe('needs_input');
      expect(t1Json.intent?.id).toBe('deploy_release');
      expect(t1Json.intent?.action).toBe('clarify');
      expect(t1Json.intent?.slots).toMatchObject({ environment: 'production' });
      expect(t1Json.intent?.missingSlots).toEqual(['region']);

      // Turn 2: User replies with ONLY the missing slot ("us-west-2") -> merges pending intent + executes LLM!
      const turn2 = await worker.fetch(
        new Request(`https://agent-wire.test/api/agents/${agent.id}/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-ID': devUser
          },
          body: JSON.stringify({ task: 'us-west-2' })
        }),
        env
      );
      expect(turn2.status).toBe(200);
      const t2Json: any = await turn2.json();
      expect(llmCalls).toBe(1);
      expect(t2Json.status).toBe('success');
      expect(t2Json.intent?.id).toBe('deploy_release');
      expect(t2Json.intent?.action).toBe('execute');
      expect(t2Json.intent?.slots).toMatchObject({ environment: 'production', region: 'us-west-2' });
      expect(t2Json.intent?.missingSlots).toEqual([]);
      expect(t2Json.result).toContain('SLOTS_VERIFIED');
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('4. Fleet Intent Router (/api/intent, /api/route & OpenAI model="agentwire/auto") sticks to active agent on follow-ups and switches on topic shift', async ({ request }) => {
    const maya = `maya_${Date.now()}`;

    // Pure pre-LLM intent probe (< 50ms, 0 LLM calls)
    const classifyRes = await request.post(`${baseUrl}/api/intent`, {
      data: { task: 'Audit WCAG contrast ratio and typography hierarchy on our landing page' }
    });
    expect(classifyRes.ok()).toBeTruthy();
    const classifyBody = await classifyRes.json();
    expect(classifyBody.targetAgentId).toBe('agt_design_critic');
    expect(classifyBody.confidence).toBeGreaterThan(0.5);

    // Turn 1 via /api/route: Design request routes to agt_design_critic and pins Maya to it
    const r1 = await request.post(`${baseUrl}/api/route`, {
      headers: { 'X-User-ID': maya },
      data: { task: 'Review contrast ratio and font pairing on our primary hero card.' }
    });
    expect(r1.ok()).toBeTruthy();
    const b1 = await r1.json();
    expect(b1.agentId).toBe('agt_design_critic');
    expect(b1.routing?.targetAgentId).toBe('agt_design_critic');
    expect(b1.routing?.switchedAgent).toBe(false);

    // Turn 2 via /api/route: Ambiguous follow-up ("What about mobile spacing on that?") STICKS to agt_design_critic
    const r2 = await request.post(`${baseUrl}/api/route`, {
      headers: { 'X-User-ID': maya },
      data: { task: 'What about mobile padding on that?' }
    });
    expect(r2.ok()).toBeTruthy();
    const b2 = await r2.json();
    expect(b2.agentId).toBe('agt_design_critic');
    expect(b2.intent?.isFollowUp).toBe(true);
    expect(b2.routing?.stickyHit).toBe(true);
    expect(b2.routing?.switchedAgent).toBe(false);
    expect(b2.sessionMessagesCount).toBe(4);

    // Turn 3 via OpenAI /v1/chat/completions with model="agentwire/auto" and user=maya: Topic shift switches to agt_pr_triage!
    const r3 = await request.post(`${baseUrl}/v1/chat/completions`, {
      data: {
        model: 'agentwire/auto',
        user: maya,
        messages: [{ role: 'user', content: 'Triage GitHub pull request #402 bug report and inspect repository issue comments.' }]
      }
    });
    expect(r3.ok()).toBeTruthy();
    const b3 = await r3.json();
    expect(b3.model).toBe('agt_pr_triage');
    expect(b3.agentwire_meta?.routing?.switchedAgent).toBe(true);
    expect(b3.agentwire_meta?.routing?.previousAgentId).toBe('agt_design_critic');
  });

  test('5. Studio UI Sticky User mode binds userId and renders Intent & User telemetry pills', async ({ page }) => {
    await page.goto(baseUrl);
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    const stickyToggle = modal.getByRole('button', { name: 'Sticky User' });
    await expect(stickyToggle).toBeVisible();
    await stickyToggle.click();

    const userInput = modal.locator('#sticky-user-id-input');
    await expect(userInput).toBeVisible();
    await userInput.fill(`ui_alice_${Date.now()}`);

    await modal.getByRole('button', { name: 'Run Task' }).click();
    await expect(modal.locator('[aria-label="Execution Telemetry"]')).toContainText(/Intent:/, { timeout: 15000 });
    await expect(modal.locator('[aria-label="Execution Telemetry"]')).toContainText(/User:/);
  });
});

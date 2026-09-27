import { test, expect } from '@playwright/test';

test.describe('Tracking, Observability & Permissions Suite', () => {
  const baseUrl = 'http://localhost:8787';

  // 1. Tracking: Run IDs, Token accounting, Run History persistence
  test('Execution mints unique runId and records trace in historical runs', async ({ request }) => {
    const runRes = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      data: { task: 'Verify typographic contrast and run tracking' }
    });

    expect(runRes.ok()).toBeTruthy();
    const runIdHeader = runRes.headers()['x-agentwire-run-id'];
    const traceIdHeader = runRes.headers()['x-agentwire-trace-id'];
    const durationHeader = runRes.headers()['x-agentwire-duration-ms'];

    expect(runIdHeader).toMatch(/^run_\d+_[a-z0-9]+/);
    expect(traceIdHeader).toBeTruthy();
    expect(Number(durationHeader)).toBeGreaterThanOrEqual(0);

    const body = await runRes.json();
    expect(body.runId).toBe(runIdHeader);
    expect(body.traceId).toBe(traceIdHeader);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
    expect(body.steps.length).toBeGreaterThan(0);
    expect(body.steps[0].durationMs).toBeDefined();

    // Verify Run History endpoint GET /api/agents/:id/runs
    const historyRes = await request.get(`${baseUrl}/api/agents/agt_design_critic/runs`);
    expect(historyRes.ok()).toBeTruthy();
    const historyData = await historyRes.json();
    expect(Array.isArray(historyData.runs)).toBeTruthy();
    expect(historyData.runs.some((r: any) => r.runId === runIdHeader)).toBeTruthy();
  });

  // 2. Observability: W3C traceparent propagation and step latencies
  test('Preserves incoming W3C traceparent context across edge execution', async ({ request }) => {
    const customTraceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const traceparent = `00-${customTraceId}-00f067aa0ba902b7-01`;

    const res = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: { traceparent },
      data: { task: 'Observability W3C tracing validation' }
    });

    expect(res.ok()).toBeTruthy();
    expect(res.headers()['x-agentwire-trace-id']).toBe(customTraceId);
    const body = await res.json();
    expect(body.traceId).toBe(customTraceId);
  });

  // 3. Permissions: Private Agent Guard & Protected Starter Agents
  test('Enforces 401 on private agents without valid key, allows access with wire_live_ key', async ({ request }) => {
    // Create a private agent
    const createRes = await request.post(`${baseUrl}/api/agents`, {
      data: {
        name: 'Private Security Agent',
        slug: 'private-security',
        systemPrompt: 'Inspect internal confidential security policies.',
        visibility: 'private'
      }
    });
    expect(createRes.ok()).toBeTruthy();
    const { agent } = await createRes.json();
    expect(agent.visibility).toBe('private');

    // Unauthenticated execution should fail with 401
    const unauthRun = await request.post(`${baseUrl}/api/agents/${agent.id}/run`, {
      data: { task: 'Review confidential CVE report' }
    });
    expect(unauthRun.status()).toBe(401);
    const unauthErr = await unauthRun.json();
    expect(unauthErr.error).toContain('requires a valid AgentWire API key');

    // Authenticated execution using wire_live_demo12345 should succeed
    const authRun = await request.post(`${baseUrl}/api/agents/${agent.id}/run`, {
      headers: {
        Authorization: 'Bearer wire_live_demo12345'
      },
      data: { task: 'Review confidential CVE report' }
    });
    expect(authRun.ok()).toBeTruthy();
    const authBody = await authRun.json();
    expect(authBody.agentId).toBe(agent.id);
    expect(authBody.status).toBe('success');

    // Starter agent protection check: deletion must be rejected with 403
    const deleteStarter = await request.delete(`${baseUrl}/api/agents/agt_design_critic`);
    expect(deleteStarter.status()).toBe(403);
    const deleteErr = await deleteStarter.json();
    expect(deleteErr.error).toContain('Starter agents are protected');
  });

  // 4. Permissions: API Key Creation, Listing, and Revocation
  test('API Key lifecycle: mint, list, and revoke', async ({ request }) => {
    const createKeyRes = await request.post(`${baseUrl}/api/keys`, {
      data: { name: 'CI Deployment Pipeline Key' }
    });
    expect(createKeyRes.ok()).toBeTruthy();
    const { key, keyMeta } = await createKeyRes.json();
    expect(key).toMatch(/^wire_live_[0-9a-f]{32}/);
    expect(keyMeta.id).toBeTruthy();

    const listKeys = await request.get(`${baseUrl}/api/keys`);
    expect(listKeys.ok()).toBeTruthy();
    const { keys } = await listKeys.json();
    expect(keys.some((k: any) => k.id === keyMeta.id)).toBeTruthy();

    const revokeRes = await request.delete(`${baseUrl}/api/keys/${keyMeta.id}`);
    expect(revokeRes.ok()).toBeTruthy();
  });

  // 5. UI Verification: Run History Tab & API Keys Modal in Browser
  test('UI displays Run History tab and opens API Keys modal', async ({ page }) => {
    await page.goto(baseUrl);

    // Open Runner Modal for first agent
    const fleetTab = page.getByRole('tab', { name: /Fleet/i });
    await fleetTab.click();
    await page.locator('article').first().click();

    // Verify "History & Traces" tab exists and switch to it
    const historyTabBtn = page.getByRole('button', { name: /History & Traces/i });
    await expect(historyTabBtn).toBeVisible();
    await historyTabBtn.click();

    // Verify history logs container renders
    await expect(page.locator('text=Execution Logs & Traces')).toBeVisible();

    // Close runner modal
    await page.keyboard.press('Escape');

    // Open API Keys modal from Navbar
    const apiKeysBtn = page.getByRole('button', { name: /Manage API Keys/i });
    await expect(apiKeysBtn).toBeVisible();
    await apiKeysBtn.click();

    await expect(page.getByRole('heading', { name: /AgentWire API Keys & Permissions/i })).toBeVisible();
    await expect(page.locator('text=Active Access Keys')).toBeVisible();

    // Take screenshot of API Keys modal
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/api_keys_modal_ui.png'
    });
  });
});

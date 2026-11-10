import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = 'http://localhost:8787';

test.describe('Production Launch Readiness: Health, RED Metrics, Security, Caching & WCAG 2.1 AA', () => {
  test('1. Health check (/api/health & /healthz), RED metrics (/api/metrics), and Feature Flags (/api/flags)', async ({ request }) => {
    const healthRes = await request.get(`${BASE_URL}/api/health`);
    expect(healthRes.status()).toBe(200);
    const health = await healthRes.json();
    expect(health.status).toBe('ok');
    expect(health.service).toBe('agent-wire');
    expect(health.agentsCount).toBeGreaterThanOrEqual(2);
    expect(health.featureFlags.mcpLiveExecution).toBe(true);
    expect(health.errorBudget.sloTarget).toBe(0.995);
    expect(health.errorBudget.releaseGate).toBe('ship_normally');

    const healthzRes = await request.get(`${BASE_URL}/healthz`);
    expect(healthzRes.status()).toBe(200);
    expect((await healthzRes.json()).status).toBe('ok');

    const metricsRes = await request.get(`${BASE_URL}/api/metrics`);
    expect(metricsRes.status()).toBe(200);
    const metrics = await metricsRes.json();
    expect(metrics.totals.requests).toBeGreaterThanOrEqual(2);
    expect(typeof metrics.totals.latencyMs.p50).toBe('number');
    expect(typeof metrics.totals.latencyMs.p95).toBe('number');
    expect(typeof metrics.totals.latencyMs.p99).toBe('number');
    expect(metrics.routes['/api/health']).toBeDefined();

    const flagsRes = await request.get(`${BASE_URL}/api/flags`);
    expect(flagsRes.status()).toBe(200);
    const flagsBody = await flagsRes.json();
    expect(Array.isArray(flagsBody.flags)).toBeTruthy();
    expect(flagsBody.flags.every((f: any) => f.owner && f.expiresAt)).toBeTruthy();
  });

  test('2. Security headers, non-wildcard CORS allowlist, secret redaction, input validation, and auth rate limit', async ({ request }) => {
    // 1. Security Headers & Trusted Origin CORS
    const trustedRes = await request.get(`${BASE_URL}/api/agents`, {
      headers: { Origin: 'https://h3manth.com' }
    });
    expect(trustedRes.ok()).toBeTruthy();
    const h = trustedRes.headers();
    expect(h['access-control-allow-origin']).toBe('https://h3manth.com');
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('DENY');
    expect(h['strict-transport-security']).toContain('max-age=31536000');
    expect(h['content-security-policy']).toContain("script-src 'self'");
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['x-request-id']).toBeTruthy();

    // 2. Untrusted Origin CORS must NOT return wildcard or attacker origin
    const untrustedRes = await request.get(`${BASE_URL}/api/agents`, {
      headers: { Origin: 'https://evil-attacker.example' }
    });
    expect(untrustedRes.headers()['access-control-allow-origin']).not.toBe('*');
    expect(untrustedRes.headers()['access-control-allow-origin']).not.toBe('https://evil-attacker.example');

    // 3. Secret Redaction across REST & MCP boundaries
    const createRes = await request.post(`${BASE_URL}/api/agents`, {
      data: {
        name: 'Redaction Audit Agent',
        slug: 'redaction-audit',
        systemPrompt: 'Verify secret stripping.',
        openRouterKey: 'sk-or-v1-supersecret999999999999',
        mcps: [
          {
            id: 'mcp_sec',
            name: 'Protected MCP',
            url: 'https://stitch.googleapis.com/mcp',
            type: 'http',
            headers: {
              Authorization: 'Bearer mcp_top_secret_token_abc',
              'X-Custom-Header': 'public-meta'
            }
          }
        ]
      }
    });
    expect(createRes.status()).toBe(201);
    const createdBody = await createRes.json();
    const createdId = createdBody.agent.id;
    expect(createdBody.agent.openRouterKey).toBeUndefined();
    expect(createdBody.agent.mcps[0].headers.Authorization).toBe('[REDACTED]');
    expect(createdBody.agent.mcps[0].headers['X-Custom-Header']).toBe('[REDACTED]');

    // Verify GET /api/agents/:id also redacts secrets
    const getRes = await request.get(`${BASE_URL}/api/agents/${createdId}`);
    const getText = await getRes.text();
    expect(getText).not.toContain('sk-or-v1-supersecret999999999999');
    expect(getText).not.toContain('mcp_top_secret_token_abc');

    // Verify MCP resources/read also redacts secrets
    const mcpReadRes = await request.post(`${BASE_URL}/mcp`, {
      data: {
        jsonrpc: '2.0',
        id: 99,
        method: 'resources/read',
        params: { uri: `agent://${createdId}` }
      }
    });
    const mcpReadText = await mcpReadRes.text();
    expect(mcpReadText).not.toContain('sk-or-v1-supersecret999999999999');
    expect(mcpReadText).not.toContain('mcp_top_secret_token_abc');

    // Cleanup test agent
    await request.delete(`${BASE_URL}/api/agents/${createdId}`);

    // 4. Input validation & IPv6/Metadata SSRF rejection on POST /api/agents
    const badTemp = await request.post(`${BASE_URL}/api/agents`, {
      data: { name: 'Invalid Temp', temperature: 9.5 }
    });
    expect(badTemp.status()).toBe(400);

    const ipv6Ssrf = await request.post(`${BASE_URL}/api/agents`, {
      data: {
        name: 'SSRF Agent',
        mcps: [{ id: 'm1', name: 'Bad', url: 'http://[::1]:8080/mcp', type: 'http' }]
      }
    });
    expect(ipv6Ssrf.status()).toBe(400);
    expect((await ipv6Ssrf.json()).error).toContain('SSRF guard blocked');

    const metaSsrf = await request.post(`${BASE_URL}/api/mcp/probe`, {
      data: { url: 'http://metadata.google.internal/computeMetadata/v1/' }
    });
    expect(metaSsrf.status()).toBe(400);

    const mappedIpv6Ssrf = await request.post(`${BASE_URL}/api/mcp/probe`, {
      data: { url: 'http://[::ffff:127.0.0.1]/mcp' }
    });
    expect(mappedIpv6Ssrf.status()).toBe(400);
    expect((await mappedIpv6Ssrf.json()).error).toContain('SSRF guard blocked');

    const portSsrf = await request.post(`${BASE_URL}/api/mcp/probe`, {
      data: { url: 'https://example.com:6379/mcp' }
    });
    expect(portSsrf.status()).toBe(400);
    expect((await portSsrf.json()).error).toContain('SSRF guard blocked');

    // Starter agent overwrite protection on POST /api/agents
    const overwriteStarter = await request.post(`${BASE_URL}/api/agents`, {
      data: { id: 'agt_design_critic', name: 'Hijacked Starter' }
    });
    expect(overwriteStarter.status()).toBe(403);

    // Unknown OpenAI model returns 404 instead of silent fallback, and non-string task does not crash
    const unknownModelRes = await request.post(`${BASE_URL}/v1/chat/completions`, {
      data: { model: 'nonexistent-model-xyz', messages: [{ role: 'user', content: 'hi' }] }
    });
    expect(unknownModelRes.status()).toBe(404);

    const numericTaskRes = await request.post(`${BASE_URL}/api/agents/agt_design_critic/run`, {
      data: { task: 42 as any }
    });
    expect(numericTaskRes.status()).toBe(200);

    // 5. Mint a real wire_live_... API key and verify it authenticates all private agent endpoints
    const keyRes = await request.post(`${BASE_URL}/api/keys`, {
      data: { name: 'Launch Audit Key' }
    });
    expect(keyRes.status()).toBe(201);
    const keyBody = await keyRes.json();
    expect(keyBody.key).toMatch(/^wire_live_/);

    const privRes = await request.post(`${BASE_URL}/api/agents`, {
      data: { name: 'Private Key Test Agent', visibility: 'private' }
    });
    expect(privRes.status()).toBe(201);
    const privId = (await privRes.json()).agent.id;

    expect((await request.get(`${BASE_URL}/api/agents/${privId}`)).status()).toBe(401);
    expect((await request.get(`${BASE_URL}/api/agents/${privId}/runs`)).status()).toBe(401);
    expect((await request.get(`${BASE_URL}/api/agents/${privId}/sessions`)).status()).toBe(401);
    expect((await request.delete(`${BASE_URL}/api/agents/${privId}`)).status()).toBe(401);

    const unauthRun = await request.post(`${BASE_URL}/api/agents/${privId}/run`, {
      data: { task: 'Hello' }
    });
    expect(unauthRun.status()).toBe(401);

    const authRun = await request.post(`${BASE_URL}/api/agents/${privId}/run`, {
      headers: { Authorization: `Bearer ${keyBody.key}` },
      data: { task: 'Hello' }
    });
    expect(authRun.status()).toBe(200);

    const authDelete = await request.delete(`${BASE_URL}/api/agents/${privId}`, {
      headers: { Authorization: `Bearer ${keyBody.key}` }
    });
    expect(authDelete.status()).toBe(200);
    await request.delete(`${BASE_URL}/api/keys/${keyBody.keyMeta.id}`);

    // 6. Rate limiting on authentication endpoint (<= 10 attempts / 15 min)
    const testIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`;
    let lastStatus = 200;
    for (let i = 0; i < 11; i++) {
      const r = await request.post(`${BASE_URL}/api/auth/openrouter-exchange`, {
        headers: { 'X-Forwarded-For': testIp },
        data: { code: '' } // fails fast on validation before outbound call while consuming auth quota
      });
      lastStatus = r.status();
    }
    expect(lastStatus).toBe(429);
  });

  test('3. Static asset caching (immutable hashed bundles + bfcache-friendly HTML)', async ({ request }) => {
    const htmlRes = await request.get(`${BASE_URL}/`);
    expect(htmlRes.status()).toBe(200);
    expect(htmlRes.headers()['cache-control']).toBe('no-cache');
    expect(htmlRes.headers()['cache-control']).not.toContain('no-store');
    expect(htmlRes.headers()['content-security-policy']).toContain("script-src 'self'");

    const html = await htmlRes.text();
    const assetMatch = html.match(/assets\/index-[^"']+\.js/);
    expect(assetMatch).toBeTruthy();

    const jsRes = await request.get(`${BASE_URL}/${assetMatch![0]}`, {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    expect(jsRes.status()).toBe(200);
    expect(jsRes.headers()['cache-control']).toBe('public, max-age=31536000, immutable');

    // Verify q=0 content negotiation returns HTML rather than Markdown
    const qZeroRes = await request.get(`${BASE_URL}/`, {
      headers: { Accept: 'text/markdown;q=0, text/html;q=1' }
    });
    expect(qZeroRes.status()).toBe(200);
    expect(qZeroRes.headers()['content-type']).toContain('text/html');
  });

  test('4. WCAG 2.1 AA Accessibility (axe-core) + Skip Link + Modal Focus Trap across all views', async ({ page }) => {
    const formatViolations = (violations: any[]) =>
      violations.map(v => `${v.id}: ${v.nodes.map((n: any) => n.html).join(' | ')}`);

    await page.goto(BASE_URL);

    // Verify Skip-to-Content link works via keyboard
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: /Skip to main content/i });
    await expect(skipLink).toBeFocused();

    // 1. Audit Overview / Landing Page
    const landingScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(formatViolations(landingScan.violations)).toEqual([]);

    // 2. Audit Active Fleet View + Agent Runner Modal (Sandbox, History, Evals)
    await page.getByRole('tab', { name: /Fleet/i }).click();
    await expect(page.getByRole('heading', { name: /Active Fleet/i })).toBeVisible();
    const fleetScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(formatViolations(fleetScan.violations)).toEqual([]);

    await page.locator('[role="listitem"]').first().click();
    const runnerDialog = page.getByRole('dialog');
    await expect(runnerDialog).toBeVisible();
    for (const tabName of ['Sandbox', 'History & Traces', 'Evals & Protocols']) {
      await runnerDialog.getByRole('button', { name: tabName }).click();
      const runnerScan = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(formatViolations(runnerScan.violations)).toEqual([]);
    }
    await page.keyboard.press('Escape');
    await expect(runnerDialog).not.toBeVisible();

    // 3. Audit Agent Studio View
    await page.getByRole('tab', { name: /New Agent/i }).click();
    await expect(page.getByRole('heading', { name: /Agent Studio/i })).toBeVisible();
    const studioScan = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(formatViolations(studioScan.violations)).toEqual([]);

    // 4. Audit API Keys Modal + Focus Trap
    await page.getByRole('button', { name: /Manage API Keys/i }).click();
    const keysDialog = page.getByRole('dialog', { name: /AgentWire API Keys/i });
    await expect(keysDialog).toBeVisible();
    const keysScan = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(formatViolations(keysScan.violations)).toEqual([]);

    // Tab multiple times and verify focus remains trapped inside modal
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const insideModal = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return Boolean(dlg && dlg.contains(document.activeElement));
      });
      expect(insideModal).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(keysDialog).not.toBeVisible();

    // 5. Audit OpenRouter Auth Modal
    await page.getByRole('button', { name: 'Connect OpenRouter', exact: true }).click();
    const authDialog = page.getByRole('dialog', { name: /OpenRouter Model Gateway/i });
    await expect(authDialog).toBeVisible();
    const authScan = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(formatViolations(authScan.violations)).toEqual([]);
    await page.keyboard.press('Escape');
  });
});

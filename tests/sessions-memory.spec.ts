import { test, expect } from '@playwright/test';

test.describe('Agent History, Context & Persistent Memory Suite', () => {
  const baseUrl = 'http://localhost:8787';

  // 1. Multi-turn conversation history persistence
  test('Preserves conversation history across turns within a stateful session', async ({ request }) => {
    const sessionId = `ses_conv_${Date.now()}`;

    // Turn 1: Introduce preference
    const turn1Res = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: {
        'X-Session-ID': sessionId
      },
      data: {
        task: 'Our engineering stack strictly requires Tailwind CSS v4 and TypeScript.'
      }
    });

    expect(turn1Res.ok()).toBeTruthy();
    expect(turn1Res.headers()['x-agentwire-session-id']).toBe(sessionId);

    const turn1Body = await turn1Res.json();
    expect(turn1Body.sessionId).toBe(sessionId);
    expect(turn1Body.sessionMessagesCount).toBe(2);

    // Turn 2: Ask question reliant on Turn 1 context
    const turn2Res = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      headers: {
        'X-Session-ID': sessionId
      },
      data: {
        task: 'What CSS framework and programming language does our stack require?'
      }
    });

    expect(turn2Res.ok()).toBeTruthy();
    const turn2Body = await turn2Res.json();
    expect(turn2Body.sessionId).toBe(sessionId);
    expect(turn2Body.sessionMessagesCount).toBe(4);
    expect(turn2Body.result).toMatch(/Tailwind/i);
    expect(turn2Body.result).toMatch(/TypeScript/i);
  });

  // 2. Persistent working memory & progressive state updates
  test('Maintains and progressively updates working memory across session runs', async ({ request }) => {
    const sessionId = `ses_mem_${Date.now()}`;

    // Run 1: Seed memory
    const run1 = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      data: {
        sessionId,
        task: 'Initialize architectural review.',
        memory: {
          deploymentEnv: 'production',
          maxContrastRatio: 7.0
        }
      }
    });

    expect(run1.ok()).toBeTruthy();
    const body1 = await run1.json();
    expect(body1.memory).toEqual({
      deploymentEnv: 'production',
      maxContrastRatio: 7.0
    });

    // Run 2: Mutate/add memory keys
    const run2 = await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      data: {
        sessionId,
        task: 'Update review threshold.',
        memory: {
          maxContrastRatio: 8.5,
          auditor: 'Lika'
        }
      }
    });

    expect(run2.ok()).toBeTruthy();
    const body2 = await run2.json();
    expect(body2.memory).toEqual({
      deploymentEnv: 'production',
      maxContrastRatio: 8.5,
      auditor: 'Lika'
    });
  });

  // 3. Call-level context injection
  test('Injects call-level context into agent execution thought traces', async ({ request }) => {
    const res = await request.post(`${baseUrl}/api/agents/agt_pr_triage/run`, {
      data: {
        task: 'Verify git commit metadata and PR number.',
        context: {
          prNumber: 104,
          author: 'hemanth',
          repository: 'agent-wire'
        }
      }
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe('success');
    expect(body.steps.length).toBeGreaterThan(0);
  });

  // 4. Session REST API Lifecycle (List, Get, Delete)
  test('Supports session lifecycle endpoints: list, inspect detail, and delete', async ({ request }) => {
    const sessionId = `ses_lifecycle_${Date.now()}`;

    // Create session via run
    await request.post(`${baseUrl}/api/agents/agt_design_critic/run`, {
      data: {
        sessionId,
        task: 'Audit typography hierarchy and line lengths.',
        memory: { focus: 'typography' }
      }
    });

    // List sessions
    const listRes = await request.get(`${baseUrl}/api/agents/agt_design_critic/sessions`);
    expect(listRes.ok()).toBeTruthy();
    const listData = await listRes.json();
    expect(Array.isArray(listData.sessions)).toBeTruthy();
    expect(listData.sessions.some((s: any) => s.id === sessionId)).toBeTruthy();

    // Get session detail
    const detailRes = await request.get(`${baseUrl}/api/agents/agt_design_critic/sessions/${sessionId}`);
    expect(detailRes.ok()).toBeTruthy();
    const detailData = await detailRes.json();
    expect(detailData.id).toBe(sessionId);
    expect(detailData.messages.length).toBe(2);
    expect(detailData.memory).toEqual({ focus: 'typography' });

    // Delete session
    const deleteRes = await request.delete(`${baseUrl}/api/agents/agt_design_critic/sessions/${sessionId}`);
    expect(deleteRes.ok()).toBeTruthy();

    // Verify 404 after deletion
    const verifyRes = await request.get(`${baseUrl}/api/agents/agt_design_critic/sessions/${sessionId}`);
    expect(verifyRes.status()).toBe(404);
  });

  // 5. In-Browser UI: Session Mode toggle, Memory Inspector, and Run
  test('UI enables switching to Stateful Thread mode with working memory inspector', async ({ page }) => {
    await page.goto(baseUrl);

    // Open Taste & Design Critic runner by clicking the agent card
    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Modal is visible
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    // Switch to Stateful Thread mode
    const threadToggle = modal.getByRole('button', { name: 'Stateful Thread' });
    await expect(threadToggle).toBeVisible();
    await threadToggle.click();

    // Session ID input is visible
    const sessionInput = modal.locator('#session-id-input');
    await expect(sessionInput).toBeVisible();

    // Open Memory Inspector
    const memoryBtn = modal.getByRole('button', { name: /Memory \(\d+\)/ });
    await expect(memoryBtn).toBeVisible();
    await memoryBtn.click();

    // Add key and value to memory
    await modal.getByPlaceholder('Key').fill('theme');
    await modal.getByPlaceholder('Value').fill('dark');
    await modal.getByRole('button', { name: 'Add' }).click();

    // Verify key was added to memory list
    await expect(modal.getByText('theme:')).toBeVisible();

    // Run task with session
    const textarea = modal.locator('#task-prompt-input');
    await textarea.fill('Check our component styling using the configured memory theme.');
    await modal.getByRole('button', { name: 'Run Task' }).click();

    // Wait for response and verify Session badge in Agent Output
    const sessionBadge = modal.locator('span:has-text("Session:")');
    await expect(sessionBadge).toBeVisible({ timeout: 15000 });
    await expect(sessionBadge).toContainText('2 msgs');
  });
});

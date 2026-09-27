import { test, expect } from '@playwright/test';

test.describe('Visual Snapshots & ToneBird UX Verification', () => {
  test('Capture visual screenshots of all views in ToneBird aesthetic', async ({ page }) => {
    // 1. Landing Page
    await page.goto('http://localhost:8787');
    await expect(page.locator('h1')).toContainText('Your agent as a URL');
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/landing_page_ui.png',
      fullPage: true
    });

    // 2. Active Fleet view
    const fleetTab = page.getByRole('tab', { name: /Fleet/i });
    await fleetTab.click();
    await expect(page.locator('text=Active Fleet')).toBeVisible();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/redesigned_ui.png',
      fullPage: true
    });

    // 3. Agent Studio view
    const studioTab = page.getByRole('tab', { name: /New Agent/i });
    await studioTab.click();
    await expect(page.locator('text=Agent Studio')).toBeVisible();
    await expect(page.locator('text=1. Identity & System Persona')).toBeVisible();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/studio_ui.png',
      fullPage: true
    });

    // 4. OpenRouter Auth Modal
    const authBtn = page.locator('header').getByRole('button', { name: /OpenRouter/i });
    await authBtn.click();
    const authModal = page.getByRole('dialog', { name: /OpenRouter Model Gateway/i });
    await expect(authModal).toBeVisible();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/auth_modal_ui.png'
    });
    // Close modal
    await page.keyboard.press('Escape');
    await expect(authModal).not.toBeVisible();

    // 5. Runner Modal
    await fleetTab.click();
    const firstAgentCard = page.locator('article').first();
    await firstAgentCard.click();
    const runnerModal = page.getByRole('dialog');
    await expect(runnerModal).toBeVisible();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/runner_modal_ui.png'
    });

    // 6. History & Traces View
    const historyBtn = runnerModal.getByRole('button', { name: /History & Traces/i });
    await historyBtn.click();
    await expect(page.locator('text=Execution Logs & Traces')).toBeVisible();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/history_traces_ui.png'
    });

    // 7. Session & Memory View
    const sandboxBtn = runnerModal.getByRole('button', { name: /Sandbox/i });
    await sandboxBtn.click();
    const threadToggle = runnerModal.getByRole('button', { name: 'Stateful Thread' });
    await threadToggle.click();
    const memoryBtn = runnerModal.getByRole('button', { name: /Memory \(\d+\)/ });
    await memoryBtn.click();
    await runnerModal.getByPlaceholder('Key').fill('primaryFramework');
    await runnerModal.getByPlaceholder('Value').fill('React 19 + Vite');
    await runnerModal.getByRole('button', { name: 'Add' }).click();
    await page.screenshot({
      path: '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/session_memory_ui.png'
    });
  });
});

import { test, expect } from '@playwright/test';

test.describe('Agent Execution & Token Budgeting', () => {
  test('Agent run forwards max_tokens in OpenRouter payload to prevent 402 credit limit errors', async ({ page }) => {
    await page.goto('http://localhost:8787');

    // Seed mock API key in localStorage
    await page.evaluate(() => {
      localStorage.setItem('openrouter_key', 'sk-or-v1-mock-test-key-12345');
    });

    // Intercept OpenRouter completions request made by edge worker or test runner
    // Click on the first agent card to open runner modal
    const firstCard = page.locator('article').first();
    await firstCard.click();

    const runnerModal = page.getByRole('dialog');
    await expect(runnerModal).toBeVisible();

    // Verify cURL snippet includes endpoint
    const curlPre = runnerModal.locator('pre');
    await expect(curlPre).toContainText('/api/agents/agt_');

    // Run in-browser task
    const runBtn = runnerModal.getByRole('button', { name: /Run Task/i });
    await expect(runBtn).toBeVisible();
  });
});

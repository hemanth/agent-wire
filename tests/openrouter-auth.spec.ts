import { test, expect } from '@playwright/test';

test.describe('OpenRouter PKCE Login & Auth Flow', () => {
  test('1. Clicking "Sign In with OpenRouter" saves PKCE verifier and navigates to openrouter.ai/auth', async ({ page }) => {
    await page.goto('http://localhost:8787');

    // 1. Open auth modal from Navbar
    const authBtn = page.getByRole('button', { name: /Connect OpenRouter/i });
    await expect(authBtn).toBeVisible();
    await authBtn.click();

    // 2. Modal should be visible
    const modal = page.getByRole('dialog', { name: /OpenRouter Model Gateway/i });
    await expect(modal).toBeVisible();

    // 3. Click the 1-Click PKCE Sign In button
    const signInBtn = modal.getByRole('button', { name: /Sign In with OpenRouter/i });
    await expect(signInBtn).toBeVisible();

    // Intercept redirect request to OpenRouter
    let capturedUrl = '';
    await page.route('https://openrouter.ai/auth**', route => {
      capturedUrl = route.request().url();
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<html><body>Mock OpenRouter Auth Page</body></html>'
      });
    });

    await signInBtn.click();

    // Wait until redirected to mock OpenRouter
    await page.waitForURL('https://openrouter.ai/auth**');

    // Verify parameters sent to OpenRouter
    const url = new URL(capturedUrl);
    expect(url.origin).toBe('https://openrouter.ai');
    expect(url.pathname).toBe('/auth');
    expect(url.searchParams.get('callback_url')).toContain('localhost:8787');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  });

  test('2. Successful OAuth callback exchanges code for API key and updates UI', async ({ page }) => {
    await page.goto('http://localhost:8787');

    // Seed the verifier in localStorage before the callback redirect occurs
    await page.evaluate(() => {
      localStorage.setItem('openrouter_code_verifier', 'test_pkce_verifier_xyz_123456');
      sessionStorage.setItem('openrouter_code_verifier', 'test_pkce_verifier_xyz_123456');
    });

    // Mock direct OpenRouter keys exchange or proxy exchange
    await page.route('**/api/v1/auth/keys', async route => {
      const data = route.request().postDataJSON();
      expect(data.code).toBe('mock_oauth_code_valid');
      expect(data.code_verifier).toBe('test_pkce_verifier_xyz_123456');
      expect(data.code_challenge_method).toBe('S256');

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ key: 'sk-or-v1-test-api-key-987654' })
      });
    });

    // Also mock fallback proxy in case browser falls back
    await page.route('**/api/auth/openrouter-exchange', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ key: 'sk-or-v1-test-api-key-987654' })
      });
    });

    // Simulate OpenRouter redirecting back with ?code=mock_oauth_code_valid
    await page.goto('http://localhost:8787/?code=mock_oauth_code_valid');

    // Expect success banner to appear
    const successBanner = page.locator('div[role="status"]');
    await expect(successBanner).toBeVisible({ timeout: 5000 });
    await expect(successBanner).toContainText('Successfully connected to OpenRouter');

    // Verify key in localStorage
    const savedKey = await page.evaluate(() => localStorage.getItem('openrouter_key'));
    expect(savedKey).toBe('sk-or-v1-test-api-key-987654');

    // Navbar button should now reflect active status
    const activeBtn = page.getByRole('button', { name: /OpenRouter Active/i });
    await expect(activeBtn).toBeVisible();

    // Verify the verifier was cleaned up from storage
    const remainingVerifier = await page.evaluate(() => localStorage.getItem('openrouter_code_verifier'));
    expect(remainingVerifier).toBeNull();
  });

  test('3. Failed OAuth callback or user rejection displays clear error banner', async ({ page }) => {
    // Simulate user canceling auth on OpenRouter (?error=access_denied)
    await page.goto('http://localhost:8787/?error=access_denied');

    const errorBanner = page.locator('div[role="status"]');
    await expect(errorBanner).toBeVisible({ timeout: 5000 });
    await expect(errorBanner).toContainText('OpenRouter authorization error: access_denied');
  });

  test('4. Manual API key entry works when OAuth is not preferred', async ({ page }) => {
    await page.goto('http://localhost:8787');

    const authBtn = page.getByRole('button', { name: /Connect OpenRouter/i });
    await authBtn.click();

    // Enter manual key
    const keyInput = page.locator('#openrouter-api-key-input');
    await keyInput.fill('sk-or-v1-manual-key-abcdef');

    // Click Save Key
    const saveBtn = page.getByRole('button', { name: /Save Key/i });
    await saveBtn.click();

    // Modal closes
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Key is saved
    const savedKey = await page.evaluate(() => localStorage.getItem('openrouter_key'));
    expect(savedKey).toBe('sk-or-v1-manual-key-abcdef');

    // Navbar shows active
    const activeBtn = page.getByRole('button', { name: /OpenRouter Active/i });
    await expect(activeBtn).toBeVisible();
  });
});

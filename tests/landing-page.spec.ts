import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Landing Page & Pastel Design System', () => {
  test('Landing page loads with Coolors pastel architectural theme and full navigation', async ({ page }) => {
    // Navigate to root
    await page.goto('http://localhost:8787');

    // 1. Verify Hero section title and value proposition
    const heroHeading = page.locator('h1');
    await expect(heroHeading).toContainText('Turn Prompts & Remote MCP Servers into Instant');
    await expect(heroHeading).toContainText('Curlable Endpoints');

    // 2. Verify Coolors.co Architectural Palette Legend
    const legend = page.locator('text=System Architecture Color Map');
    await expect(legend).toBeVisible();
    await expect(page.locator('text=MCP Connectors').first()).toBeVisible();
    await expect(page.locator('text=Model Routing').first()).toBeVisible();
    await expect(page.locator('text=Attached Skills').first()).toBeVisible();
    await expect(page.locator('text=Edge Runtime').first()).toBeVisible();
    await expect(page.locator('text=cURL Endpoint').first()).toBeVisible();

    // 3. Verify Problem & Solution Cards (5 cards)
    const problemGrid = page.locator('text=What AgentWire Solves');
    await expect(problemGrid).toBeVisible();
    await expect(page.locator('text=Remote MCP Discovery')).toBeVisible();
    await expect(page.locator('text=Provider Outage Immunity')).toBeVisible();
    await expect(page.locator('text=Enforced Domain Standards')).toBeVisible();

    // 4. Verify Interactive Terminal Section
    const terminalHeading = page.locator('text=Universal Terminal & API Integration');
    await expect(terminalHeading).toBeVisible();
    const copyButton = page.locator('button:has-text("Copy")').first();
    await expect(copyButton).toBeVisible();

    // 5. Capture screenshot of the full landing page for visual verification
    const screenshotPath = '/Users/lika/.gemini/antigravity-cli/brain/4fd99f72-20af-4d22-b050-98f3a394b625/landing_page_ui.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // 6. Test Navigation to Studio via Hero CTA
    const deployHeroBtn = page.getByRole('button', { name: /Deploy Your First Agent/i }).first();
    await deployHeroBtn.click();
    await expect(page.locator('text=Agent Studio')).toBeVisible();
    await expect(page.locator('text=Configure persona, remote MCP tools')).toBeVisible();

    // 7. Test Navigation back to Overview
    const overviewTab = page.getByRole('tab', { name: /Overview/i });
    await overviewTab.click();
    await expect(heroHeading).toBeVisible();

    // 8. Test Navigation to Fleet
    const fleetTab = page.getByRole('tab', { name: /Fleet/i });
    await fleetTab.click();
    await expect(page.locator('text=Active Fleet')).toBeVisible();
  });
});

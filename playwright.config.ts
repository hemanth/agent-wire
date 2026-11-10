import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: {
    command: 'npm run build && node dev-server.mjs',
    url: 'http://localhost:8787/api/health',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    env: {
      OPENROUTER_API_KEY: '',
      ENVIRONMENT: 'development',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

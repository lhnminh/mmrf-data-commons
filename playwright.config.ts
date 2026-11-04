import { defineConfig, devices } from '@playwright/test';

// Fast tier (default project) mocks the agent. Tests tagged @live run only in project `live`.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  projects: [
    { name: 'fast', grepInvert: /@live/ },
    { name: 'live', grep: /@live/, timeout: 180_000 },
  ],
  webServer: [
    {
      // Forwards to the deployed Virtual Lab; reads SANDBOX_ACCESS_FILE.
      command: 'node scripts/dev-forward.mjs',
      url: 'http://127.0.0.1:3090/sandbox/session',
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npx next dev --turbopack -H 127.0.0.1 -p 3000',
      url: 'http://127.0.0.1:3000/Login',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});

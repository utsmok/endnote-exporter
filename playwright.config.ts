import path from 'node:path';

const { defineConfig, devices } = require(path.resolve(
  __dirname,
  'web/node_modules/@playwright/test',
)) as typeof import('@playwright/test');

const webDir = path.resolve(__dirname, 'web');
const playwrightPort = Number.parseInt(process.env.PLAYWRIGHT_BASE_PORT ?? '4173', 10);
const resolvedPort = Number.isFinite(playwrightPort) && playwrightPort > 0 ? playwrightPort : 4173;
const baseUrl = `http://127.0.0.1:${resolvedPort}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_SERVER === '1';

export default defineConfig({
  testDir: path.resolve(__dirname, 'web/tests/e2e'),
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: baseUrl,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
  outputDir: path.resolve(webDir, '.playwright-artifacts/test-results'),
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${resolvedPort} --strictPort`,
    cwd: webDir,
    reuseExistingServer,
    timeout: 120_000,
    url: baseUrl,
  },
  workers: process.env.CI ? 1 : undefined,
});

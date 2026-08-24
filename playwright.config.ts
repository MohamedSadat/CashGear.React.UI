import { defineConfig, devices } from '@playwright/test';

const semantic = /.*\.browser\.spec\.ts/u;
const visual = /.*\.visual\.spec\.ts/u;

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  globalSetup: './tests/browser/global-setup.ts',
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:6006',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium-semantic', testMatch: semantic, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-semantic', testMatch: semantic, use: { ...devices['Desktop Firefox'], launchOptions: { timeout: 30_000, firefoxUserPrefs: { 'gfx.webrender.force-disabled': true } } } },
    { name: 'webkit-semantic', testMatch: semantic, use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-visual', testMatch: visual, use: { ...devices['Desktop Chrome'] } },
  ],
});

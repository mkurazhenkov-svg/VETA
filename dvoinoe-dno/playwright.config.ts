import { defineConfig } from '@playwright/test';

// e2e идут по собранному dist/index.html (тот же файл, что открывают в музее и на кафедре).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    viewport: { width: 1600, height: 900 },
    launchOptions: { executablePath: process.env.PW_CHROMIUM ?? undefined },
    trace: 'off',
  },
  outputDir: 'test-results',
});

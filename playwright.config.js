import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: {
    timeout: 15000,
  },
  retries: 0,
  fullyParallel: false,
  use: {
    baseURL: 'https://test.kumar-electricals.com',
    actionTimeout: 20000,
    navigationTimeout: 30000,
    ignoreHTTPSErrors: true,
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Mobile Chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});

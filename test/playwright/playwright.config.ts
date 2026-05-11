import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { playwrightBaseURL } from './env';

const baseURL = playwrightBaseURL();
const storageStatePath = path.join(__dirname, '.auth', 'user.json');

export default defineConfig({
  globalSetup: path.join(__dirname, 'global-setup.ts'),
  testDir: __dirname,
  outputDir: 'test-results/runs',
  snapshotDir: 'baselines',
  snapshotPathTemplate: '{snapshotDir}/{testFilePath}/{arg}{ext}',

  // Tests share case-state in MySQL and run a single auth'd user, so they
  // can't run in parallel — fullyParallel:false enforces serial within a
  // file, workers:1 across files.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'test-results/html', open: 'never' }]],

  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  use: {
    baseURL,
    viewport: { width: 1280, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        storageState: storageStatePath,
        // Attach a viewport PNG after each test so the HTML report shows how the UI ended up
        // (list + screenshot steps). Setup project stays on the root only-on-failure default.
        screenshot: 'on',
      },
    },
  ],
});

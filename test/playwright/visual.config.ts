import { defineConfig } from '@playwright/test';
import path from 'node:path';
import existing from './playwright.config';

// Routine CSS/layout regression gate. The full behavioral suite stays separate.
export default defineConfig({
  ...existing,
  reporter: [['list'], ['html', { outputFolder: path.join(__dirname, 'test-results', 'visual-report'), open: 'never' }]],
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100, animations: 'disabled', caret: 'hide' },
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'visual',
      dependencies: ['setup'],
      testMatch: /visual_smoke\.spec\.ts/,
      use: existing.projects![1].use,
    },
  ],
});

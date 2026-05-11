import type { FullConfig } from '@playwright/test';
import { playwrightBaseURL } from './env';

const CONNECT_TIMEOUT_MS = 10_000;

/**
 * Fails fast with a clear message when Playwright is run without the app listening.
 * E2E targets the Docker dev port by default (see test/playwright/env.ts).
 */
export default async function globalSetup(_config: FullConfig): Promise<void> {
  const baseURL = playwrightBaseURL();
  const url = baseURL.replace(/\/$/, '') + '/';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (res.status >= 500) {
      throw new Error(`Quepid at ${baseURL} returned HTTP ${res.status} (server error while starting up?)`);
    }
  } catch (err) {
    const cause = err instanceof Error ? err.message : String(err);
    const msg = [
      `Playwright cannot reach Quepid at ${baseURL} (${cause}).`,
      '',
      'Start the stack first (Docker is the primary workflow), then wait until the app responds in a browser:',
      '  bin/docker s',
      '',
      'Default base URL is http://localhost:33000 (docker-compose maps app 3000 -> host 33000).',
      'To use another URL:',
      '  QUEPID_BASE_URL=http://127.0.0.1:PORT yarn test:e2e',
    ].join('\n');
    throw new Error(msg);
  } finally {
    clearTimeout(timer);
  }
}

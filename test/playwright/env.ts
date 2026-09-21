import { existsSync } from 'node:fs';

/**
 * Resolves the URL the E2E suite points a browser at.
 *
 * `QUEPID_BASE_URL` always wins. Absent that, the default is derived rather than hardcoded,
 * because the right port depends on which side of Docker you're on: run inside the app container
 * (the intended way — see DEVELOPER_GUIDE.md) the app is its own `localhost:3000`, while from the
 * host it's whatever `docker-compose` published, `${APP_PORT:-3000}`.
 *
 * With RAILS_RELATIVE_URL_ROOT, include the subpath:
 *   QUEPID_BASE_URL=http://localhost:3000/quepid-app
 *
 * Always returns a trailing slash so Playwright resolves relative page.goto() paths under the
 * mount (e.g. goto('books') -> /quepid-app/books, not /books).
 */
export function playwrightBaseURL(): string {
  const raw = process.env.QUEPID_BASE_URL?.trim() || `http://localhost:${defaultPort()}`;

  return raw.endsWith('/') ? raw : `${raw}/`;
}

function defaultPort(): string {
  // Inside the container the app listens on 3000 regardless of how the host published it.
  if (insideContainer()) {
    return '3000';
  }

  return process.env.APP_PORT?.trim() || '3000';
}

/** docker-compose sets DOCKER_CONTAINER on the app service; /.dockerenv covers other runners. */
function insideContainer(): boolean {
  return process.env.DOCKER_CONTAINER === 'true' || existsSync('/.dockerenv');
}

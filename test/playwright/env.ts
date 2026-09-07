/**
 * Default matches docker-compose: app publishes host port 33000 -> container 3000.
 * Override host/port: QUEPID_BASE_URL=http://127.0.0.1:3000
 * With RAILS_RELATIVE_URL_ROOT, include the subpath:
 *   QUEPID_BASE_URL=http://localhost:33000/quepid-app
 *
 * Always returns a trailing slash so Playwright resolves relative page.goto() paths
 * under the mount (e.g. goto('books') -> /quepid-app/books, not /books).
 */
export function playwrightBaseURL(): string {
  const raw = process.env.QUEPID_BASE_URL ?? 'http://localhost:33000';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

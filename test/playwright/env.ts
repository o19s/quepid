/**
 * Default matches docker-compose: app publishes host port 33000 -> container 3000.
 * Override host/port: QUEPID_BASE_URL=http://127.0.0.1:3000
 * With RAILS_RELATIVE_URL_ROOT, include the subpath (no trailing slash):
 *   QUEPID_BASE_URL=http://localhost:33000/quepid-app
 */
export function playwrightBaseURL(): string {
  return process.env.QUEPID_BASE_URL ?? 'http://localhost:33000';
}

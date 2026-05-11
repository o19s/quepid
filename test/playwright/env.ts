/**
 * Default matches docker-compose: app publishes host port 33000 -> container 3000.
 * Override for a different host or port: QUEPID_BASE_URL=http://127.0.0.1:3000
 */
export function playwrightBaseURL(): string {
  return process.env.QUEPID_BASE_URL ?? 'http://localhost:33000';
}

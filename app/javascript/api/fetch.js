/**
 * Centralized fetch wrapper for Quepid API calls. Adds CSRF token automatically.
 * Use this instead of raw fetch or jQuery $.ajax for all new API code.
 *
 * @example
 *   import { apiFetch } from "api/fetch"
 *   const res = await apiFetch("/api/cases/1", { method: "DELETE" })
 *
 * @example
 *   const res = await apiFetch(url, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(data)
 *   })
 *
 * @see docs/app_structure.md — URL generation: use data-* attributes or getQuepidRootUrl() + path
 */

const CSRF_HEADER = 'X-CSRF-Token';

/**
 * Reads the CSRF token from the page's meta tag (set by Rails csrf_meta_tags).
 * @returns {string} Token or empty string if not found
 */
export function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

/**
 * Merges CSRF token into request headers. Does not overwrite existing X-CSRF-Token.
 * @param {HeadersInit} [headers] - Existing headers (object or Headers)
 * @returns {Record<string, string>} Headers with CSRF token
 */
function headersWithCsrf(headers = {}) {
  const token = getCsrfToken();
  const out =
    typeof headers === 'object' && headers !== null && !(headers instanceof Headers)
      ? { ...headers }
      : headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : {};
  if (!(CSRF_HEADER in out) || out[CSRF_HEADER] === '') {
    out[CSRF_HEADER] = token;
  }
  return out;
}

/**
 * Fetch with CSRF token automatically added to headers.
 * Mirrors the native fetch API; all options are passed through.
 *
 * @param {string|Request} input - URL or Request object
 * @param {RequestInit} [init] - Fetch options (method, headers, body, etc.)
 * @returns {Promise<Response>}
 */
export function apiFetch(input, init = {}) {
  const merged = { ...init };
  merged.headers = headersWithCsrf(init.headers);
  return fetch(input, merged);
}

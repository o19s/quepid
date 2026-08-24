/**
 * Centralized fetch wrapper for Quepid API calls. Adds CSRF token automatically.
 * Use this instead of raw fetch for mutating requests in Stimulus controllers.
 *
 * @example
 *   import { apiFetch } from "api/fetch"
 *   const res = await apiFetch(this.saveUrlValue, {
 *     method: "POST",
 *     headers: { "Content-Type": "application/json" },
 *     body: JSON.stringify(data)
 *   })
 *
 * Prefer server-passed URLs (`data-*-url-value`, `formTarget.action`) over
 * client-built paths. See DEVELOPER_GUIDE § Stimulus HTTP conventions.
 */

const CSRF_HEADER = "X-CSRF-Token"

/**
 * Reads the CSRF token from the page's meta tag (set by Rails csrf_meta_tags).
 * @returns {string} Token or empty string if not found
 */
export function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || ""
}

/**
 * Merges CSRF token into request headers. Does not overwrite existing X-CSRF-Token.
 * @param {HeadersInit} [headers] - Existing headers (object or Headers)
 * @returns {Record<string, string>} Headers with CSRF token
 */
function headersWithCsrf(headers = {}) {
  const token = getCsrfToken()
  const out =
    typeof headers === "object" && headers !== null && !(headers instanceof Headers)
      ? { ...headers }
      : headers instanceof Headers
        ? Object.fromEntries(headers.entries())
        : {}
  if (!(CSRF_HEADER in out) || out[CSRF_HEADER] === "") {
    out[CSRF_HEADER] = token
  }
  return out
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
  const merged = { ...init }
  merged.headers = headersWithCsrf(init.headers)
  return fetch(input, merged)
}

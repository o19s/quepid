// Thin helpers for browser fetch() to Rails JSON endpoints.
// No automatic JSON parsing, error translation, or retries — callers keep control.

import { csrfToken } from "modules/api_url"

/**
 * Default header object for Rails-backed JSON requests from Stimulus / modules.
 *
 * @param {object} [opts={}]
 * @param {boolean} [opts.acceptJson=true] - Set `Accept: application/json`
 * @param {boolean} [opts.contentTypeJson=false] - Set `Content-Type: application/json`
 * @param {boolean} [opts.csrf=true] - Set `X-CSRF-Token` when the meta tag is present
 * @returns {Record<string, string>}
 */
export function railsJsonHeaders(opts = {}) {
  const { acceptJson = true, contentTypeJson = false, csrf = true } = opts

  /** @type {Record<string, string>} */
  const headers = {}

  if (acceptJson) {
    headers.Accept = "application/json"
  }
  if (contentTypeJson) {
    headers["Content-Type"] = "application/json"
  }
  if (csrf) {
    const token = csrfToken()
    if (token) {
      headers["X-CSRF-Token"] = token
    }
  }

  return headers
}

/**
 * @param {Record<string, string>} base
 * @param {HeadersInit | undefined} extra
 * @returns {Record<string, string>}
 */
function mergeHeaderRecords(base, extra) {
  const out = { ...base }
  if (extra == null) {
    return out
  }
  if (extra instanceof Headers) {
    extra.forEach((value, key) => {
      out[key] = value
    })
    return out
  }
  if (Array.isArray(extra)) {
    for (const [k, v] of extra) {
      out[k] = v
    }
    return out
  }
  return { ...out, ...extra }
}

/**
 * `fetch` with Rails JSON defaults merged into `init.headers`.
 * When `init.body` is a string (typical `JSON.stringify`), sets `Content-Type: application/json`.
 * If `input` is a `Request`, only `init` is considered for body/header defaults (not the Request’s body).
 * Callers still check `response.ok` and parse bodies as needed.
 *
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function jsonFetch(input, init = {}) {
  const { headers: userHeaders, body, ...rest } = init

  const contentTypeJson = body !== undefined && body !== null && typeof body === "string"

  const defaults = railsJsonHeaders({
    acceptJson: true,
    contentTypeJson,
    csrf: true,
  })

  return fetch(input, {
    ...rest,
    body,
    headers: mergeHeaderRecords(defaults, userHeaders),
  })
}

/**
 * JSON helpers over `apiFetch`: send/receive JSON and turn every non-2xx
 * response into an `HttpError` (status + parsed body attached) instead of
 * leaving each caller to remember `response.ok`.
 *
 * @example
 *   const data = await postJson(this.saveUrlValue, { name })
 */

import { apiFetch } from "api/fetch"
import { HttpError } from "api/http_error"

/**
 * Parses a response body as JSON. Returns null for 204/empty bodies. A
 * non-JSON body (e.g. an HTML error page) is null on failed responses and a
 * thrown SyntaxError on successful ones, so a corrupt success is never
 * mistaken for "no data".
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
export async function readJson(response) {
  if (!response.ok) return response.json().catch(() => null)
  if (response.status === 204) return null
  const text = await response.text()
  return text ? JSON.parse(text) : null
}

/**
 * Merges default headers under whatever the caller supplied. Accepts the same
 * shapes `fetch` does (plain object, `Headers`, tuple array); a header the caller
 * set wins regardless of case. Header-name casing in the result is whatever
 * `Headers` normalizes to (lowercase in browsers).
 */
function withDefaults(supplied, defaults) {
  const callerHeaders = new Headers(supplied)
  const merged = {}
  Object.entries(defaults).forEach(([name, value]) => {
    if (!callerHeaders.has(name)) merged[name] = value
  })
  return Object.assign(merged, Object.fromEntries(callerHeaders))
}

/**
 * @param {string} url
 * @param {RequestInit} [init]
 * @returns {Promise<unknown>} parsed body
 * @throws {HttpError} on a non-2xx response
 */
export async function requestJson(url, init = {}) {
  const headers = withDefaults(init.headers, { Accept: "application/json" })
  const response = await apiFetch(url, { ...init, headers })
  const data = await readJson(response)
  if (!response.ok) {
    throw new HttpError({ status: response.status, statusText: response.statusText, data })
  }
  return data
}

export function getJson(url, init = {}) {
  return requestJson(url, { ...init, method: "GET" })
}

export function postJson(url, body, init = {}) {
  return requestJson(url, {
    ...init,
    method: init.method || "POST",
    headers: withDefaults(init.headers, { "Content-Type": "application/json" }),
    body: JSON.stringify(body)
  })
}

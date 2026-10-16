/**
 * JSON helpers over `apiFetch`: send/receive JSON and turn every non-2xx
 * response into an `HttpError` (status + parsed body attached) instead of
 * leaving each caller to remember `response.ok`.
 *
 * @example
 *   const data = await postJson(this.saveUrlValue, { name })
 *   await putJson(this.updateUrlValue, { name })
 *   await deleteJson(this.deleteUrlValue)
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
 * The status-aware primitive under the verb helpers. Use it directly only when
 * the caller needs the response status; otherwise use the verb helpers below.
 *
 * @param {string} url
 * @param {RequestInit & { json?: unknown }} [init] `json` is encoded as the
 *   request body with a JSON Content-Type.
 * @returns {Promise<{ data: unknown, ok: boolean, status: number, statusText: string }>}
 * @throws {HttpError} on a non-2xx response
 */
export async function requestJsonResponse(url, { json, headers, ...init } = {}) {
  const defaults = { Accept: "application/json" }
  if (json !== undefined) {
    defaults["Content-Type"] = "application/json"
    init.body = JSON.stringify(json)
  }
  const response = await apiFetch(url, { ...init, headers: withDefaults(headers, defaults) })
  const data = await readJson(response)
  if (!response.ok) {
    throw new HttpError({ status: response.status, statusText: response.statusText, data })
  }
  return { data, ok: true, status: response.status, statusText: response.statusText }
}

async function send(method, url, json, options) {
  const { data } = await requestJsonResponse(url, { ...options, method, json })
  return data
}

/**
 * JSON request helpers, one per HTTP verb. Each resolves to the parsed response
 * body (null for 204/empty) and rejects with an `HttpError` on a non-2xx
 * response. `options` takes the usual `fetch` init (`headers`, `signal`, ...)
 * but never `method`: pick the helper for the verb.
 */

/** @param {string} url @param {RequestInit} [options] */
export function getJson(url, options = {}) {
  return send("GET", url, undefined, options)
}

/** @param {string} url @param {unknown} [body] @param {RequestInit} [options] */
export function postJson(url, body, options = {}) {
  return send("POST", url, body, options)
}

/** @param {string} url @param {unknown} [body] @param {RequestInit} [options] */
export function putJson(url, body, options = {}) {
  return send("PUT", url, body, options)
}

/** @param {string} url @param {unknown} [body] @param {RequestInit} [options] */
export function patchJson(url, body, options = {}) {
  return send("PATCH", url, body, options)
}

/** @param {string} url @param {unknown} [body] Rarely needed; most deletes have none. @param {RequestInit} [options] */
export function deleteJson(url, body, options = {}) {
  return send("DELETE", url, body, options)
}

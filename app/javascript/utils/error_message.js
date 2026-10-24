import { HttpError } from "api/http_error"

/**
 * Extract a display-worthy message from an error of unknown shape: a plain
 * string (e.g. query.search()'s rejection), a JS Error, or an app-specific
 * { error } / HTTP-style { statusText } rejection object.
 */
export function errorMessage(error, fallback) {
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object") {
    const message = error.message || error.error || error.statusText
    if (message) return message
  }
  return fallback
}

/**
 * Like `errorMessage`, but keeps a translated search error's `{ text, href? }`
 * parts (see `utils/search_error`) so the flash can render its links.
 */
export function flashErrorMessage(error, fallback) {
  if (Array.isArray(error?.parts)) return error
  return errorMessage(error, fallback)
}

/** Use a server message or the caller's contextual HTTP fallback. */
export function serverMessage(error, fallback) {
  if (error instanceof HttpError) {
    const message = error.data?.error || error.data?.message
    return typeof message === "string" && message ? message : fallback
  }
  return errorMessage(error, fallback)
}

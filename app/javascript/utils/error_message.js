/**
 * Extract a display-worthy message from an error of unknown shape: a plain
 * string (e.g. query.search()'s rejection), a JS Error, or an app-specific
 * { error } / Angular $http-style { statusText } rejection object.
 */
export function errorMessage(error, fallback) {
  if (typeof error === "string" && error) return error
  if (error && typeof error === "object") {
    const message = error.message || error.error || error.statusText
    if (message) return message
  }
  return fallback
}

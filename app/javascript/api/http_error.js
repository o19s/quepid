/**
 * Error thrown for a non-2xx API response. Carries the response status and
 * parsed JSON body (when there was one) so callers can show the server's own
 * message. `ok` is always false; it is kept so code written against the old
 * `{ data, ok, status, statusText }` rejection shape keeps working.
 */
export class HttpError extends Error {
  /**
   * @param {{ status: number, statusText?: string, data?: unknown, message?: string }} details
   */
  constructor({ status, statusText = "", data = null, message }) {
    super(message || messageFromBody(data) || `Request failed (${status})`)
    this.name = "HttpError"
    this.status = status
    this.statusText = statusText
    this.data = data
    this.ok = false
  }
}

function messageFromBody(data) {
  if (!data || typeof data !== "object") return ""
  const message = data.error || data.message
  return typeof message === "string" ? message : ""
}

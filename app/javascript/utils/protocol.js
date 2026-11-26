/**
 * The same address on another protocol, for opening Quepid on the protocol a search endpoint
 * needs (a browser blocks calls to an http endpoint from an https page). https is served on its
 * default port; http keeps the original port.
 *
 * @param {string} href absolute, or relative to `base`
 * @param {string} protocol "http" or "https"
 * @param {string} [base] resolves a relative `href`; defaults to the current page
 * @returns {URL | null} null for any protocol other than http or https
 */
export function switchProtocol(href, protocol, base = globalThis.location?.href) {
  const target = `${protocol}:`
  if (!["http:", "https:"].includes(target)) return null

  const url = new URL(href, base)
  if (url.protocol === target) return url

  url.protocol = target
  if (target === "https:") url.port = ""
  return url
}

/**
 * Central HTML escaping for the few places that still build markup from
 * template strings. Prefer DOM construction (textContent / dataset) for any
 * user-controlled value; use these only when a template string is unavoidable.
 */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ESCAPES[char])
}

// Safe for interpolation inside a quoted attribute value.
export const escapeAttribute = escapeHtml

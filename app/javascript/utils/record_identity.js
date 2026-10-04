/**
 * Whether two record ids (case, query, doc, team, snapshot, ...) name the same
 * record. Ids arrive as numbers or strings (API JSON, event details, data
 * attributes, form params), so they are compared as strings. A missing id
 * (null, undefined or "") never matches, not even another missing id.
 *
 * @param {number|string|null|undefined} a
 * @param {number|string|null|undefined} b
 * @returns {boolean}
 */
export function isSameId(a, b) {
  if (a == null || b == null || a === "" || b === "") return false
  return String(a) === String(b)
}

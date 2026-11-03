const PLACEHOLDER = /__([A-Z][A-Z0-9_]*?)__/g

// Controllers show the thrown message to users, so the detail goes to the console.
function templateError(detail) {
  console.error(`url-template: ${detail}`)
  return new Error("Invalid request URL")
}

/**
 * Fills a server-rendered URL template, e.g. `api_case_path(case_id: "__CASE_ID__")`,
 * with `{ CASE_ID: 7 }`. Each value is URI-component encoded, so a value from user
 * input (such as a CSV's case id) stays inside its path segment. Throws when the
 * template and the values disagree — a placeholder with no value, a value with no
 * placeholder, or a missing value (null, undefined or "") — so a renamed
 * placeholder fails here instead of as a request to `/api/cases/__CASE_ID__`.
 * The thrown message is user-facing; the detail is logged.
 *
 * @param {string} template
 * @param {Record<string, number|string|boolean>} values keyed by placeholder name, without underscores
 * @returns {string}
 */
export function fillUrlTemplate(template, values) {
  const used = new Set()
  const url = template.replace(PLACEHOLDER, (_match, name) => {
    if (!Object.hasOwn(values, name)) {
      throw templateError(`${template} has no value for __${name}__`)
    }
    const value = values[name]
    if (value == null || value === "") {
      throw templateError(`${template} got a missing value for __${name}__`)
    }
    used.add(name)
    return encodeURIComponent(String(value))
  })
  const unused = Object.keys(values).filter((name) => !used.has(name))
  if (unused.length) {
    throw templateError(`${template} has no placeholder for ${unused.join(", ")}`)
  }
  return url
}

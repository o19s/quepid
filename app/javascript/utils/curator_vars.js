/**
 * Extract curator variable names from a query parameter string.
 *
 * The magic query and keyword placeholders are search syntax, not curator
 * variables, so they are removed before the remaining ##name## tokens are
 * collected.
 */
export function extractCuratorVars(queryParams) {
  const strippedQuery = queryParams.replace(/#\$query##/g, "").replace(/#\$keyword\d+##/g, "")
  const matches = strippedQuery.match(/##[^#]*?##/g) || []

  return matches.map((match) => match.match(/##([^#]*)##/)?.[1]).filter(Boolean)
}

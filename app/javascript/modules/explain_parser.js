// Explain parser — converts Solr/ES explain JSON into a normalized tree,
// extracts "hot matches" (top score contributors) for stacked chart display.

/**
 * Parse a raw explain JSON node into a normalized tree.
 * Works for both Solr structured explain and ES _explanation format.
 *
 * @param {Object} json - Raw explain JSON from the search engine
 * @returns {{ value: number, description: string, children: Array }}
 */
export function parseExplain(json) {
  if (!json || typeof json !== "object") {
    return { value: 0, description: "no explain data", children: [] }
  }

  const value = parseFloat(json.value) || 0
  const description = json.description || ""

  // Solr uses "details", ES uses "details" in _explanation format
  const rawChildren = json.details || []
  const children = rawChildren.filter((d) => d && typeof d === "object").map((d) => parseExplain(d))

  return { value, description, children }
}

/**
 * Recursively collect leaf-level "match" nodes from the explain tree.
 * A match is a node whose children are all non-scoring (value ~0) or has no children.
 * We collect the deepest meaningful contributors.
 */
function collectContributors(node) {
  // If no children or all children have ~0 value, this node is a leaf contributor
  const scoringChildren = node.children.filter((c) => Math.abs(c.value) > 0.0001)

  if (scoringChildren.length === 0) {
    return [{ description: node.description, value: node.value }]
  }

  // For "sum of" / "max of" nodes, recurse into children
  const desc = node.description.toLowerCase()
  if (
    desc.includes("sum of") ||
    desc.includes("max of") ||
    desc.includes("result of") ||
    desc.includes("computed as") ||
    desc.includes("score mode")
  ) {
    const results = []
    for (const child of scoringChildren) {
      results.push(...collectContributors(child))
    }
    return results
  }

  // For "product of" nodes, the first child is typically the meaningful one
  if (desc.includes("product of")) {
    if (scoringChildren.length > 0) {
      return collectContributors(scoringChildren[0])
    }
  }

  // For weight/match nodes, this is the contributor
  if (
    desc.startsWith("weight(") ||
    desc.startsWith("match(") ||
    desc.startsWith("score(") ||
    desc.startsWith("functionquery") ||
    desc.startsWith("constantscore") ||
    desc.startsWith("function for field")
  ) {
    return [{ description: node.description, value: node.value }]
  }

  // Default: recurse into all scoring children
  const results = []
  for (const child of scoringChildren) {
    results.push(...collectContributors(child))
  }
  return results.length > 0 ? results : [{ description: node.description, value: node.value }]
}

/**
 * Extract "hot matches" — the top score contributors as percentages.
 *
 * @param {Object} tree - Parsed explain tree from parseExplain()
 * @param {number} maxScore - Maximum score across all docs (for percentage calculation)
 * @returns {Array<{ description: string, percentage: number, value: number }>}
 */
export function hotMatchesOutOf(tree, maxScore) {
  if (!tree || maxScore <= 0) return []

  const contributors = collectContributors(tree)

  // Merge contributors with the same description
  const merged = new Map()
  for (const c of contributors) {
    const key = c.description
    if (merged.has(key)) {
      merged.get(key).value += c.value
    } else {
      merged.set(key, { description: key, value: c.value })
    }
  }

  return Array.from(merged.values())
    .map((c) => ({
      description: c.description,
      value: c.value,
      percentage: (c.value / maxScore) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage)
}

/**
 * Convert a parsed explain tree to a human-readable indented string.
 *
 * @param {Object} tree - Parsed explain tree
 * @param {number} [depth=0] - Current indentation depth
 * @returns {string}
 */
export function explainToString(tree, depth = 0) {
  if (!tree) return ""
  const indent = "  ".repeat(depth)
  let result = `${indent}${tree.value} ${tree.description}\n`
  for (const child of tree.children) {
    result += explainToString(child, depth + 1)
  }
  return result
}

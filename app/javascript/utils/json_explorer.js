/**
 * Vanilla port of the vendored `ng-json-explorer` Angular directive
 * (app/javascript/vendor/ng-json-explorer) — same markup, classnames (styled by
 * angular-json-explorer.css, loaded via core.html.erb) and collapse/expand
 * interaction, without the Angular scope/watch machinery. Only caller today is
 * the debug-matches modal; query_explain's modal still uses the Angular
 * directive directly.
 */

export function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function isRaw(value) {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  )
}

function parseRaw(key, value) {
  const prefix = key ? `<span class="prop">${escapeHtml(key)}</span>: ` : ""
  if (typeof value === "string")
    return `${prefix}<span class="string">"${escapeHtml(value)}"</span>`
  if (typeof value === "number") return `${prefix}<span class="num">${value}</span>`
  if (typeof value === "boolean") return `${prefix}<span class="bool">${value}</span>`
  return `${prefix}<span class="null">${value}</span>`
}

function parseChildren(key, value, collapser, ellipsis, contents, open, close) {
  let html = key
    ? `<span class="prop"><a href="#" class="collapser">${collapser}</a>${escapeHtml(key)}</span>: ${open}`
    : `<span class="prop"><a href="#" class="collapser">${collapser}</a></span> ${open}`
  html += `<span class="ellipsis ${ellipsis}">...</span>`
  html += `<ul class="${open === "[" ? "array" : "object"} collapsible ${contents}">`

  const entries = open === "[" ? value.map((v) => [null, v]) : Object.entries(value)
  const items = entries.map(
    ([k, v]) => `<li>${parseValue(k, v, collapser, ellipsis, contents)},</li>`
  )
  html += items.join("").replace(/,<\/li>$/, "</li>")
  html += `</ul>${close}`
  return html
}

function parseValue(key, value, collapser, ellipsis, contents) {
  if (isRaw(value)) return parseRaw(key, value)
  if (Array.isArray(value))
    return parseChildren(key, value, collapser, ellipsis, contents, "[", "]")
  if (typeof value === "object")
    return parseChildren(key, value, collapser, ellipsis, contents, "{", "}")
  return ""
}

function wireCollapsers(root) {
  root.querySelectorAll("a.collapser").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault()
      const ellipsisEl = link.parentElement.nextElementSibling
      const listEl = ellipsisEl.nextElementSibling
      if (link.innerHTML === "+") {
        ellipsisEl.classList.add("hidden")
        listEl.classList.remove("hidden")
        link.innerHTML = "-"
      } else {
        ellipsisEl.classList.remove("hidden")
        listEl.classList.add("hidden")
        link.innerHTML = "+"
      }
    })
  })
}

/**
 * @param {Element} container element whose content is replaced with the tree
 * @param {string} jsonString a JSON-encoded string (e.g. Explain#rawStr())
 * @param {{ collapsed?: boolean }} [options]
 */
export function renderJsonExplorer(container, jsonString, { collapsed = false } = {}) {
  let data
  try {
    data = JSON.parse(jsonString)
  } catch (e) {
    data = { error: "invalid json" }
  }

  const collapser = collapsed ? "+" : "-"
  const ellipsis = collapsed ? "" : "hidden"
  const contents = collapsed ? "hidden" : ""

  const isArray = Array.isArray(data)
  const entries = isArray ? data.map((v) => [null, v]) : Object.entries(data)
  const items = entries.map(
    ([k, v]) => `<li>${parseValue(k, v, collapser, ellipsis, contents)},</li>`
  )
  const inner = items.join("").replace(/,<\/li>$/, "</li>")

  const html = isArray ? `[<ul class="array">${inner}</ul>]` : `{<ul class="object">${inner}</ul>}`

  container.innerHTML = `<div class="angular-json-explorer">${html}</div>`
  wireCollapsers(container)
}

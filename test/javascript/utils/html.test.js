import { describe, expect, it } from "vitest"
import { escapeAttribute, escapeHtml } from "utils/html"

describe("html escaping", () => {
  it("escapes &, <, >, and both quote types", () => {
    expect(escapeHtml(`<a href="x" title='y'>&`)).toBe("&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;")
  })

  it("treats null and undefined as empty", () => {
    expect(escapeHtml(null)).toBe("")
    expect(escapeHtml(undefined)).toBe("")
  })

  it("makes attribute-breakout payloads inert", () => {
    const div = document.createElement("div")
    div.innerHTML = `<span data-x="${escapeAttribute('"><img src=x onerror=alert(1)>')}"></span>`
    expect(div.querySelector("img")).toBeNull()
    expect(div.firstElementChild.dataset.x).toBe('"><img src=x onerror=alert(1)>')
  })
})

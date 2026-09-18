import { describe, expect, it } from "vitest"
import { escapeHtml, renderJsonExplorer } from "utils/json_explorer"

describe("json_explorer", () => {
  describe("escapeHtml", () => {
    it("escapes &, < and >", () => {
      expect(escapeHtml("<a> & <b>")).toBe("&lt;a&gt; &amp; &lt;b&gt;")
    })
  })

  describe("renderJsonExplorer", () => {
    it("renders a raw object's keys, string, number and boolean leaves", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, JSON.stringify({ description: "weight(x)", value: 3.5, matched: true }))

      const root = container.querySelector(".angular-json-explorer")
      expect(root).not.toBeNull()
      expect(root.querySelector(".string").textContent).toBe('"weight(x)"')
      expect(root.querySelector(".num").textContent).toBe("3.5")
      expect(root.querySelector(".bool").textContent).toBe("true")
    })

    it("escapes HTML-significant characters in string leaves", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, JSON.stringify({ description: "<script>" }))

      expect(container.querySelector(".string").innerHTML).toBe('"&lt;script&gt;"')
    })

    it("nests arrays and objects under a collapsible list with a collapser link", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, JSON.stringify({ details: [{ description: "a" }] }))

      const collapsers = container.querySelectorAll("a.collapser")
      expect(collapsers.length).toBeGreaterThan(0)
      expect(container.querySelector("ul.array")).not.toBeNull()
    })

    it("starts expanded (collapser shows '-') by default, matching collapsed: false", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, JSON.stringify({ details: [{ description: "a" }] }))

      expect(container.querySelector("a.collapser").textContent).toBe("-")
      expect(container.querySelector(".ellipsis").classList.contains("hidden")).toBe(true)
      expect(container.querySelector("ul.collapsible").classList.contains("hidden")).toBe(false)
    })

    it("toggles a branch's collapsed state when its collapser is clicked", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, JSON.stringify({ details: [{ description: "a" }] }))

      const collapser = container.querySelector("a.collapser")
      collapser.click()

      expect(collapser.textContent).toBe("+")
      expect(container.querySelector(".ellipsis").classList.contains("hidden")).toBe(false)
      expect(container.querySelector("ul.collapsible").classList.contains("hidden")).toBe(true)

      collapser.click()
      expect(collapser.textContent).toBe("-")
    })

    it("falls back to an error placeholder for invalid JSON", () => {
      const container = document.createElement("div")
      renderJsonExplorer(container, "not json")

      expect(container.querySelector(".string").textContent).toBe('"invalid json"')
    })
  })
})

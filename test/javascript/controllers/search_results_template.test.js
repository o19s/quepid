import { describe, expect, it } from "vitest"
import { searchResultsTemplate } from "controllers/search_results_template"

describe("searchResultsTemplate accessibility", () => {
  it("names the icon-only query controls", () => {
    const root = document.createElement("div")
    root.innerHTML = searchResultsTemplate({
      caseId: 6,
      queryId: 8,
      queryExplainData: "{}"
    })

    const copy = root.querySelector('[data-action="click->search-results#copyQuery"]')
    expect(copy.getAttribute("aria-label")).toBe("Copy query")
    expect(copy.getAttribute("title")).toBe("Copy query")
    expect(root.querySelector(".results-pane-toggle").getAttribute("aria-label")).toBe(
      "Close the results pane"
    )
    expect(root.querySelector(".results-pane-toggle").tagName).toBe("BUTTON")
  })
})

describe("searchResultsTemplate escaping", () => {
  it("keeps hostile explain/options JSON inside its attribute", () => {
    const payload = '{"x":"\\"><img src=x onerror=alert(1)>"}'
    const root = document.createElement("div")
    root.innerHTML = searchResultsTemplate({
      caseId: 1,
      queryId: 2,
      queryExplainData: payload,
      queryOptionsData: payload
    })

    expect(root.querySelector("img")).toBeNull()
    expect(root.querySelector("[data-query-explain-data-value]").dataset.queryExplainDataValue).toBe(payload)
    expect(root.querySelector("[data-query-options-core-options-value]").dataset.queryOptionsCoreOptionsValue).toBe(payload)
  })

  it("escapes hostile ids", () => {
    const root = document.createElement("div")
    root.innerHTML = searchResultsTemplate({ caseId: 1, queryId: '1"><img src=x>', queryExplainData: "{}" })
    expect(root.querySelector("img")).toBeNull()
  })
})


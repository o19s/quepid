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

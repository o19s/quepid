import { afterEach, describe, expect, it } from "vitest"
import {
  createSearchEndpointSelect,
  updateSearchEndpointSelect
} from "modules/search_endpoint_select"

let select

afterEach(() => select?.destroy())

describe("search endpoint select", () => {
  it("reads engine icons from option data attributes and renders names as text", () => {
    const element = document.createElement("select")
    select = createSearchEndpointSelect(element, "Select endpoint")
    updateSearchEndpointSelect(
      select,
      [
        { id: 1, name: "<b>Solr</b>", searchEngine: "solr" },
        { id: 2, name: "Vespa", searchEngine: "searchapi", mapperBasedSearchEngineId: "vespa" }
      ],
      2
    )
    expect(element.querySelector('option[value="2"]').dataset.src).toBe("images/vespa-icon.png")
    expect(select.control.querySelector("img").getAttribute("src")).toBe("images/vespa-icon.png")
    const option = select.getOption("1", true)
    expect(option.querySelector("b")).toBeNull()
    expect(option.textContent).toBe("<b>Solr</b>")
    expect(select.getValue()).toBe("2")
    updateSearchEndpointSelect(
      select,
      [{ id: 3, name: "Other", searchEngine: "elasticsearch" }],
      null
    )
    expect(select.options["1"]).toBeUndefined()
    expect(select.getValue()).toBe("")
    expect(select.settings.create).toBe(false)
  })
  it("advertises all loaded endpoints and explains the initial result cap", () => {
    select = createSearchEndpointSelect(document.createElement("select"), "Select endpoint")
    const endpoints = Array.from({ length: 505 }, (_, index) => ({
      id: index + 1,
      name: `${index < 180 ? "Group" : "Other"} endpoint ${index + 1}`,
      searchEngine: "solr"
    }))
    updateSearchEndpointSelect(select, endpoints, null)
    select.refreshOptions(false)
    expect(select.control_input.placeholder).toBe("Search 505 endpoints…")
    expect(select.dropdown_content.querySelectorAll(".option")).toHaveLength(50)
    expect(select.dropdown.querySelector('[role="status"]').textContent).toBe(
      "Showing 50 of 505 endpoints. Type to search all endpoints."
    )
    select.setTextboxValue("Group")
    select.refreshOptions(false)
    expect(select.dropdown.querySelector('[role="status"]').textContent).toBe(
      "Showing 50 of 180 matches. Keep typing to narrow."
    )
    select.setTextboxValue("Other endpoint 505")
    select.refreshOptions(false)
    expect(select.dropdown.querySelector('[role="status"]').textContent).toBe(
      "1 matching endpoint."
    )
    select.setTextboxValue("missing")
    select.refreshOptions(false)
    expect(select.dropdown.querySelector('[role="status"]').textContent).toBe(
      "0 matching endpoints."
    )
    select.setTextboxValue("")
    select.refreshOptions(false)
    expect(select.dropdown.querySelector('[role="status"]').textContent).toContain("50 of 505")
  })

  it("updates counts when the endpoint list changes without changing the selection contract", () => {
    select = createSearchEndpointSelect(document.createElement("select"), "Select endpoint")
    updateSearchEndpointSelect(select, [{ id: 1, name: "Only", searchEngine: "solr" }], 1)
    expect(select.settings.placeholder).toBe("Search 1 endpoint…")
    expect(select.getValue()).toBe("1")
    updateSearchEndpointSelect(select, [], null)
    expect(select.settings.placeholder).toBe("Search endpoints…")
    expect(select.dropdown.querySelector('[role="status"]').textContent).toBe(
      "No endpoints available."
    )
    expect(select.dropdown.querySelectorAll('[role="status"]')).toHaveLength(1)
  })
})

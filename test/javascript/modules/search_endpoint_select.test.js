import { afterEach, describe, expect, it } from "vitest"
import { createSearchEndpointSelect, updateSearchEndpointSelect } from "modules/search_endpoint_select"

let select

afterEach(() => select?.destroy())

describe("search endpoint select", () => {
  it("reads engine icons from option data attributes and renders names as text", () => {
    const element = document.createElement("select")
    select = createSearchEndpointSelect(element, "Select endpoint")
    updateSearchEndpointSelect(select, [
      { id: 1, name: "<b>Solr</b>", searchEngine: "solr" },
      { id: 2, name: "Vespa", searchEngine: "searchapi", mapperBasedSearchEngineId: "vespa" }
    ], 2)
    expect(element.querySelector('option[value="2"]').dataset.src).toBe("images/vespa-icon.png")
    expect(select.control.querySelector("img").getAttribute("src")).toBe("images/vespa-icon.png")
    const option = select.getOption("1", true)
    expect(option.querySelector("b")).toBeNull()
    expect(option.textContent).toBe("<b>Solr</b>")
    expect(select.getValue()).toBe("2")
    updateSearchEndpointSelect(select, [{ id: 3, name: "Other", searchEngine: "elasticsearch" }], null)
    expect(select.options["1"]).toBeUndefined()
    expect(select.getValue()).toBe("")
    expect(select.settings.create).toBe(false)
  })
})

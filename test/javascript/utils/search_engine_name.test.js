import { describe, expect, it } from "vitest"
import { searchEngineDisplayName, supportLookupById } from "utils/search_engine_name"

describe("search_engine_name", () => {
  it("maps known engine ids to display names", () => {
    expect(searchEngineDisplayName("solr")).toBe("Solr")
    expect(searchEngineDisplayName("es")).toBe("Elasticsearch")
    expect(searchEngineDisplayName("unknown")).toBe("unknown")
  })

  it("reports engines that cannot look up docs by id", () => {
    expect(supportLookupById("solr")).toBe(true)
    expect(supportLookupById("vectara")).toBe(false)
    expect(supportLookupById("searchapi")).toBe(false)
  })
})

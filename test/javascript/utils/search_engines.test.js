import { describe, expect, it } from "vitest"
import { isEsLikeEngine, normalizeSearchEngine, searchEngineLabel, supportsLookupById } from "utils/search_engines"

describe("search_engines", () => {
  it("treats Elasticsearch and OpenSearch as ES-like", () => {
    expect(isEsLikeEngine("es")).toBe(true)
    expect(isEsLikeEngine("os")).toBe(true)
    expect(isEsLikeEngine("solr")).toBe(false)
    expect(isEsLikeEngine(undefined)).toBe(false)
  })

  it("reports engines that cannot look up docs by id", () => {
    expect(supportsLookupById("solr")).toBe(true)
    expect(supportsLookupById("vectara")).toBe(false)
    expect(supportsLookupById("searchapi")).toBe(false)
    expect(supportsLookupById(undefined)).toBe(true)
  })

  it("treats a static case as Solr and passes every other engine through", () => {
    expect(normalizeSearchEngine("static")).toBe("solr")
    expect(normalizeSearchEngine("es")).toBe("es")
    expect(normalizeSearchEngine("searchapi")).toBe("searchapi")
    expect(normalizeSearchEngine(undefined)).toBe(undefined)
  })

  it("labels engine ids from the server-provided catalog, falling back to the id", () => {
    const labels = { solr: "Solr", es: "Elasticsearch" }
    expect(searchEngineLabel(labels, "es")).toBe("Elasticsearch")
    expect(searchEngineLabel(labels, "Vespa")).toBe("Vespa")
    expect(searchEngineLabel(undefined, "solr")).toBe("solr")
    expect(searchEngineLabel(labels, "")).toBe("")
  })
})

import { describe, expect, it } from "vitest"
import {
  isEsLikeEngine,
  normalizeSearchEngine,
  searchEngineLabel,
  searcherEngine,
  supportsLookupById,
  withSearcherEngine
} from "utils/search_engines"

describe("search_engines", () => {
  it("treats Elasticsearch and OpenSearch as ES-like", () => {
    expect(isEsLikeEngine("es")).toBe(true)
    expect(isEsLikeEngine("os")).toBe(true)
    expect(isEsLikeEngine("warpsearch")).toBe(true)
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

  it("keeps WarpSearch as its own engine id outside the searcher boundary", () => {
    expect(normalizeSearchEngine("warpsearch")).toBe("warpsearch")
    expect(supportsLookupById("warpsearch")).toBe(true)
  })

  it("builds searchers for WarpSearch and static cases with the engine whose API they speak", () => {
    expect(searcherEngine("warpsearch")).toBe("os")
    expect(searcherEngine("static")).toBe("solr")
    expect(searcherEngine("es")).toBe("es")
    expect(searcherEngine("searchapi")).toBe("searchapi")
    expect(searcherEngine(undefined)).toBe(undefined)
  })

  it("copies settings with the searcher engine and leaves the original alone", () => {
    const settings = { searchEngine: "warpsearch", searchUrl: "https://api.warpsearch.io" }
    expect(withSearcherEngine(settings)).toEqual({
      searchEngine: "os",
      searchUrl: "https://api.warpsearch.io"
    })
    expect(settings.searchEngine).toBe("warpsearch")

    const solr = { searchEngine: "solr" }
    expect(withSearcherEngine(solr)).toBe(solr)
    expect(withSearcherEngine(null)).toBe(null)
  })

  it("labels engine ids from the server-provided catalog, falling back to the id", () => {
    const labels = { solr: "Solr", es: "Elasticsearch" }
    expect(searchEngineLabel(labels, "es")).toBe("Elasticsearch")
    expect(searchEngineLabel(labels, "Vespa")).toBe("Vespa")
    expect(searchEngineLabel(undefined, "solr")).toBe("solr")
    expect(searchEngineLabel(labels, "")).toBe("")
  })
})

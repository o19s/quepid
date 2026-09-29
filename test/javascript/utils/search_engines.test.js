import { describe, expect, it } from "vitest"
import { isEsLikeEngine, supportsLookupById } from "utils/search_engines"

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
})

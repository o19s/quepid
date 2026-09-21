import { describe, expect, it } from "vitest"
import {
  buildRatedDocsFilter,
  normalizeSearchEngine,
  ratedDocIds,
  supportsRatedDocsLookup,
  supportsSearchApiRatedDocsLookup
} from "utils/rated_docs"

/**
 * Unit contract for logic that Angular only covered indirectly, through the
 * `createSearcherFromSettings` examples in
 * spec/javascripts/angular/services/queriesSvc_spec.js ("Solr ratings filter
 * (options.filterToRated)"). The static-engine cases below had no coverage at all.
 */
describe("rated_docs", () => {
  describe("normalizeSearchEngine", () => {
    it("treats a static case as Solr", () => {
      expect(normalizeSearchEngine("static")).toBe("solr")
    })

    it("passes every other engine through untouched", () => {
      expect(normalizeSearchEngine("es")).toBe("es")
      expect(normalizeSearchEngine("searchapi")).toBe("searchapi")
      expect(normalizeSearchEngine(undefined)).toBe(undefined)
    })
  })

  describe("supportsSearchApiRatedDocsLookup", () => {
    it("is true only for a searchapi try whose mapper opted in", () => {
      expect(
        supportsSearchApiRatedDocsLookup({
          searchEngine: "searchapi",
          mapperBasedSearchEngineSupportsRatedDocsLookup: true
        })
      ).toBe(true)
    })

    it("is false for a searchapi try with no rated-docs mapper", () => {
      expect(supportsSearchApiRatedDocsLookup({ searchEngine: "searchapi" })).toBe(false)
    })

    it("is false for engines that are not searchapi, and for no try", () => {
      expect(
        supportsSearchApiRatedDocsLookup({
          searchEngine: "solr",
          mapperBasedSearchEngineSupportsRatedDocsLookup: true
        })
      ).toBe(false)
      expect(supportsSearchApiRatedDocsLookup(null)).toBe(false)
    })
  })

  describe("supportsRatedDocsLookup", () => {
    it("is true for engines with a native id-filter syntax", () => {
      expect(supportsRatedDocsLookup({ searchEngine: "es" })).toBe(true)
      expect(supportsRatedDocsLookup({ searchEngine: "os" })).toBe(true)
      expect(supportsRatedDocsLookup({ searchEngine: "solr" })).toBe(true)
    })

    it("defers to the mapper for searchapi", () => {
      expect(
        supportsRatedDocsLookup({
          searchEngine: "searchapi",
          mapperBasedSearchEngineSupportsRatedDocsLookup: true
        })
      ).toBe(true)
      expect(supportsRatedDocsLookup({ searchEngine: "searchapi" })).toBe(false)
    })

    // A try's searchEngine is never rewritten to solr (only the settings-level copy
    // is), so a static case must keep reporting false here or "Show only rated"
    // turns on for a case that cannot serve it.
    it("stays false for a static try despite static being Solr-backed", () => {
      expect(supportsRatedDocsLookup({ searchEngine: "static" })).toBe(false)
    })

    it("is false for engines with no id-filter syntax, and for no try", () => {
      expect(supportsRatedDocsLookup({ searchEngine: "vectara" })).toBe(false)
      expect(supportsRatedDocsLookup({ searchEngine: "algolia" })).toBe(false)
      expect(supportsRatedDocsLookup(null)).toBe(false)
    })
  })

  describe("buildRatedDocsFilter", () => {
    it("builds a terms query for es and os", () => {
      expect(
        buildRatedDocsFilter({ searchEngine: "es", idField: "id", ratedIds: ["a", "b"] })
      ).toEqual({ terms: { id: ["a", "b"] } })
      expect(
        buildRatedDocsFilter({ searchEngine: "os", idField: "uuid", ratedIds: ["a"] })
      ).toEqual({ terms: { uuid: ["a"] } })
    })

    it("builds a Solr terms parser filter", () => {
      expect(
        buildRatedDocsFilter({ searchEngine: "solr", idField: "id", ratedIds: ["a", "b"] })
      ).toBe("{!terms f=id}a,b")
    })

    // Angular got this only because createSearcherFromSettings had already rewritten
    // settings.searchEngine in place; without normalization a static case appends
    // undefined to fq on every search.
    it("filters a static case exactly like Solr", () => {
      expect(
        buildRatedDocsFilter({ searchEngine: "static", idField: "id", ratedIds: ["a", "b"] })
      ).toBe("{!terms f=id}a,b")
    })

    it("builds an OR'd id predicate for vectara", () => {
      expect(
        buildRatedDocsFilter({ searchEngine: "vectara", idField: "id", ratedIds: ["a", "b"] })
      ).toBe("doc.id = 'a' OR doc.id = 'b'")
    })

    it("has no filter for engines whose syntax is mapper-supplied or absent", () => {
      expect(
        buildRatedDocsFilter({ searchEngine: "searchapi", idField: "id", ratedIds: ["a"] })
      ).toBe(undefined)
      expect(
        buildRatedDocsFilter({ searchEngine: "algolia", idField: "id", ratedIds: ["a"] })
      ).toBe(undefined)
    })

    it("tolerates a query with nothing rated yet", () => {
      expect(buildRatedDocsFilter({ searchEngine: "solr", idField: "id", ratedIds: [] })).toBe(
        "{!terms f=id}"
      )
      expect(
        buildRatedDocsFilter({ searchEngine: "es", idField: "id", ratedIds: undefined })
      ).toEqual({ terms: { id: [] } })
    })
  })

  describe("ratedDocIds", () => {
    it("returns every rated id when no window is asked for", () => {
      expect(ratedDocIds({ a: 1, b: 0 })).toEqual(["a", "b"])
    })

    it("returns an empty list when the query has no ratings", () => {
      expect(ratedDocIds(null)).toEqual([])
      expect(ratedDocIds(undefined)).toEqual([])
    })

    // Explain-other cannot page through results, so callers ask for a window of ids.
    it("windows the ids by offset and page size", () => {
      const ratings = { a: 1, b: 1, c: 1, d: 1, e: 1 }
      expect(ratedDocIds(ratings, 0, 2)).toEqual(["a", "b"])
      expect(ratedDocIds(ratings, 2, 2)).toEqual(["c", "d"])
      expect(ratedDocIds(ratings, 4, 2)).toEqual(["e"])
    })
  })
})

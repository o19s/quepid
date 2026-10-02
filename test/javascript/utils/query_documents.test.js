import { describe, expect, it, vi } from "vitest"
import { buildQueryDocumentsState } from "utils/query_documents"

describe("query document read model", () => {
  it("copies query results and derives display metadata without a framework", () => {
    const query = {
      queryText: "title",
      docs: [{ id: "1" }],
      ratedDocs: [{ id: "1", rating: 2 }],
      numFound: 4,
      ratedDocsFound: 1,
      depthOfRating: 10,
      rating: 2,
      currentScore: { countMissingRatings: 3, allRated: false },
      fieldSpec: () => ({ fields: ["title"], id: "id", title: "title" }),
      maxDocScore: () => 9,
      browseUrl: () => "https://search.example/browse",
      state: () => "loaded",
      version: () => 12
    }

    const state = buildQueryDocumentsState({
      query,
      settings: {
        searchEngine: "solr",
        apiMethod: "GET",
        customHeaders: '{"X-Test":"yes"}',
        basicAuthCredential: "user:password"
      },
      selectedTry: { searchEngine: "solr" },
      documentUrlFor: vi.fn(() => "https://search.example/doc/1"),
      diffs: { searchers: [] }
    })

    expect(state).toMatchObject({
      queryText: "title",
      numFound: 4,
      ratedDocsFound: 1,
      paginationSupported: true,
      missingRatings: 3,
      allRated: false,
      maxDocScore: 9,
      queryState: "loaded",
      version: 12,
      diffs: { searchers: [] }
    })
    expect(state.fieldSpec).toEqual({ fields: ["title"], id: "id", title: "title" })
    expect(state.browseHeaders).toMatchObject({
      "X-Test": "yes",
      Authorization: expect.stringMatching(/^Basic /)
    })
    expect(state.documentUrlFor({})).toBe("https://search.example/doc/1")
  })

  it("switches to the diff view only when snapshot searchers are present", () => {
    const query = { fieldSpec: () => ({}) }

    expect(buildQueryDocumentsState({ query }).resultsView).toBe(2)
    expect(buildQueryDocumentsState({ query, diffs: { searchers: [] } }).resultsView).toBe(2)
    expect(buildQueryDocumentsState({ query, diffs: { searchers: [{ name: "Baseline" }] } }).resultsView).toBe(3)
  })

  it("disables pagination for Search API mapper engines", () => {
    const state = buildQueryDocumentsState({
      query: { fieldSpec: () => ({}) },
      selectedTry: { searchEngine: "searchapi", mapperBasedSearchEngineSupportsPagination: false }
    })

    expect(state.paginationSupported).toBe(false)
  })
})

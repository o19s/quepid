import { describe, expect, it, vi } from "vitest"
import { buildQueryDocumentsState, bulkActionQueries, plainDocument } from "utils/query_documents"
import { QueryDocumentsStore } from "stores/query_documents_store"
import { buildDetailedCaseCsv } from "utils/case_csv"
import { buildFrogReportStats } from "controllers/frog_report_controller"

// A rateable splainer doc. Reading explain/score/snippets builds its explain tree, so those are spies.
function liveDoc(id, { rating = null, thumb = false } = {}) {
  return {
    id,
    title: `Title ${id}`,
    subs: { text: `text of ${id}` },
    thumb: thumb ? `${id}.png` : undefined,
    thumb_options: thumb ? { prefix: "http://img/" } : undefined,
    doc: { origin: () => ({ id, title: `Raw ${id}`, text: `text of ${id}`, year: 1999 }) },
    hasThumb: () => thumb,
    hasImage: () => false,
    hasRating: () => rating !== null,
    getRating: () => rating,
    explain: vi.fn(() => ({ children: [], asJson: {}, rawStr: () => "{}" })),
    hotMatchesOutOf: vi.fn(() => []),
    score: vi.fn(() => 1),
    subSnippets: vi.fn(() => ({}))
  }
}

function liveQuery(queryId, docs, { missing = null, allRated = false } = {}) {
  return {
    queryId,
    queryText: `query ${queryId}`,
    docs,
    ratedDocs: [],
    depthOfRating: 10,
    currentScore: { score: 0.5, countMissingRatings: missing, allRated },
    fieldSpec: () => ({ fields: ["id", "title", "text", "year"], id: "id", title: "title" })
  }
}

describe("bulk action queries", () => {
  const live = {
    3: liveQuery(3, [liveDoc("a", { rating: 2, thumb: true }), liveDoc("b")], { missing: 1 }),
    10: liveQuery(10, [], { missing: 0, allRated: true }),
    7: liveQuery(7, [liveDoc("c", { rating: 0 })], { missing: 0, allRated: true })
  }
  const allDocs = Object.values(live).flatMap(query => query.docs)

  // What the bulk actions read before: every query's docs published into the documents store.
  function storeQueries() {
    const store = new QueryDocumentsStore()
    Object.values(live).forEach(query => {
      store.collection.upsert(query)
      store.replaceQuery(query.queryId, buildQueryDocumentsState({ query }))
    })
    return Object.values(store.snapshot().queries)
  }

  it("gives the detailed CSV and the frog report what the documents store did", () => {
    const before = storeQueries()
    allDocs.forEach(doc => [doc.explain, doc.hotMatchesOutOf, doc.score, doc.subSnippets].forEach(spy => spy.mockClear()))
    const after = bulkActionQueries(live)
    const caseData = { case_name: "Case", case_id: 1, last_score: { case_id: 1 }, teams: [{ name: "Team" }] }

    expect(buildDetailedCaseCsv(caseData, after)).toBe(buildDetailedCaseCsv(caseData, before))
    expect(buildFrogReportStats(bulkActionQueries(live, { withDocs: false }))).toEqual(buildFrogReportStats(before))
    expect(after.map(query => query.queryId)).toEqual(before.map(query => query.queryId))
    allDocs.forEach(doc => {
      expect(doc.explain).not.toHaveBeenCalled()
      expect(doc.score).not.toHaveBeenCalled()
      expect(doc.subSnippets).not.toHaveBeenCalled()
    })
  })

  it("passes the live doc list through when only counts are needed", () => {
    expect(bulkActionQueries(live, { withDocs: false })[0].docs).toBe(live[3].docs)
    expect(bulkActionQueries({ 1: { queryId: 1 } }, { withDocs: false })[0].docs).toEqual([])
    expect(bulkActionQueries(undefined)).toEqual([])
    const fields = ["title"]
    expect(bulkActionQueries({ 1: { queryId: 1, fieldSpec: () => ({ fields }) } })[0].fieldSpec.fields).not.toBe(fields)
    expect(bulkActionQueries({ 1: { queryId: 1 } })[0]).toMatchObject({
      fieldSpec: { fields: [] }, docs: [], allRated: false, missingRatings: null
    })
  })

  it("copies a doc's plain fields without its explain, score or snippets", () => {
    const doc = liveDoc("a", { rating: 3, thumb: true })
    expect(plainDocument(doc)).toEqual({
      id: "a", title: "Title a", subs: { text: "text of a" }, thumb: "a.png", thumb_options: { prefix: "http://img/" },
      image: undefined, image_options: undefined, hasThumb: true, hasImage: false, embeds: {}, translations: {},
      unabridgeds: {}, rawFields: { id: "a", title: "Raw a", text: "text of a", year: 1999 }, error: undefined, rating: 3
    })
    expect(plainDocument({ id: "x" })).toMatchObject({ title: "", rawFields: {}, rating: null, hasThumb: false })
    expect(plainDocument({ id: "y", doc: {}, hasRating: () => true })).toMatchObject({ rawFields: {}, rating: undefined })

    const extras = { embeds: { video: "v" }, translations: { fr: "t" }, unabridgeds: { body: "u" } }
    const copied = plainDocument({ id: "z", ...extras })
    expect(copied).toMatchObject(extras)
    Object.keys(extras).forEach(key => expect(copied[key]).not.toBe(extras[key]))
    expect(doc.explain).not.toHaveBeenCalled()
    expect(doc.score).not.toHaveBeenCalled()
  })
})

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
      paginationSupported: true,
      maxDocScore: 9,
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

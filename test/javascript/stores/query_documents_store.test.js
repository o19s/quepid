import { beforeEach, describe, expect, it, vi } from "vitest"
import { QueryDocumentsStore } from "stores/query_documents_store"

describe("QueryDocumentsStore", () => {
  let store

  beforeEach(() => {
    store = new QueryDocumentsStore()
  })

  it("publishes plain snapshots for current and rated documents", () => {
    const doc = {
      id: "doc-1",
      title: "A document",
      thumb_options: { prefix: "https://images.example/" },
      image_options: { prefix: "https://images.example/" },
      subs: { description: "text" },
      subSnippets: () => ({ description: "<strong>text</strong>" }),
      hasRating: () => true,
      getRating: () => 2,
      score: () => 0.75,
      doc: { origin: () => ({ description: "text" }) }
    }

    store.replaceQuery(12, {
      docs: [doc],
      ratedDocs: [],
      numFound: 1,
      errorText: ""
    })

    const snapshot = store.query(12)
    expect(snapshot.queryId).toBe(12)
    expect(snapshot.docs[0]).toMatchObject({
      id: "doc-1",
      title: "A document",
      thumb_options: { prefix: "https://images.example/" },
      image_options: { prefix: "https://images.example/" },
      rating: 2,
      score: 0.75,
      snippets: { description: "<strong>text</strong>" }
    })
    expect(snapshot.docs[0].thumb_options).toEqual({ prefix: "https://images.example/" })
    expect(snapshot.docs[0].image_options).toEqual({ prefix: "https://images.example/" })
    expect(snapshot.docs[0].thumbOptions).toBeUndefined()
    expect(snapshot.docs[0].imageOptions).toBeUndefined()
    expect(snapshot.docs[0].hasRating).toBeUndefined()
  })

  it("snapshots match-explain bars, falling back to JSON when the explain has no child terms", () => {
    const explainDoc = (children) => ({
      id: "d",
      title: "T",
      score: () => 4,
      hotMatchesOutOf: (max) => [{ description: "title", percentage: (4 / max) * 100 }],
      explain: () => ({ children, toStr: () => "explained", asJson: { value: 4 }, rawStr: () => "raw" })
    })

    store.replaceQuery(1, { docs: [explainDoc([{}]), explainDoc([])], maxDocScore: 8 })
    const [withChildren, withoutChildren] = store.query(1).docs

    expect(withChildren.matchExplain).toEqual({
      hasChildren: true,
      hots: [{ description: "title", percentage: 50 }],
      explainToStr: "explained",
      explainAsJson: null,
      explainRawStr: "raw",
      docTitle: "T",
      docId: "d",
      docScore: 4
    })
    expect(withoutChildren.matchExplain).toMatchObject({ hasChildren: false, explainToStr: null, explainAsJson: '{\n  "value": 4\n}' })
  })

  it("still renders a document whose explain throws", () => {
    store.replaceQuery(1, {
      docs: [{ id: "d", title: "T", hotMatchesOutOf: () => [], explain: () => { throw new Error("bad explain") } }]
    })

    expect(store.query(1).docs[0]).toMatchObject({ id: "d", title: "T", matchExplain: null })
  })

  it("snapshots comparison columns with defaults and each snapshot's own max doc score", () => {
    const explainDoc = (id) => ({
      id,
      explain: () => ({ children: [], asJson: {}, rawStr: () => "" }),
      hotMatchesOutOf: vi.fn(() => [])
    })
    const doc = explainDoc("d")
    const ratedDoc = explainDoc("r")

    store.replaceQuery(1, {
      maxDocScore: 99,
      diffs: {
        searchers: [
          { name: "Snap A", version: 2, inError: 1, searchError: "boom", score: { score: 0.5, allRated: true }, maxDocScore: 7, docs: [doc], ratedDocs: [ratedDoc] },
          {}
        ]
      }
    })
    const [first, second] = store.query(1).diffs.searchers

    expect(first).toMatchObject({ name: "Snap A", version: 2, inError: true, searchError: "boom", score: { score: 0.5, allRated: true } })
    expect(first.docs.map((d) => d.id)).toEqual(["d"])
    expect(first.ratedDocs.map((d) => d.id)).toEqual(["r"])
    expect(doc.hotMatchesOutOf).toHaveBeenCalledWith(7)
    expect(ratedDoc.hotMatchesOutOf).toHaveBeenCalledWith(7)
    expect(second).toEqual({ name: "Snapshot", version: null, inError: false, searchError: "", score: { score: "?", allRated: false }, docs: [], ratedDocs: [] })
    store.replaceQuery(2, {})
    expect(store.query(2).diffs).toBeNull()
  })

  it.each([
    ["replaceQuery", (s) => s.replaceQuery(1, {})],
    ["updateQueryState for a known query", (s) => { s.replaceQuery(1, {}); s.updateQueryState(1, { expanded: true }) }],
    ["updateQueryState for a pending query", (s) => s.updateQueryState(5, { expanded: true })],
    ["setCaseDiffs", (s) => s.setCaseDiffs([{ name: "A" }])],
    ["setShowOnlyRated", (s) => s.setShowOnlyRated(true)],
    ["collapseAll", (s) => s.collapseAll()]
  ])("notifies subscribers after %s", (_label, mutate) => {
    const changed = vi.fn()
    store.addEventListener("change", changed)

    mutate(store)

    expect(changed).toHaveBeenCalled()
    expect(changed.mock.calls.at(-1)[0].detail).toEqual(expect.objectContaining({ queries: expect.any(Object) }))
  })

  it("publishes a reset event", () => {
    const reset = vi.fn()
    store.addEventListener("reset", reset)

    store.reset()

    expect(reset).toHaveBeenCalledOnce()
  })

  it("keeps the resolved document link in the plain snapshot", () => {
    const doc = { id: "doc-1" }

    store.replaceQuery(12, {
      docs: [doc],
      documentUrlFor: candidate => `https://search.example/doc/${candidate.id}`
    })

    expect(store.query(12).docs[0].linkUrl).toBe("https://search.example/doc/doc-1")
  })

  it("replaces a query atomically and notifies subscribers", () => {
    const changes = []
    store.addEventListener("change", event => changes.push(event.detail))

    store.replaceQuery(4, { docs: [{ id: "first" }] })
    store.replaceQuery(4, { docs: [{ id: "second" }] })

    expect(changes).toHaveLength(2)
    expect(store.query(4).docs.map(doc => doc.id)).toEqual(["second"])
  })

  it("removes query state without affecting other queries", () => {
    store.replaceQuery(1, { docs: [] })
    store.replaceQuery(2, { docs: [] })

    store.removeQuery(1)

    expect(store.query(1)).toBeNull()
    expect(store.query(2)).not.toBeNull()
  })

  it("publishes live-query intents without knowing their owner", () => {
    const commands = []
    store.addEventListener("command", event => commands.push(event.detail))

    store.requestToggleQuery(12)
    store.requestPaginateQuery(12, true)
    store.requestRateDocument(12, "doc-1", 2)
    store.requestRateAll(12, null)

    expect(commands).toEqual([
      { command: "toggle-query", queryId: 12 },
      { command: "paginate-query", queryId: 12, ratedOnly: true },
      { command: "rate-document", queryId: 12, docId: "doc-1", rating: 2 },
      { command: "rate-all", queryId: 12, rating: null }
    ])
  })

  it("preserves display state when a search refreshes documents", () => {
    store.replaceQuery(8, { docs: [{ id: "first" }] })
    store.updateQueryState(8, { expanded: true, resultsView: 2 })

    store.replaceQuery(8, { docs: [{ id: "second" }] })

    expect(store.query(8)).toMatchObject({ expanded: true, resultsView: 2 })
  })

  it("preserves an early display-state update until documents arrive", () => {
    store.updateQueryState(8, { expanded: true })
    store.replaceQuery(8, { docs: [{ id: "first" }] })

    expect(store.query(8).expanded).toBe(true)
  })

  it("updates rated-only state for every query", () => {
    store.replaceQuery(1, { docs: [] })
    store.replaceQuery(2, { docs: [] })

    store.setShowOnlyRated(true)

    expect(store.query(1).showOnlyRated).toBe(true)
    expect(store.query(2).showOnlyRated).toBe(true)
  })

  it("publishes case-level diff scores separately from query documents", () => {
    store.setCaseDiffs([
      { name: "Baseline", version: 3, score: { score: 0.75, allRated: true } }
    ])

    expect(store.snapshot().caseDiffs).toEqual([
      { name: "Baseline", version: 3, score: { score: 0.75, allRated: true } }
    ])
  })

  it("clears case-level diff scores", () => {
    store.setCaseDiffs([{ name: "Baseline", score: { score: 0.75 } }])
    store.clearCaseDiffs()

    expect(store.snapshot().caseDiffs).toEqual([])
  })

  it("collapses every query", () => {
    store.replaceQuery(1, { docs: [], expanded: true })
    store.replaceQuery(2, { docs: [], expanded: true })

    store.collapseAll()

    expect(store.query(1).expanded).toBe(false)
    expect(store.query(2).expanded).toBe(false)
  })
})

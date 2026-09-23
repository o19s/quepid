import { beforeEach, describe, expect, it } from "vitest"
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

  it("publishes live-query intents without knowing their Angular owner", () => {
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

  it("collapses every query", () => {
    store.replaceQuery(1, { docs: [], expanded: true })
    store.replaceQuery(2, { docs: [], expanded: true })

    store.collapseAll()

    expect(store.query(1).expanded).toBe(false)
    expect(store.query(2).expanded).toBe(false)
  })
})

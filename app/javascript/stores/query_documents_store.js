import { QueryCollectionStore, queryCollectionStore } from "stores/query_collection_store"

/**
 * Observable read model for the documents in each expanded query.
 *
 * The live-query runtime owns search, scoring, and rating mutations. It publishes plain
 * document snapshots here so the expanded-results renderer can stop walking
 * controller scopes without changing the live search contract.
 */
export class QueryDocumentsStore extends EventTarget {
  constructor({ queries = new QueryCollectionStore() } = {}) {
    super()
    this.collection = queries
    this.reset()
    // These projections share the collection's page lifetime. A preference or
    // live-query publication must also notify expanded-results subscribers.
    // Keep single-query changes scoped so other comparison controls stay mounted.
    this.collection.addEventListener("change", event => {
      this._queries.forEach((_query, key) => {
        if (!this.collection.liveQuery(key)) this._queries.delete(key)
      })
      this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(event.detail.queryId) }))
    })
    this.collection.addEventListener("reset", () => this.reset())
  }

  reset() {
    this._queries = new Map()
    this._caseDiffs = []
    this._caseSummary = { allRated: false }
    this.dispatchEvent(new CustomEvent("reset", { detail: this.snapshot() }))
  }

  replaceQuery(queryId, { docs = [], ratedDocs = [], ...state } = {}) {
    const previous = this._queries.get(String(queryId)) || {}
    this._queries.set(String(queryId), {
      ...previous,
      queryId: Number(queryId),
      ...state,
      docs: docs.map(doc => snapshotDocument(doc, state)),
      ratedDocs: ratedDocs.map(doc => snapshotDocument(doc, state)),
      diffs: snapshotDiffs(state.diffs, state)
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
  }

  updateQueryState(queryId, state = {}) {
    const key = String(queryId)
    const current = this._queries.get(key) || { queryId: Number(queryId), docs: [], ratedDocs: [] }
    this._queries.set(key, { ...current, ...state })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
  }

  setCaseDiffs(searchers = []) {
    this._caseDiffs = searchers.map((searcher) => ({
      name: searcher.name || "Snapshot",
      version: searcher.version ?? null,
      score: searcher.score || { score: "?", allRated: false }
    }))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  clearCaseDiffs() {
    this.setCaseDiffs([])
  }

  setCaseSummary(summary = {}) {
    this._caseSummary = { ...this._caseSummary, ...summary }
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  removeQuery(queryId) {
    this._queries.delete(String(queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  request(command, detail = {}) {
    this.dispatchEvent(new CustomEvent("command", {
      detail: { command, ...detail }
    }))
  }

  requestToggleQuery(queryId) {
    this.request("toggle-query", { queryId })
  }

  requestPaginateQuery(queryId, ratedOnly) {
    this.request("paginate-query", { queryId, ratedOnly: Boolean(ratedOnly) })
  }

  requestRateDocument(queryId, docId, rating) {
    this.request("rate-document", { queryId, docId, rating })
  }

  requestRateAll(queryId, rating) {
    this.request("rate-all", { queryId, rating })
  }

  query(queryId) {
    const documents = this._queries.get(String(queryId))
    const query = this.collection.query(queryId)
    if (!documents || !query) return null

    return {
      ...documents,
      queryText: query.queryText,
      numFound: query.numFound,
      ratedDocsFound: query.ratedDocsFound,
      errorText: query.errorText,
      queryState: query.state,
      allRated: query.currentScore?.allRated ?? false,
      missingRatings: query.currentScore?.countMissingRatings ?? null,
      expanded: query.expanded === true,
      showOnlyRated: this.collection.showOnlyRated
    }
  }

  snapshot(queryId) {
    const queries = Object.fromEntries([...this._queries.keys()].map(key => [key, this.query(key)]).filter(([_key, query]) => query))
    return {
      queryId: queryId == null ? null : Number(queryId),
      showOnlyRated: this.collection.showOnlyRated,
      query: queryId == null ? null : queries[String(queryId)] ?? null,
      queries,
      caseDiffs: this._caseDiffs.map((searcher) => ({ ...searcher, score: { ...searcher.score } })),
      caseSummary: { ...this._caseSummary }
    }
  }
}

export function snapshotDocument(doc, state = {}) {
  let matchExplain = null
  if (doc.explain && doc.hotMatchesOutOf) {
    try {
      const explain = doc.explain()
      const hasChildren = explain.children.length > 0
      matchExplain = {
        hasChildren,
        hots: doc.hotMatchesOutOf(state.maxDocScore),
        explainToStr: hasChildren ? explain.toStr() : null,
        explainAsJson: hasChildren ? null : JSON.stringify(explain.asJson, null, 2),
        explainRawStr: explain.rawStr(),
        docTitle: doc.title,
        docId: doc.id,
        docScore: doc.score?.() ?? null
      }
    } catch (_error) {
      // Explain data is optional display enhancement; a failed explanation
      // must not prevent the search result itself from rendering.
      matchExplain = null
    }
  }

  return {
    id: doc.id,
    title: doc.title ?? "",
    subs: { ...(doc.subs || {}) },
    thumb: doc.thumb,
    thumb_options: doc.thumb_options,
    image: doc.image,
    image_options: doc.image_options,
    hasThumb: Boolean(doc.hasThumb?.()),
    hasImage: Boolean(doc.hasImage?.()),
    embeds: { ...(doc.embeds || {}) },
    translations: { ...(doc.translations || {}) },
    unabridgeds: { ...(doc.unabridgeds || {}) },
    snippets: { ...(doc.subSnippets?.("<strong>", "</strong>") || {}) },
    rawFields: doc.doc?.origin?.() || {},
    linkUrl: state.documentUrlFor?.(doc) || null,
    matchExplain,
    error: doc.error,
    rating: doc.hasRating?.() ? doc.getRating?.() : null,
    score: doc.score?.() ?? null
  }
}

function snapshotDiffs(diffs, state = {}) {
  if (!diffs) return null

  return {
    searchers: (diffs.searchers || []).map((searcher) => ({
      name: searcher.name || "Snapshot",
      version: searcher.version ?? null,
      inError: Boolean(searcher.inError),
      searchError: searcher.searchError || "",
      score: searcher.score || { score: "?", allRated: false },
      docs: (searcher.docs || []).map(doc => snapshotDocument(doc, {
        ...state,
        maxDocScore: searcher.maxDocScore
      })),
      ratedDocs: (searcher.ratedDocs || []).map(doc => snapshotDocument(doc, {
        ...state,
        maxDocScore: searcher.maxDocScore
      }))
    }))
  }
}

// One case workspace per page load. Case/try changes are full navigations.
export const queryDocumentsStore = new QueryDocumentsStore({ queries: queryCollectionStore })

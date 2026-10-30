import { QueryCollectionStore, queryCollectionStore } from "stores/query_collection_store"
import { lazyDetail } from "utils/lazy_detail"
import { plainDocument } from "utils/query_documents"

// Keys of snapshot() other than queryId, exposed lazily on `change` events. Keep in sync (tested).
export const DOCUMENTS_SNAPSHOT_KEYS = [
  "showOnlyRated",
  "query",
  "queries",
  "caseDiffs",
  "caseSummary"
]

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
    this.collection.addEventListener("change", (event) => {
      this.pruneRemovedQueries(event.detail.queryId)
      this.dispatchEvent(
        new CustomEvent("change", { detail: this.changeDetail(event.detail.queryId) })
      )
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
      docs: docs.map((doc) => snapshotDocument(doc, state)),
      ratedDocs: ratedDocs.map((doc) => snapshotDocument(doc, state)),
      diffs: snapshotDiffs(state.diffs, state)
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.changeDetail(queryId) }))
  }

  updateQueryState(queryId, state = {}) {
    const key = String(queryId)
    const current = this._queries.get(key) || { queryId: Number(queryId), docs: [], ratedDocs: [] }
    this._queries.set(key, { ...current, ...state })
    this.dispatchEvent(new CustomEvent("change", { detail: this.changeDetail(queryId) }))
  }

  setCaseDiffs(searchers = []) {
    this._caseDiffs = searchers.map((searcher) => ({
      name: searcher.name || "Snapshot",
      version: searcher.version ?? null,
      score: searcher.score || { score: "?", allRated: false }
    }))
    this.dispatchEvent(new CustomEvent("change", { detail: this.changeDetail() }))
  }

  clearCaseDiffs() {
    this.setCaseDiffs([])
  }

  setCaseSummary(summary = {}) {
    this._caseSummary = { ...this._caseSummary, ...summary }
    this.dispatchEvent(new CustomEvent("change", { detail: this.changeDetail() }))
  }

  // A single-query change can only have removed that query, so only a case-wide change sweeps.
  // Sweeping on every change made loading N queries O(N^2).
  pruneRemovedQueries(queryId) {
    if (queryId != null) {
      if (!this.collection.liveQuery(queryId)) this._queries.delete(String(queryId))
      return
    }
    this._queries.forEach((_query, key) => {
      if (!this.collection.liveQuery(key)) this._queries.delete(key)
    })
  }

  removeQuery(queryId) {
    this._queries.delete(String(queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: this.changeDetail() }))
  }

  request(command, detail = {}) {
    this.dispatchEvent(
      new CustomEvent("command", {
        detail: { command, ...detail }
      })
    )
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

  // Case-level snapshot-comparison scores, without building every query as snapshot() does.
  caseDiffs() {
    return this._caseDiffs.map((searcher) => ({ ...searcher, score: { ...searcher.score } }))
  }

  changeDetail(queryId) {
    return lazyDetail(DOCUMENTS_SNAPSHOT_KEYS, () => this.snapshot(queryId), {
      queryId: queryId == null ? null : Number(queryId)
    })
  }

  snapshot(queryId) {
    const queries = Object.fromEntries(
      [...this._queries.keys()].map((key) => [key, this.query(key)]).filter(([, query]) => query)
    )
    return {
      queryId: queryId == null ? null : Number(queryId),
      showOnlyRated: this.collection.showOnlyRated,
      query: queryId == null ? null : (queries[String(queryId)] ?? null),
      queries,
      caseDiffs: this.caseDiffs(),
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
    } catch {
      // Explain data is optional display enhancement; a failed explanation
      // must not prevent the search result itself from rendering.
      matchExplain = null
    }
  }

  return {
    ...plainDocument(doc),
    snippets: { ...(doc.subSnippets?.("<strong>", "</strong>") || {}) },
    linkUrl: state.documentUrlFor?.(doc) || null,
    matchExplain,
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
      docs: (searcher.docs || []).map((doc) =>
        snapshotDocument(doc, {
          ...state,
          maxDocScore: searcher.maxDocScore
        })
      ),
      ratedDocs: (searcher.ratedDocs || []).map((doc) =>
        snapshotDocument(doc, {
          ...state,
          maxDocScore: searcher.maxDocScore
        })
      )
    }))
  }
}

// One case workspace per page load. Case/try changes are full navigations.
export const queryDocumentsStore = new QueryDocumentsStore({ queries: queryCollectionStore })

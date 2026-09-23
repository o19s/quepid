/**
 * Observable read model for the documents in each expanded query.
 *
 * Angular still owns search, scoring, and rating mutations. It publishes plain
 * document snapshots here so the expanded-results renderer can stop walking
 * Angular scopes without changing the live search contract.
 */
export class QueryDocumentsStore extends EventTarget {
  constructor() {
    super()
    this.reset()
  }

  reset() {
    this._showOnlyRated = false
    this._queries = new Map()
    this._pendingQueryState = new Map()
    this.dispatchEvent(new CustomEvent("reset", { detail: this.snapshot() }))
  }

  replaceQuery(queryId, { docs = [], ratedDocs = [], ...state } = {}) {
    const previous = this._queries.get(String(queryId)) || {}
    const pending = this._pendingQueryState.get(String(queryId)) || {}
    this._queries.set(String(queryId), {
      ...previous,
      ...pending,
      queryId: Number(queryId),
      showOnlyRated: this._showOnlyRated,
      ...state,
      docs: docs.map(doc => snapshotDocument(doc, state)),
      ratedDocs: ratedDocs.map(doc => snapshotDocument(doc, state))
    })
    this._pendingQueryState.delete(String(queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
  }

  updateQueryState(queryId, state = {}) {
    const current = this._queries.get(String(queryId))
    if (!current) {
      const key = String(queryId)
      this._pendingQueryState.set(key, {
        ...(this._pendingQueryState.get(key) || {}),
        ...state
      })
      this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
      return
    }

    this._queries.set(String(queryId), { ...current, ...state })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
  }

  setShowOnlyRated(showOnlyRated) {
    this._showOnlyRated = Boolean(showOnlyRated)
    this._queries.forEach((query, queryId) => {
      this._queries.set(queryId, { ...query, showOnlyRated: this._showOnlyRated })
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  collapseAll() {
    this._queries.forEach((query, queryId) => {
      this._queries.set(queryId, { ...query, expanded: false })
    })
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
    return this._queries.get(String(queryId)) ?? null
  }

  snapshot(queryId) {
    const queries = Object.fromEntries(this._queries)
    return {
      queryId: queryId == null ? null : Number(queryId),
      showOnlyRated: this._showOnlyRated,
      query: queryId == null ? null : queries[String(queryId)] ?? null,
      queries
    }
  }
}

function snapshotDocument(doc, state = {}) {
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

// One case workspace per page load. Case/try changes are full navigations.
export const queryDocumentsStore = new QueryDocumentsStore()

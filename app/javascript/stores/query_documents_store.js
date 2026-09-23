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
    this._queries = new Map()
    this.dispatchEvent(new CustomEvent("reset", { detail: this.snapshot() }))
  }

  replaceQuery(queryId, { docs = [], ratedDocs = [], ...state } = {}) {
    this._queries.set(String(queryId), {
      queryId: Number(queryId),
      ...state,
      docs: docs.map(snapshotDocument),
      ratedDocs: ratedDocs.map(snapshotDocument)
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot(queryId) }))
  }

  removeQuery(queryId) {
    this._queries.delete(String(queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  query(queryId) {
    return this._queries.get(String(queryId)) ?? null
  }

  snapshot(queryId) {
    const queries = Object.fromEntries(this._queries)
    return {
      queryId: queryId == null ? null : Number(queryId),
      query: queryId == null ? null : queries[String(queryId)] ?? null,
      queries
    }
  }
}

function snapshotDocument(doc) {
  return {
    id: doc.id,
    title: doc.title ?? "",
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
    error: doc.error,
    rating: doc.hasRating?.() ? doc.getRating?.() : null,
    score: doc.score?.() ?? null
  }
}

// One case workspace per page load. Case/try changes are full navigations.
export const queryDocumentsStore = new QueryDocumentsStore()

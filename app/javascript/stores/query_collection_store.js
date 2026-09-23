/**
 * Observable read model for the case query collection.
 *
 * During the Angular migration, Angular still owns the live Query objects
 * (search, documents, ratings, and scoring). This store owns the collection
 * snapshot and display order so the future Stimulus query-list can read the
 * same bootstrap state without reaching into an Angular scope.
 */
export class QueryCollectionStore extends EventTarget {
  constructor() {
    super()
    this.reset()
  }

  reset() {
    this._caseId = null
    this._status = "idle"
    this._displayOrder = []
    this._queries = new Map()
    this.dispatchEvent(new CustomEvent("reset", { detail: this.snapshot() }))
  }

  beginBootstrap(caseId) {
    this._caseId = Number(caseId)
    this._status = "bootstrapping"
    this._displayOrder = []
    this._queries = new Map()
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  replace({ caseId, displayOrder = [], queries = [] }) {
    this._caseId = Number(caseId)
    this._displayOrder = displayOrder.map(Number)
    this._queries = new Map(
      queries
        .filter(query => query.deleted !== true && query.deleted !== "true")
        .map(query => [String(this.queryId(query)), this.querySnapshot(query)])
    )
    this._status = "ready"
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  markError(error) {
    this._status = "error"
    this.dispatchEvent(new CustomEvent("error", { detail: { error, ...this.snapshot() } }))
  }

  upsert(query) {
    const queryId = this.queryId(query)
    if (queryId === undefined || queryId === null) return

    this._queries.set(String(queryId), this.querySnapshot(query))
    if (!this._displayOrder.includes(Number(queryId))) this._displayOrder.push(Number(queryId))
    this._status = "ready"
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  remove(queryId) {
    this._queries.delete(String(queryId))
    this._displayOrder = this._displayOrder.filter(id => String(id) !== String(queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  setDisplayOrder(displayOrder = []) {
    this._displayOrder = displayOrder.map(Number)
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  get status() {
    return this._status
  }

  get caseId() {
    return this._caseId
  }

  query(queryId) {
    return this._queries.get(String(queryId)) ?? null
  }

  orderedQueryIds() {
    const knownIds = new Set(this._queries.keys())
    const ordered = this._displayOrder.filter(id => knownIds.has(String(id)))
    const missing = [...this._queries.keys()]
      .filter(id => !ordered.some(orderedId => String(orderedId) === id))
      .map(Number)
    return [...ordered, ...missing]
  }

  snapshot() {
    return {
      caseId: this._caseId,
      status: this._status,
      displayOrder: [...this._displayOrder],
      queries: Object.fromEntries(this._queries)
    }
  }

  queryId(query) {
    return query.queryId ?? query.query_id
  }

  querySnapshot(query) {
    return {
      queryId: Number(this.queryId(query)),
      queryText: query.queryText ?? query.query_text ?? "",
      informationNeed: query.informationNeed ?? query.information_need ?? "",
      modified: query.modified ?? query.updated_at ?? null,
      created: query.created ?? query.created_at ?? null
    }
  }
}

// One case workspace per page load. Case changes are full navigations today,
// so a module-scoped singleton is safe and matches CaseScoreStore.
export const queryCollectionStore = new QueryCollectionStore()

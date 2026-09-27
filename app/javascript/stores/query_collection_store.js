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
    this._searchGeneration = (this._searchGeneration ?? 0) + 1
    this._searchStatus = "idle"
    this._searchError = null
    this._displayOrder = []
    this._queries = new Map()
    this._expandedQueries = new Map()
    this.dispatchEvent(new CustomEvent("reset", { detail: this.snapshot() }))
  }

  beginBootstrap(caseId) {
    this._caseId = Number(caseId)
    this._status = "bootstrapping"
    this._searchGeneration += 1
    this._searchStatus = "idle"
    this._searchError = null
    this._displayOrder = []
    this._queries = new Map()
    this._expandedQueries = new Map()
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
    this._queries.forEach((query, queryId) => {
      if (this._expandedQueries.has(queryId)) {
        this._queries.set(queryId, {
          ...query,
          expanded: this._expandedQueries.get(queryId)
        })
      }
    })
    this._status = "ready"
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  replaceFromResponse(caseId, response = {}) {
    this.replace({
      caseId,
      displayOrder: response.display_order,
      queries: response.queries
    })
  }

  markError(error) {
    this._status = "error"
    this.dispatchEvent(new CustomEvent("error", { detail: { error, ...this.snapshot() } }))
  }

  beginSearch() {
    const generation = ++this._searchGeneration
    this._searchStatus = "searching"
    this._searchError = null
    this.dispatchEvent(new CustomEvent("search-started", { detail: this.snapshot() }))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
    return generation
  }

  finishSearch(generation = this._searchGeneration) {
    if (generation !== this._searchGeneration) return false

    this._searchStatus = "ready"
    this._searchError = null
    this.dispatchEvent(new CustomEvent("search-completed", { detail: this.snapshot() }))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
    return true
  }

  failSearch(error, generation = this._searchGeneration) {
    if (generation !== this._searchGeneration) return false

    this._searchStatus = "error"
    this._searchError = error
    this.dispatchEvent(new CustomEvent("search-failed", { detail: { error, ...this.snapshot() } }))
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
    return true
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

  setExpanded(queryId, expanded) {
    const key = String(queryId)
    const value = Boolean(expanded)
    this._expandedQueries.set(key, value)
    const query = this._queries.get(key)
    if (query) this._queries.set(key, { ...query, expanded: value })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  collapseAll() {
    this._expandedQueries.forEach((_expanded, queryId) => {
      this._expandedQueries.set(queryId, false)
    })
    this._queries.forEach((query, queryId) => {
      this._queries.set(queryId, { ...query, expanded: false })
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  requestToggleShowOnlyRated() {
    this.request("toggle-show-only-rated")
  }

  requestCollapseAll() {
    this.request("collapse-all")
  }

  request(command, detail = {}) {
    this.dispatchEvent(new CustomEvent("command", {
      detail: { command, ...detail }
    }))
  }

  get status() {
    return this._status
  }

  get caseId() {
    return this._caseId
  }

  get searchStatus() {
    return this._searchStatus
  }

  get searchError() {
    return this._searchError
  }

  query(queryId) {
    return this._queries.get(String(queryId)) ?? null
  }

  get size() {
    return this._queries.size
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
      search: {
        status: this._searchStatus,
        error: this._searchError
      },
      displayOrder: [...this._displayOrder],
      queries: Object.fromEntries(this._queries)
    }
  }

  queryId(query) {
    return query.queryId ?? query.query_id
  }

  querySnapshot(query) {
    const queryId = Number(this.queryId(query))
    const currentScore = query.currentScore || {}
    const parsedQueryDetails = query.searcher?.parsedQueryDetails
    const queryState = typeof query.state === "function" ? query.state() : query.state
    const snapshot = {
      queryId,
      caseNo: query.caseNo ?? query.case_no ?? this._caseId,
      queryText: query.queryText ?? query.query_text ?? "",
      informationNeed: query.informationNeed ?? query.information_need ?? "",
      modified: query.modified ?? query.updated_at ?? null,
      created: query.created ?? query.created_at ?? null,
      numFound: query.numFound ?? query.num_found,
      ratedDocsFound: query.ratedDocsFound ?? query.rated_docs_found,
      errorText: query.errorText ?? query.error_text,
      lastScore: query.lastScore ?? currentScore.score,
      currentScore: currentScore.score === undefined ? undefined : {
        score: currentScore.score,
        maxScore: currentScore.maxScore,
        allRated: currentScore.allRated,
        countMissingRatings: currentScore.countMissingRatings
      },
      allRated: query.allRated ?? currentScore.allRated,
      state: queryState,
      options: query.options || {},
      parsedQueryDetails,
      diffs: query.diffs ? true : undefined
    }
    if (this._expandedQueries.has(String(queryId))) snapshot.expanded = this._expandedQueries.get(String(queryId))
    return snapshot
  }
}

// One case workspace per page load. Case changes are full navigations today,
// so a module-scoped singleton is safe and matches CaseScoreStore.
export const queryCollectionStore = new QueryCollectionStore()

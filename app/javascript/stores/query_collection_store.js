import { isSameId } from "utils/record_identity"

/**
 * Observable read model for the case query collection.
 *
 * This store owns the live Query objects, their read projection, and
 * display order. The snapshot API keeps Stimulus independent from the live
 * search and scoring model.
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
    this._showOnlyRated = false
    this._displayOrder = []
    this._liveQueries = new Map()
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
    this._liveQueries = new Map()
    this._expandedQueries = new Map()
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  replace({ caseId, displayOrder = [], queries = [] }) {
    this._caseId = Number(caseId)
    this._displayOrder = displayOrder.map(Number)
    const nextQueries = queries.filter(query => query.deleted !== true && query.deleted !== "true")
    this._liveQueries = new Map(
      nextQueries.map(query => [String(query.queryId), query])
    )
    const knownIds = new Set(this._liveQueries.keys())
    this._expandedQueries.forEach((_value, key) => {
      if (!knownIds.has(key)) this._expandedQueries.delete(key)
    })
    this._status = "ready"
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
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

  upsert(query, { publish = true } = {}) {
    const queryId = this.queryId(query)
    if (queryId === undefined || queryId === null) return

    const key = String(queryId)
    this._liveQueries.set(key, query)
    if (!this._displayOrder.includes(Number(queryId))) this._displayOrder.push(Number(queryId))
    this._status = "ready"
    if (publish) this.dispatchEvent(new CustomEvent("change", { detail: { ...this.snapshot(), queryId: Number(queryId) } }))
  }

  remove(queryId) {
    this._liveQueries.delete(String(queryId))
    this._expandedQueries.delete(String(queryId))
    this._displayOrder = this._displayOrder.filter(id => !isSameId(id, queryId))
    this.dispatchEvent(new CustomEvent("change", { detail: { ...this.snapshot(), queryId: Number(queryId) } }))
  }

  setDisplayOrder(displayOrder = []) {
    this._displayOrder = displayOrder.map(Number)
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  setExpanded(queryId, expanded) {
    const key = String(queryId)
    const value = Boolean(expanded)
    this._expandedQueries.set(key, value)
    this.dispatchEvent(new CustomEvent("change", { detail: { ...this.snapshot(), queryId: Number(queryId) } }))
  }

  collapseAll() {
    this._expandedQueries.forEach((_expanded, queryId) => {
      this._expandedQueries.set(queryId, false)
    })
    this.dispatchEvent(new CustomEvent("change", { detail: this.snapshot() }))
  }

  get showOnlyRated() {
    return this._showOnlyRated
  }

  setShowOnlyRated(value) {
    this._showOnlyRated = Boolean(value)
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
    const query = this.liveQuery(queryId)
    return query ? this.querySnapshot(query) : null
  }

  liveQuery(queryId) {
    return this._liveQueries.get(String(queryId)) ?? null
  }

  // The live Query objects keyed by id. Use orderedQueryIds() for display order.
  liveQueries() {
    return Object.fromEntries(this._liveQueries)
  }

  clearLiveQueries() {
    this._liveQueries.clear()
  }

  get size() {
    return this._liveQueries.size
  }

  orderedQueryIds() {
    const knownIds = new Set(this._liveQueries.keys())
    const ordered = this._displayOrder.filter(id => knownIds.has(String(id)))
    const missing = [...this._liveQueries.keys()]
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
      showOnlyRated: this.showOnlyRated,
      displayOrder: [...this._displayOrder],
      queries: Object.fromEntries([...this._liveQueries].map(([key, query]) => [key, this.querySnapshot(query)]))
    }
  }

  queryId(query) {
    return query.queryId
  }

  querySnapshot(query) {
    const queryId = Number(this.queryId(query))
    const currentScore = query.currentScore || {}
    const parsedQueryDetails = query.searcher?.parsedQueryDetails
    const searcher = query.searcher
    const queryState = typeof query.state === "function" ? query.state() : query.state
    const snapshot = {
      queryId,
      caseNo: query.caseNo ?? this._caseId,
      queryText: query.queryText ?? "",
      informationNeed: query.informationNeed ?? "",
      modified: query.modified ?? null,
      modifiedAt: query.modifiedAt ?? null,
      created: query.created ?? null,
      numFound: query.numFound,
      ratedDocsFound: query.ratedDocsFound,
      errorText: query.errorText,
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
      queryDetails: searcher?.queryDetails,
      supportsTemplate: typeof searcher?.isTemplateCall === "function",
      diffs: query.diffs ? true : undefined
    }
    snapshot.expanded = this._expandedQueries.get(String(queryId)) ?? false
    return snapshot
  }
}

// One case workspace per page load. Case changes are full navigations today,
// so a module-scoped singleton is safe and matches CaseScoreStore.
export const queryCollectionStore = new QueryCollectionStore()

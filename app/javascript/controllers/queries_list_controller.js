import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"
import { putJson } from "api/json"
import { hideTooltipsWithin } from "utils/bs_tooltip"
import { matchesQueryFilter, queryResultCount, querqyRuleTriggered } from "utils/query_state"
import { flashErrorMessage } from "utils/error_message"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"
import { isSameId } from "utils/record_identity"

/**
 * Query-list collection rendering, toolbar, and drag lifecycle. The collection
 * store owns the rendered query read model; the live-query runtime remains
 * behind narrow adapters for persistence, sorting, and query-template rendering.
 */
export default class extends Controller {
  static targets = ["ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink", "sortIcon", "manualHelp", "list", "pagination", "count", "bootstrapFeedback", "searchFeedback", "batchPosition", "batchSize", "rowTemplate", "searchResultsTemplate", "paginationTemplate", "diffScoreTemplate"]
  static values = {
    showOnlyRated: Boolean,
    showOnlyRatedUnsupported: Boolean,
    sortName: String,
    reverse: Boolean,
    queryListSortable: Boolean,
    positionUrlTemplate: String,
    queryUrlTemplate: String,
    notesUrlTemplate: String
  }

  connect() {
    this.pageSize = 15
    this.currentPage = 1
    this.filterValue = ""
    this.clientSortName = this.sortNameValue
    this.clientReverse = this.reverseValue
    this.queryCapabilities = getCoreCapabilities().queryCapabilities
    this.syncSortFromUrl()
    const stores = getCoreStores()
    this.store = stores.queries
    this.storeChange = () => this.scheduleRender()
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
    this.searchFailed = event => this.handleSearchFailed(event)
    this.searchSettled = () => this.handleSearchSettled()
    this.store.addEventListener("search-failed", this.searchFailed)
    this.store.addEventListener("search-started", this.searchSettled)
    this.documentStore = stores.documents
    this.documentStoreChange = () => this.scheduleRender()
    this.documentStore?.addEventListener("change", this.documentStoreChange)
    this.documentStore?.addEventListener("reset", this.documentStoreChange)
    this.setupSortable()
    this.render()
  }

  disconnect() {
    this.store?.removeEventListener("change", this.storeChange)
    this.store?.removeEventListener("reset", this.storeChange)
    this.store?.removeEventListener("search-failed", this.searchFailed)
    this.store?.removeEventListener("search-started", this.searchSettled)
    this.documentStore?.removeEventListener("change", this.documentStoreChange)
    this.documentStore?.removeEventListener("reset", this.documentStoreChange)
    if (this.renderHandle) cancelAnimationFrame(this.renderHandle)
    this.sortable?.destroy()
  }

  handleQueryToggle(event) {
    this.forwardQueryToggle(event)
    this.scheduleRender()
  }

  refreshListState() {
    this.queryCapabilities = getCoreCapabilities().queryCapabilities
    this.scheduleRender()
  }

  changePage(event) {
    this.currentPage += event.params.direction === "next" ? 1 : -1
    this.render()
  }

  showOnlyRatedValueChanged() {
    this.render()
  }

  showOnlyRatedUnsupportedValueChanged() {
    this.render()
  }

  sortNameValueChanged() {
    this.clientSortName = this.sortNameValue
    this.updateSortableState()
    this.render()
  }

  reverseValueChanged() {
    this.clientReverse = this.reverseValue
    this.render()
  }

  queryListSortableValueChanged() {
    this.updateSortableState()
    this.render()
  }

  toggleShowOnlyRated(event) {
    event.preventDefault()
    if (!(this.currentShowOnlyRatedUnsupported ?? this.showOnlyRatedUnsupportedValue)) {
      this.store?.requestToggleShowOnlyRated?.()
    }
  }

  collapseAll(event) {
    event.preventDefault()
    this.store?.requestCollapseAll?.()
  }

  sort(event) {
    event.preventDefault()
    const field = event.currentTarget.dataset.sortField
    if (field === "default" && !this.queryListSortableValue) return
    if (field === this.clientSortName) {
      this.clientReverse = !this.clientReverse
    } else {
      this.clientSortName = field
      this.clientReverse = false
    }
    this.sortNameValue = field
    this.reverseValue = this.clientReverse
    this.persistSortToUrl()
    this.dispatch("sort-state-changed", {
      detail: {
        sort: this.activeSortName(),
        reverse: String(this.activeReverse())
      }
    })
    this.currentPage = 1
    this.render()
  }

  filter(event) {
    this.filterValue = event.currentTarget.value
    this.currentPage = 1
    this.render()
  }

  dragStart() {
    hideTooltipsWithin(this.listTarget)
    this.listTarget.classList.add("dragging")
    this.draggedQueryIds = [...this.listTarget.children].map(item => item.dataset.queryId)
    this.dispatch("drag-start")
  }

  async dragEnd(event) {
    hideTooltipsWithin(this.listTarget)
    const { oldIndex, newIndex } = event
    if (oldIndex === undefined || newIndex === undefined || oldIndex === newIndex) {
      this.clearDraggingState()
      return
    }

    const queryId = this.draggedQueryIds?.[oldIndex]
    const previousQueryId = this.draggedQueryIds?.[newIndex]
    if (!queryId || !previousQueryId || !this.positionUrlTemplateValue) {
      this.clearDraggingState()
      return
    }

    const currentReverse = this.activeReverse()
    const reverse = newIndex < oldIndex ? !currentReverse : currentReverse
    const url = this.queryUrl(this.positionUrlTemplateValue, queryId)

    try {
      const data = await putJson(url, { after: previousQueryId, reverse })
      if (this.queryCapabilities?.setDisplayOrder) {
        this.queryCapabilities.setDisplayOrder(data.display_order)
      } else {
        this.store?.setDisplayOrder?.(data.display_order)
      }
      this.scheduleRender()
    } catch (error) {
      console.error("queries-list: reorder failed", error)
      this.restoreDraggedOrder()
      coreFlash.show("error", "Unable to reorder queries.")
    } finally {
      this.clearDraggingState()
    }
  }

  clearDraggingState() {
    this.listTarget.classList.remove("dragging")
  }

  restoreDraggedOrder() {
    if (!this.draggedQueryIds) return
    const items = [...this.listTarget.children]
    this.draggedQueryIds.forEach(queryId => {
      const item = items.find(candidate => candidate.dataset.queryId === queryId)
      if (item) this.listTarget.appendChild(item)
    })
  }

  setupSortable() {
    if (!this.hasListTarget) return

    this.sortable = Sortable.create(this.listTarget, {
      animation: 150,
      direction: "vertical",
      filter: ".unsortable",
      preventOnFilter: false,
      onStart: () => this.dragStart(),
      onEnd: event => this.dragEnd(event)
    })
    this.updateSortableState()
  }

  updateSortableState() {
    if (this.sortable) this.sortable.option("disabled", !this.queryListSortableValue || this.activeSortName() !== "default")
  }

  activeSortName() {
    return this.clientSortName || this.sortNameValue || "default"
  }

  activeReverse() {
    return this.clientReverse ?? this.reverseValue
  }

  syncSortFromUrl() {
    const params = new URLSearchParams(window.location.search)
    const sort = params.get("sort")
    const reverse = params.get("reverse")
    if (sort) {
      this.clientSortName = sort
    }
    if (reverse !== null) {
      this.clientReverse = reverse === "true"
    }
  }

  persistSortToUrl() {
    const url = new URL(window.location.href)
    url.searchParams.set("sort", this.activeSortName())
    url.searchParams.set("reverse", String(this.activeReverse()))
    window.history.replaceState({}, "", url)
  }

  render() {
    this.syncListState()
    const showOnlyRated = this.currentShowOnlyRated ?? this.showOnlyRatedValue
    const showOnlyRatedUnsupported = this.currentShowOnlyRatedUnsupported ?? this.showOnlyRatedUnsupportedValue
    if (this.hasRatedCheckboxTarget) {
      this.ratedCheckboxTarget.checked = showOnlyRated
      this.ratedCheckboxTarget.disabled = showOnlyRatedUnsupported
    }
    if (this.hasRatedLabelTarget) {
      this.ratedLabelTarget.classList.toggle("text-muted", showOnlyRatedUnsupported)
      this.ratedLabelTarget.title = showOnlyRatedUnsupported
        ? "Not supported for this search engine yet"
        : ""
    }

    this.sortLinkTargets.forEach(link => {
      const active = link.dataset.sortField === this.activeSortName()
      link.classList.toggle("active", active)
      link.setAttribute("aria-pressed", String(active))
    })

    this.sortIconTargets.forEach(icon => {
      const active = icon.dataset.sortField === this.activeSortName()
      icon.classList.toggle("d-none", !active)
      icon.classList.toggle("bi-arrow-up", active && this.activeReverse())
      icon.classList.toggle("bi-arrow-down", active && !this.activeReverse())
    })

    if (this.hasManualHelpTarget) {
      this.manualHelpTarget.classList.toggle("d-none", this.queryListSortableValue)
    }
    if (this.hasManualSortLinkTarget) {
      this.manualSortLinkTarget.classList.toggle("d-none", !this.queryListSortableValue)
    }

    if (this.hasListTarget && this.store?.status === "ready") {
      this.renderQueryCollection()
    }
  }

  syncListState() {
    const state = this.queryCapabilities?.getListState?.()
    if (!state) return

    this.currentShowOnlyRated = state.showOnlyRated
    this.currentShowOnlyRatedUnsupported = state.showOnlyRatedUnsupported
    if (this.hasBootstrapFeedbackTarget) this.bootstrapFeedbackTarget.classList.toggle("d-none", !state.isBootstrapping)
    if (this.hasSearchFeedbackTarget) this.searchFeedbackTarget.classList.toggle("d-none", !state.searching)
    if (this.hasBatchPositionTarget) this.batchPositionTarget.textContent = String(state.batchPosition)
    if (this.hasBatchSizeTarget) this.batchSizeTarget.textContent = String(state.batchSize)
  }

  scheduleRender() {
    if (this.renderHandle) return
    this.renderHandle = requestAnimationFrame(() => {
      this.renderHandle = null
      this.render()
    })
  }

  renderQueryCollection() {
    const totalQueries = this.orderedLiveQueries({ ignoreFilter: true })
    const queries = this.orderedLiveQueries()
    const pageCount = Math.max(1, Math.ceil(queries.length / this.pageSize))
    this.currentPage = Math.min(this.currentPage, pageCount)
    const start = (this.currentPage - 1) * this.pageSize
    const visibleQueries = queries.slice(start, start + this.pageSize)

    // Rows are keyed by query id and reused, so a store change updates them in place instead of
    // reconnecting every nested controller (and losing, e.g., a half-typed note).
    const existing = new Map([...this.listTarget.children].map(row => [row.dataset.queryId, row]))
    visibleQueries.forEach((query, index) => {
      const queryId = String(query.queryId)
      const expanded = this.queryExpanded(query)
      let row = existing.get(queryId)
      if (row) {
        existing.delete(queryId)
      } else {
        row = document.createElement("li")
        row.dataset.queryId = queryId
        this.renderQueryShell(row, query)
      }
      row.className = expanded ? "unsortable" : ""
      this.updateQueryRow(row, query, start + index + 1, expanded)
      const current = this.listTarget.children[index]
      if (current !== row) this.listTarget.insertBefore(row, current || null)
    })
    existing.forEach(row => row.remove())

    if (this.hasCountTarget) this.countTarget.textContent = String(totalQueries.length)
    this.renderPagination(pageCount, queries.length)
  }

  orderedLiveQueries({ ignoreFilter = false } = {}) {
    const queries = this.store.orderedQueryIds()
      .map(queryId => this.store.query?.(queryId))
      .filter(Boolean)
      .filter(query => ignoreFilter || this.matchesFilter(query))

    const sortName = this.activeSortName()
    if (sortName === "default") return queries

    return queries.sort((left, right) => {
      const leftValue = this.sortValue(left, sortName)
      const rightValue = this.sortValue(right, sortName)
      const comparison = this.compareValues(leftValue, rightValue)
      const direction = ["modified", "score", "error"].includes(sortName) ? -1 : 1
      if (comparison !== 0) return (this.activeReverse() ? -direction : direction) * comparison
      if (sortName === "error") {
        const tie = Number(Boolean(left.allRated)) - Number(Boolean(right.allRated))
        return this.activeReverse() ? -tie : tie
      }
      return 0
    })
  }

  compareValues(leftValue, rightValue) {
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return leftValue - rightValue
    }

    return String(leftValue ?? "").localeCompare(String(rightValue ?? ""), undefined, {
      numeric: true,
      sensitivity: "base"
    })
  }

  matchesFilter(query) {
    return matchesQueryFilter(query, this.filterValue)
  }

  queryExpanded(query) {
    const snapshot = this.store?.query?.(query.queryId)
    return Boolean(snapshot?.expanded ?? query.isToggled?.())
  }

  sortValue(query, sortName) {
    if (sortName === "query") return query.queryText
    if (sortName === "modified") return query.modifiedAt || query.modified || ""
    if (sortName === "score") return query.lastScore ?? query.currentScore?.score ?? ""
    if (sortName === "error") return query.errorText || ""
    return ""
  }

  queryUrl(template, queryId) {
    return template.replaceAll("__QUERY_ID__", String(queryId))
  }

  // A new row: the row and expanded-query shells from the ERB templates, wired to this query.
  renderQueryShell(row, query) {
    const queryId = String(query.queryId)
    const fragment = this.rowTemplateTarget.content.cloneNode(true)
    const slot = name => fragment.querySelector(`[data-slot="${name}"]`)

    slot("row").dataset.queryRowQueryIdValue = queryId
    slot("score").dataset.qscoreQueryQueryIdValue = queryId
    slot("unratedBadge").dataset.queryUnratedBadgeQueryIdValue = queryId
    slot("row").querySelector('[data-query-row-target="expanded"]').appendChild(this.buildSearchResults(query))
    row.replaceChildren(fragment)
  }

  // Every render: the row's changeable values. Unchanged values are left alone so their
  // controllers' value callbacks only run for real changes.
  updateQueryRow(row, query, rank, expanded) {
    const numFound = String(Number(queryResultCount(query, this.currentShowOnlyRated ?? this.showOnlyRatedValue) || 0))
    const slot = name => row.querySelector(`[data-slot="${name}"]`)
    assignChanged(slot("row").dataset, {
      queryRowRankValue: String(rank),
      queryRowNumFoundValue: numFound,
      queryRowQuerqyTriggeredValue: String(querqyRuleTriggered(query.parsedQueryDetails)),
      queryRowDiffValue: String(Boolean(query.diffs)),
      queryRowToggledValue: String(Boolean(expanded)),
      // User-controlled values are assigned as data attributes, never interpolated into markup.
      queryRowQueryTextValue: query.queryText || "",
      queryRowInformationNeedValue: query.informationNeed || "",
      queryRowStateValue: query.state || ""
    })
    assignChanged(slot("resultCount").dataset, { countUpNumberValue: numFound })
    assignChanged(slot("label").dataset, { bsTooltipTitleValue: `Info Need: ${query.informationNeed || ""}` })
    this.renderDiffScores(slot("diffScores"), query)
  }

  renderDiffScores(container, query) {
    const searchers = this.documentStore?.query(query.queryId)?.diffs?.searchers || []
    if (container.children.length === searchers.length) return

    container.replaceChildren(...searchers.map((_searcher, index) => {
      const badge = this.diffScoreTemplateTarget.content.firstElementChild.cloneNode(true)
      badge.dataset.diffScoreQueryIdValue = String(query.queryId)
      badge.dataset.diffScoreIndexValue = String(index)
      return badge
    }))
  }

  // The expanded-query shell, wired to this query's id and server-provided API URLs.
  buildSearchResults(query) {
    const fragment = this.searchResultsTemplateTarget.content.cloneNode(true)
    const queryId = String(query.queryId)
    const slot = name => fragment.querySelector(`[data-slot="${name}"]`)

    slot("explain").dataset.queryExplainQueryIdValue = queryId
    slot("missingDocuments").dataset.missingDocumentsQueryIdValue = queryId
    Object.assign(slot("delete").dataset, {
      queryDeleteQueryIdValue: queryId,
      queryDeleteDeleteUrlValue: this.queryUrl(this.queryUrlTemplateValue, queryId)
    })
    slot("notes").dataset.queryNotesUrlValue = this.queryUrl(this.notesUrlTemplateValue, queryId)
    for (const [field, prefix] of [["informationNeed", "information"], ["notes", "notes"]]) {
      const id = `${prefix}-${queryId}`
      slot(`${field}Field`).id = id
      slot(`${field}Label`).htmlFor = id
    }

    return fragment.firstElementChild
  }

  // `query-explain` outlet API: Params/Parsing data from the store, read when the modal opens.
  explainData(queryId) {
    return queryExplainData(this.store?.query?.(queryId) || {})
  }

  // `query-explain` outlet API: renders the template through the live searcher; rejects on failure.
  async renderQueryTemplate(queryId) {
    const searcher = this.queryCapabilities?.getQuery?.(queryId)?.searcher
    if (typeof searcher?.isTemplateCall !== "function") throw new Error(`No live searcher for query ${queryId}`)

    const isTemplatedQuery = searcher.isTemplateCall(searcher.args)
    // Only templated queries can be rendered; asking the engine to render anything else is a 400.
    if (!isTemplatedQuery) return { isTemplatedQuery }

    await searcher.renderTemplate()
    return {
      isTemplatedQuery,
      renderedQueryTemplate: JSON.stringify(searcher.renderedTemplateJson.template_output, null, 2)
    }
  }

  forwardQueryToggle(event) {
    const row = event.target.closest("[data-query-row-query-id-value]")
    const expanded = row?.querySelector('[data-query-row-target="expanded"]')
    const firstChild = expanded?.firstElementChild
    const searchResults = firstChild?.matches('[data-controller="search-results"]')
      ? firstChild
      : firstChild?.querySelector('[data-controller="search-results"]')
    if (!searchResults) return

    searchResults.dispatchEvent(new CustomEvent("query-row:toggle", {
      detail: event.detail
    }))
  }

  handleQueryDeleteCompleted(event) {
    const queryId = event.detail?.queryId
    if (queryId === undefined || queryId === null) return

    // Stimulus owns the persisted mutation and the stores own the rendered
    // collection. `query-delete` has already told the query-command bridge to
    // drop the live query object; the query list only updates its read models.
    this.store?.remove?.(queryId)
    this.documentStore?.removeQuery?.(queryId)
    this.scheduleRender()
  }

  // searchAll() failures were previously silent outside the add-query flow
  // (e.g. re-search after an import/judgements reload, or a settings change) —
  // the collection store now reports every generation-tracked failure here.
  handleSearchFailed(event) {
    const message = flashErrorMessage(event.detail?.error, "Search failed. Some queries may not have updated.")
    coreFlash.show("error", message, "search-error")
  }

  handleSearchSettled() {
      coreFlash.hide("search-error")
  }

  handleQueryMoveCompleted(event) {
    const detail = event.detail || {}
    if (!isSameId(detail.caseId, this.store?.caseId) || detail.queryId == null) return

    this.store?.remove?.(detail.queryId)
    this.documentStore?.removeQuery?.(detail.queryId)
    this.scheduleRender()
  }

  renderPagination(pageCount, totalCount) {
    if (!this.hasPaginationTarget) return
    this.paginationTarget.replaceChildren()
    if (pageCount <= 1) return

    const nav = this.paginationTemplateTarget.content.cloneNode(true).firstElementChild
    nav.querySelector('[data-slot="summary"]').textContent =
      `Page ${this.currentPage} of ${pageCount} (${totalCount} queries)`
    nav.querySelector('[data-slot="previous"]').disabled = this.currentPage === 1
    nav.querySelector('[data-slot="next"]').disabled = this.currentPage === pageCount
    this.paginationTarget.appendChild(nav)
  }

}

function assignChanged(dataset, values) {
  Object.entries(values).forEach(([key, value]) => {
    if (dataset[key] !== value) dataset[key] = value
  })
}

function queryExplainData(query) {
  if (!query.parsedQueryDetails && !query.queryDetails && !query.supportsTemplate) {
    return {
      parsedQueryDetails: "{}",
      queryDetails: null,
      queryDetailsMessage: "No results yet.",
      supportsTemplate: false
    }
  }

  const data = {
    parsedQueryDetails: sortedJson(query.parsedQueryDetails),
    queryDetails: null,
    queryDetailsMessage: null,
    supportsTemplate: query.supportsTemplate === true
  }

  if (query.queryDetails !== undefined) {
    if (Object.keys(query.queryDetails || {}).length === 0) {
      data.queryDetailsMessage = "The list of query parameters used to construct the query was not returned by Solr."
    } else {
      data.queryDetails = sortedJson(query.queryDetails)
    }
  } else {
    data.queryDetailsMessage = "Query parameters are not returned by the current Search Engine."
  }

  return data
}

function sortedJson(value) {
  const sorted = Object.keys(value || {}).sort().reduce((result, key) => {
    result[key] = value[key]
    return result
  }, {})
  return JSON.stringify(sorted, null, 2)
}

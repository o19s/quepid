import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { hideTooltipsWithin } from "utils/bs_tooltip"
import { matchesQueryFilter, queryResultCount, querqyRuleTriggered } from "utils/query_state"
import { errorMessage } from "utils/error_message"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import { searchResultsTemplate } from "controllers/search_results_template"
import coreFlash from "utils/core_flash"

/**
 * Query-list collection rendering, toolbar, and drag lifecycle. The collection
 * store owns the rendered query read model; the live-query runtime remains
 * behind narrow adapters for persistence, sorting, and query-template rendering.
 */
export default class extends Controller {
  static targets = ["ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink", "sortIcon", "manualHelp", "list", "pagination", "count", "bootstrapFeedback", "searchFeedback", "batchPosition", "batchSize"]
  static values = {
    showOnlyRated: Boolean,
    showOnlyRatedUnsupported: Boolean,
    sortName: String,
    reverse: Boolean,
    queryListSortable: Boolean,
    positionUrl: String
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
    this.queryToggle = event => {
      this.forwardQueryToggle(event)
      this.scheduleRender()
    }
    this.queryDeleteCompleted = event => this.handleQueryDeleteCompleted(event)
    this.queryMoveCompleted = event => this.handleQueryMoveCompleted(event)
    this.element.addEventListener("query-row:toggle", this.queryToggle)
    document.addEventListener("query-command:delete-completed", this.queryDeleteCompleted)
    document.addEventListener("query-command:move-completed", this.queryMoveCompleted)
    this.listStateChange = () => {
      this.queryCapabilities = getCoreCapabilities().queryCapabilities
      this.scheduleRender()
    }
    document.addEventListener("queries-state:changed", this.listStateChange)
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
    this.element.removeEventListener("query-row:toggle", this.queryToggle)
    document.removeEventListener("query-command:delete-completed", this.queryDeleteCompleted)
    document.removeEventListener("query-command:move-completed", this.queryMoveCompleted)
    document.removeEventListener("queries-state:changed", this.listStateChange)
    if (this.renderHandle) cancelAnimationFrame(this.renderHandle)
    this.sortable?.destroy()
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
    this.element.dataset.queriesListSortNameValue = field
    this.element.dataset.queriesListReverseValue = String(this.clientReverse)
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
    this.draggedQueryIds = [...this.listTarget.children].map(item =>
      item.querySelector("[data-query-row-query-id-value]")?.dataset.queryRowQueryIdValue
    )
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
    if (!queryId || !previousQueryId || !this.positionUrlValue) {
      this.clearDraggingState()
      return
    }

    const currentReverse = this.activeReverse()
    const reverse = newIndex < oldIndex ? !currentReverse : currentReverse
    const url = `${this.positionUrlValue}/${queryId}/position`

    try {
      const response = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ after: previousQueryId, reverse })
      })
      if (!response.ok) throw new Error(`Reorder failed (${response.status})`)

      const data = await response.json()
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
      const item = items.find(candidate =>
        candidate.querySelector("[data-query-row-query-id-value]")?.dataset.queryRowQueryIdValue === queryId
      )
      if (item) this.listTarget.appendChild(item)
    })
  }

  setupSortable() {
    if (!this.hasListTarget || !window.Sortable) return

    this.sortable = window.Sortable.create(this.listTarget, {
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

    this.listTarget.replaceChildren()

    visibleQueries.forEach((query, index) => {
      const row = document.createElement("li")
      const expanded = this.queryExpanded(query)
      row.className = expanded ? "unsortable" : ""
      row.dataset.queryId = String(query.queryId)
      this.renderQueryShell(row, query, start + index + 1, expanded)
      this.renderSearchResults(row, query)
      this.listTarget.appendChild(row)
    })

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

  renderQueryShell(row, query, rank, expanded = this.queryExpanded(query)) {
    const queryId = String(query.queryId)
    const numFound = Number(queryResultCount(query, this.currentShowOnlyRated ?? this.showOnlyRatedValue) || 0)
    const querqyTriggered = querqyRuleTriggered(query.parsedQueryDetails)
    const hasDiffs = Boolean(query.diffs)
    const toggled = Boolean(expanded)
    const sorting = Boolean(this.queryCapabilities?.isSortingEnabled?.())

    row.innerHTML = `
      <div
        data-controller="query-row"
        data-query-row-query-id-value="${queryId}"
        data-query-row-rank-value="${rank}"
        data-query-row-num-found-value="${numFound}"
        data-query-row-querqy-triggered-value="${querqyTriggered}"
        data-query-row-diff-value="${hasDiffs}"
        data-query-row-toggled-value="${toggled}"
        data-query-row-sorting-value="${sorting}">
        <div class="result-header" data-query-row-target="header">
          <div class="results-score qscore-query-badge" data-controller="qscore-query" data-qscore-query-query-id-value="${queryId}">
            <span class="scorable-score" data-qscore-query-target="value"></span>
          </div>
          <div data-query-row-target="diffScores"></div>
          <h2 class="results-title" data-action="click->query-row#toggle">
            <span class="query" data-controller="bs-tooltip" data-query-row-target="query" data-bs-tooltip-delay-value="1000" data-bs-tooltip-placement-value="right">
              <img class="img-thumbnail query-thumbnail d-none" data-query-row-target="image" alt="">
              <span data-query-row-target="text">&nbsp;</span>
            </span>
          </h2>
          <span class="float-end total-results">
            <span data-query-row-target="resultCount" data-controller="count-up" data-count-up-number-value="${numFound}"></span>
            <small class="text-muted" data-query-row-target="resultLabel"></small>
          </span>
          <i class="error-warning bi bi-exclamation-triangle-fill ms-2" role="img" aria-label="Query failed" title="Query failed"></i>
          <span class="float-end d-none" style="margin-right: 20px;" title="Hop to it!  There are unrated results!" data-controller="query-unrated-badge" data-query-unrated-badge-query-id-value="${queryId}">
            <div class="icon-container"><i class="frog-icon">🐸</i><div class="notification-bubble" data-query-unrated-badge-target="count"></div></div>
          </span>
          <span class="float-end d-none" style="margin-right: 20px;" title="Querqy Strikes Again!" data-query-row-target="querqy"><i class="querqy-icon"></i></span>
          <i class="toggleSign bi" data-query-row-target="toggle" data-action="click->query-row#toggle"></i>
        </div>
        <div data-query-row-target="expanded"></div>
      </div>
    `

    // User-controlled values are assigned as data attributes, never interpolated into markup.
    const rowElement = row.querySelector('[data-controller="query-row"]')
    rowElement.dataset.queryRowQueryTextValue = query.queryText || ""
    rowElement.dataset.queryRowInformationNeedValue = query.informationNeed || ""
    rowElement.dataset.queryRowStateValue = query.state || ""
    rowElement.querySelector('[data-query-row-target="query"]').dataset.bsTooltipTitleValue =
      `Info Need: ${query.informationNeed || ""}`
  }

  renderSearchResults(row, query) {
    const rowController = row.querySelector('[data-controller="query-row"]')
    const expanded = rowController.querySelector('[data-query-row-target="expanded"]')
    const searchResults = document.createElement("div")
    searchResults.innerHTML = searchResultsTemplate({
      caseId: query.caseNo,
      queryId: query.queryId,
      queryExplainData: JSON.stringify(queryExplainData(query)),
      queryOptionsData: JSON.stringify(query.options || {})
    })
    const searchResultsRoot = searchResults.firstElementChild
    expanded.appendChild(searchResultsRoot)

    this.bridgeQueryExplainTemplate(query.queryId, searchResultsRoot)

    const diffScores = rowController.querySelector('[data-query-row-target="diffScores"]')
    const diffSnapshot = this.documentStore?.query(query.queryId)?.diffs
    diffSnapshot?.searchers?.forEach((searcher, index) => {
      const badge = document.createElement("div")
      badge.className = "results-score diff-score"
      badge.dataset.controller = "diff-score"
      badge.dataset.diffScoreQueryIdValue = String(query.queryId)
      badge.dataset.diffScoreIndexValue = String(index)
      badge.innerHTML = '<span class="overall-rating"><span class="scorable-score" data-diff-score-target="value"></span></span>'
      diffScores.appendChild(badge)
    })
  }

  bridgeQueryExplainTemplate(queryId, searchResultsRoot) {
    const explain = searchResultsRoot.querySelector('[data-controller="query-explain"]')
    if (!explain) return

    explain.addEventListener("query-explain:before-open", event => {
      event.detail.data = queryExplainData(this.store?.query?.(queryId) || {})
    })

    explain.addEventListener("query-explain:render-template", event => {
      event.stopPropagation()
      const searcher = this.queryCapabilities?.getQuery?.(queryId)?.searcher
      if (!searcher || typeof searcher.isTemplateCall !== "function") return

      const isTemplatedQuery = searcher.isTemplateCall(searcher.args)
      const dispatchResult = detail => explain.dispatchEvent(new CustomEvent("query-explain:template-rendered", { detail }))

      searcher.renderTemplate().then(() => {
        dispatchResult({
          isTemplatedQuery,
          renderedQueryTemplate: JSON.stringify(searcher.renderedTemplateJson.template_output, null, 2)
        })
      }).catch(() => {
        dispatchResult({ isTemplatedQuery, error: true })
      })
    })
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
    // collection. The live-query runtime drops its temporary query object from
    // the same document event; the query list only updates its read models.
    this.store?.remove?.(queryId)
    this.documentStore?.removeQuery?.(queryId)
    this.scheduleRender()
  }

  // searchAll() failures were previously silent outside the add-query flow
  // (e.g. re-search after an import/judgements reload, or a settings change) —
  // the collection store now reports every generation-tracked failure here.
  handleSearchFailed(event) {
    const message = errorMessage(event.detail?.error, "Search failed. Some queries may not have updated.")
      coreFlash.show("error", message, "search-error")
  }

  handleSearchSettled() {
      coreFlash.hide("search-error")
  }

  handleQueryMoveCompleted(event) {
    const detail = event.detail || {}
    if (String(detail.caseId) !== String(this.store?.caseId) || detail.queryId == null) return

    this.store?.remove?.(detail.queryId)
    this.documentStore?.removeQuery?.(detail.queryId)
    this.scheduleRender()
  }

  renderPagination(pageCount, totalCount) {
    if (!this.hasPaginationTarget) return
    this.paginationTarget.replaceChildren()
    if (pageCount <= 1) return

    const nav = document.createElement("nav")
    nav.setAttribute("aria-label", "Query pages")
    nav.innerHTML = `
      <div class="d-flex align-items-center gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" data-page="previous">Previous</button>
        <span>Page ${this.currentPage} of ${pageCount} (${totalCount} queries)</span>
        <button type="button" class="btn btn-outline-secondary btn-sm" data-page="next">Next</button>
      </div>
    `
    nav.querySelector('[data-page="previous"]').disabled = this.currentPage === 1
    nav.querySelector('[data-page="next"]').disabled = this.currentPage === pageCount
    nav.addEventListener("click", event => {
      const page = event.target.closest("[data-page]")?.dataset.page
      if (!page) return
      this.currentPage += page === "next" ? 1 : -1
      this.render()
    })
    this.paginationTarget.appendChild(nav)
  }

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

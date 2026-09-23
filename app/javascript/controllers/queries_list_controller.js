import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { hideTooltipsWithin } from "utils/bs_tooltip"
import { matchesQueryFilter, queryResultCount, querqyRuleTriggered } from "utils/query_state"
import { queryCollectionStore } from "stores/query_collection_store"
import { searchResultsTemplate } from "controllers/search_results_template"

/**
 * Query-list collection rendering, toolbar, and drag lifecycle. Angular still
 * owns live search/scoring and a few expanded-query controls; Stimulus owns
 * the expanded-results shell, document rendering, and display state.
 */
export default class extends Controller {
  static targets = ["ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink", "sortIcon", "manualHelp", "list", "pagination", "count"]
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
    this.angularRows = []
    // The Angular and core Stimulus bundles currently compile separately, so
    // their module singletons are not shared. Use the temporary bridge while
    // Angular still owns the live query objects; the imported store remains a
    // useful fallback for isolated tests and the eventual single bundle.
    this.store = window.quepidStore?.queries || queryCollectionStore
    this.storeChange = () => this.scheduleRender()
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
    this.queryToggle = event => {
      this.forwardQueryToggle(event)
      this.scheduleRender()
    }
    this.element.addEventListener("query-row:toggle", this.queryToggle)
    this.setupSortable()
    this.render()
    this.attachToAngularScope()
  }

  disconnect() {
    this.store?.removeEventListener("change", this.storeChange)
    this.store?.removeEventListener("reset", this.storeChange)
    this.element.removeEventListener("query-row:toggle", this.queryToggle)
    if (this.angularRetryHandle) cancelAnimationFrame(this.angularRetryHandle)
    if (this.renderHandle) cancelAnimationFrame(this.renderHandle)
    this.destroyAngularRows()
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
    if (!this.showOnlyRatedUnsupportedValue) this.dispatch("toggle-rated")
  }

  collapseAll(event) {
    event.preventDefault()
    this.dispatch("collapse-all")
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
    this.currentPage = 1
    this.render()
    this.dispatch("sort", { detail: { field } })
  }

  filter(event) {
    this.filterValue = event.currentTarget.value
    this.currentPage = 1
    this.render()
    this.dispatch("filter", { detail: { value: event.currentTarget.value } })
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

    const reverse = newIndex < oldIndex ? !this.reverseValue : this.reverseValue
    const url = `${this.positionUrlValue}/${queryId}/position`

    try {
      const response = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ after: previousQueryId, reverse })
      })
      if (!response.ok) throw new Error(`Reorder failed (${response.status})`)

      const data = await response.json()
      this.dispatch("position-saved", {
        detail: { displayOrder: data.display_order }
      })
    } catch (error) {
      console.error("queries-list: reorder failed", error)
      this.restoreDraggedOrder()
      window.quepidDom?.flash?.show("error", "Unable to reorder queries.")
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
    if (this.sortable) this.sortable.option("disabled", !this.queryListSortableValue || this.sortNameValue !== "default")
  }

  render() {
    if (this.hasRatedCheckboxTarget) {
      this.ratedCheckboxTarget.checked = this.showOnlyRatedValue
      this.ratedCheckboxTarget.disabled = this.showOnlyRatedUnsupportedValue
    }
    if (this.hasRatedLabelTarget) {
      this.ratedLabelTarget.classList.toggle("text-muted", this.showOnlyRatedUnsupportedValue)
    }

    this.sortLinkTargets.forEach(link => {
      const active = link.dataset.sortField === this.sortNameValue
      link.classList.toggle("active", active)
      link.setAttribute("aria-pressed", String(active))
    })

    this.sortIconTargets.forEach(icon => {
      const active = icon.dataset.sortField === this.sortNameValue
      icon.classList.toggle("d-none", !active)
      icon.classList.toggle("bi-arrow-up", active && this.reverseValue)
      icon.classList.toggle("bi-arrow-down", active && !this.reverseValue)
    })

    if (this.hasManualHelpTarget) {
      this.manualHelpTarget.classList.toggle("d-none", this.queryListSortableValue)
    }
    if (this.hasManualSortLinkTarget) {
      this.manualSortLinkTarget.classList.toggle("d-none", !this.queryListSortableValue)
    }

    if (this.hasListTarget && this.angularScope && this.store?.status === "ready") {
      this.renderQueryCollection()
    }
  }

  attachToAngularScope() {
    const angularElement = window.angular?.element(this.element)
    this.angularScope = angularElement?.isolateScope?.() || angularElement?.scope?.()
    if (!this.angularScope) {
      this.angularRetryHandle = requestAnimationFrame(() => this.attachToAngularScope())
      return
    }
    this.render()
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

    this.destroyAngularRows()
    this.listTarget.replaceChildren()

    visibleQueries.forEach((query, index) => {
      const row = document.createElement("li")
      row.className = query.isToggled?.() ? "unsortable" : ""
      row.dataset.queryId = String(query.queryId)
      this.renderQueryShell(row, query, start + index + 1)
      this.renderAngularIslands(row, query)
      this.listTarget.appendChild(row)
    })

    if (this.hasCountTarget) this.countTarget.textContent = String(totalQueries.length)
    this.renderPagination(pageCount, queries.length)
  }

  orderedLiveQueries({ ignoreFilter = false } = {}) {
    const liveQueries = this.angularScope?.queriesSvc?.queries || {}
    const queries = this.store.orderedQueryIds()
      .map(queryId => liveQueries[queryId] || liveQueries[String(queryId)])
      .filter(Boolean)
      .filter(query => ignoreFilter || this.matchesFilter(query))

    const sortName = this.clientSortName || "default"
    if (sortName === "default") return queries

    return queries.sort((left, right) => {
      const leftValue = this.sortValue(left, sortName)
      const rightValue = this.sortValue(right, sortName)
      const comparison = this.compareValues(leftValue, rightValue)
      const direction = ["modified", "score", "error"].includes(sortName) ? -1 : 1
      if (comparison !== 0) return (this.clientReverse ? -direction : direction) * comparison
      if (sortName === "error") {
        const tie = Number(Boolean(left.allRated)) - Number(Boolean(right.allRated))
        return this.clientReverse ? -tie : tie
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

  sortValue(query, sortName) {
    if (sortName === "query") return query.queryText
    if (sortName === "modified") return query.modifiedAt || query.modified || ""
    if (sortName === "score") return query.lastScore ?? query.currentScore?.score ?? ""
    if (sortName === "error") return query.errorText || ""
    return ""
  }

  renderQueryShell(row, query, rank) {
    const queryId = String(query.queryId)
    const queryText = escapeAttribute(query.queryText || "")
    const informationNeed = escapeAttribute(query.informationNeed || "")
    const state = escapeAttribute(query.state?.() || "")
    const numFound = Number(queryResultCount(query, this.showOnlyRatedValue) || 0)
    const querqyTriggered = querqyRuleTriggered(query.searcher?.parsedQueryDetails)
    const hasDiffs = Boolean(query.diffs)
    const toggled = Boolean(query.isToggled?.())
    const sorting = Boolean(this.angularScope?.queries?.isSortingEnabled?.())

    row.innerHTML = `
      <div
        data-controller="query-row"
        data-query-row-query-id-value="${queryId}"
        data-query-row-rank-value="${rank}"
        data-query-row-query-text-value="${queryText}"
        data-query-row-information-need-value="${informationNeed}"
        data-query-row-num-found-value="${numFound}"
        data-query-row-querqy-triggered-value="${querqyTriggered}"
        data-query-row-state-value="${state}"
        data-query-row-diff-value="${hasDiffs}"
        data-query-row-toggled-value="${toggled}"
        data-query-row-sorting-value="${sorting}">
        <div class="result-header" data-query-row-target="header">
          <div class="results-score qscore-query-badge" data-controller="qscore-query" data-qscore-query-query-id-value="${queryId}">
            <span class="scorable-score" data-qscore-query-target="value"></span>
          </div>
          <div data-query-row-target="diffScores"></div>
          <h2 class="results-title" data-action="click->query-row#toggle">
            <span class="query" data-controller="bs-tooltip" data-query-row-target="query" data-bs-tooltip-title-value="Info Need: ${informationNeed}" data-bs-tooltip-delay-value="1000" data-bs-tooltip-placement-value="right">
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
  }

  renderAngularIslands(row, query) {
    const injector = window.angular?.element(document.body).injector?.()
    const compile = injector?.get?.("$compile")
    if (!compile || !this.angularScope) return

    const childScope = this.angularScope.$new()
    childScope.query = query
    childScope.queries = this.angularScope.queries

    const rowController = row.querySelector('[data-controller="query-row"]')
    const expanded = rowController.querySelector('[data-query-row-target="expanded"]')
    const searchResults = document.createElement("div")
    searchResults.innerHTML = searchResultsTemplate({ caseId: query.caseNo, queryId: query.queryId })
    const searchResultsRoot = searchResults.firstElementChild
    expanded.appendChild(searchResultsRoot)

    childScope.selectedTry = injector.get("settingsSvc").applicableSettings()
    childScope.queriesSvc = injector.get("queriesSvc")
    childScope.displayed = { resultsView: { finder: 1, results: 2, diffs: 3 }, results: 2 }
    childScope.query.isToggled = () => injector.get("queryViewSvc").isQueryToggled(query.queryId)
    childScope.query.toggle = () => {
      const toggleQuery = window.quepidSearch?.queryState?.toggleQuery
      return toggleQuery ? toggleQuery(query.queryId) : injector.get("queryViewSvc").toggleQuery(query.queryId)
    }
    childScope.query.getNumFound = () => {
      const resultCount = window.quepidSearch?.queryState?.queryResultCount
      if (resultCount) return resultCount(query, childScope.queriesSvc.showOnlyRated)
      return childScope.queriesSvc.showOnlyRated ? query.ratedDocsFound : query.numFound
    }
    searchResultsRoot.querySelectorAll("[data-angular-bridge]").forEach(bridge => compile(bridge)(childScope))

    const diffScores = rowController.querySelector('[data-query-row-target="diffScores"]')
    const diffTemplate = document.createElement("div")
    diffTemplate.innerHTML = `
      <qscore-query
        ng-if="query.diffs"
        ng-repeat="searcher in query.diffs.getSearchers() track by $index"
        class="results-score diff-score"
        max-score="maxScore || 100"
        scorable="searcher">
      </qscore-query>
    `
    const linkedDiffs = compile(diffTemplate)(childScope)
    Array.from(linkedDiffs).forEach(element => diffScores.appendChild(element))
    this.angularRows.push({ scope: childScope })
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

  destroyAngularRows() {
    this.angularRows?.forEach(({ scope }) => scope.$destroy())
    this.angularRows = []
  }
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
}

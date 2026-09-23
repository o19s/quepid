import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { hideTooltipsWithin } from "utils/bs_tooltip"
import { queryCollectionStore } from "stores/query_collection_store"

/**
 * Query-list collection rendering, toolbar, and drag lifecycle. Angular still
 * owns each expanded query's live search/results island and scoring; this
 * controller owns the collection order, filtering, pagination, and row hosts.
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
    // The Angular and core Stimulus bundles currently compile separately, so
    // their module singletons are not shared. Use the temporary bridge while
    // Angular still owns the live query objects; the imported store remains a
    // useful fallback for isolated tests and the eventual single bundle.
    this.store = window.quepidStore?.queries || queryCollectionStore
    this.storeChange = () => this.scheduleRender()
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
    this.queryToggle = () => this.scheduleRender()
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

    visibleQueries.forEach(query => {
      const row = document.createElement("li")
      row.className = query.isToggled?.() ? "unsortable" : ""
      row.dataset.queryId = String(query.queryId)
      this.renderAngularQuery(row, query)
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
    if (!this.filterValue) return true
    return String(query.queryText || "").toLowerCase().includes(this.filterValue.toLowerCase())
  }

  sortValue(query, sortName) {
    if (sortName === "query") return query.queryText
    if (sortName === "modified") return query.modifiedAt || query.modified || ""
    if (sortName === "score") return query.lastScore ?? query.currentScore?.score ?? ""
    if (sortName === "error") return query.errorText || ""
    return ""
  }

  renderAngularQuery(row, query) {
    const injector = window.angular?.element(document.body).injector?.()
    const compile = injector?.get?.("$compile")
    if (!compile || !this.angularScope) return

    const childScope = this.angularScope.$new()
    childScope.query = query
    childScope.queries = this.angularScope.queries
    const searchResults = document.createElement("search-results")
    searchResults.setAttribute("query", "query")
    searchResults.setAttribute("issortingenabled", "queries.isSortingEnabled")
    const linked = compile(searchResults)(childScope)
    Array.from(linked).forEach(element => row.appendChild(element))
    this.angularRows.push({ scope: childScope })
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

import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { computeCaseScore } from "modules/scorer_executor"

const MAX_CONCURRENT = 8
const PAGE_SIZE = 15

/** Align string/number IDs from CustomEvents with Stimulus `queryIdValue` (number). */
function normalizeQueryId(raw) {
  if (raw === null || raw === undefined) return undefined
  const n = typeof raw === "number" && !Number.isNaN(raw) ? raw : parseInt(String(raw), 10)
  return Number.isNaN(n) ? undefined : n
}

const SORT_URL_KEYS = new Set(["default", "query", "modified", "score", "error"])

/**
 * Parse `window.location.search` (or the same string in tests). Exported for unit tests
 * because jsdom does not always sync `location.search` after `history.replaceState`.
 */
export function parseQueryListSortFromSearch(search) {
  const raw = (search || "").replace(/^\?/, "")
  const params = new URLSearchParams(raw)
  let sort = params.get("sort") || "default"
  if (!SORT_URL_KEYS.has(sort)) sort = "default"
  return { sort, sortReverse: params.get("reverse") === "true" }
}

export default class extends Controller {
  static targets = [
    "list",
    "queryRow",
    "filterInput",
    "queryCount",
    "showOnlyRatedCheckbox",
    "sortLink",
    "paginationContainer",
  ]
  static outlets = ["query-row", "case-score"]
  static values = {
    sortable: { type: Boolean, default: false },
  }

  connect() {
    this.showOnlyRated = false
    this.currentFilter = ""
    this.currentPage = 1
    this.queryScores = {} // { queryId: { text, score, maxScore, numFound } }
    this.sortReverse = false
    this.currentSortName = "default"
    this._autoSearchPending = true

    // Store original DOM indices so "default" sort can restore server-rendered order
    this.queryRowTargets.forEach((row, idx) => {
      row.dataset.originalIndex = idx
    })

    this._applyInitialSortFromUrl()
    this._initSortable()

    this._onQueryMovedAway = (e) => this.handleQueryDeleted(e)
    document.addEventListener("query-moved-away", this._onQueryMovedAway)

    this._onQueryOptionsSaved = (e) => {
      const queryId = normalizeQueryId(e.detail?.queryId)
      if (queryId === undefined) return
      const outlet = this.queryRowOutlets.find((o) => o.queryIdValue === queryId)
      if (outlet) void outlet.rerunSearch()
    }
    document.addEventListener("query-options-saved", this._onQueryOptionsSaved)

    this._onQueriesAdded = () => this._handleQueriesAdded()
    document.addEventListener("queries-added", this._onQueriesAdded)
  }

  disconnect() {
    if (this.sortableInstance) {
      this.sortableInstance.destroy()
      this.sortableInstance = null
    }
    if (this._onQueryMovedAway) {
      document.removeEventListener("query-moved-away", this._onQueryMovedAway)
    }
    if (this._onQueryOptionsSaved) {
      document.removeEventListener("query-options-saved", this._onQueryOptionsSaved)
    }
    if (this._onQueriesAdded) {
      document.removeEventListener("queries-added", this._onQueriesAdded)
    }
  }

  /**
   * Stimulus lifecycle: called each time a query-row outlet connects.
   * On initial load, fires once per row — we batch via a microtask so we
   * run a single auto-search pass after all outlets are wired.
   * After in-place add, fires for each new row as Stimulus observes it.
   */
  queryRowOutletConnected(outlet) {
    if (this._autoSearchPending) {
      // Batch: schedule one auto-search after all initial outlets connect
      if (!this._autoSearchScheduled) {
        this._autoSearchScheduled = true
        queueMicrotask(() => {
          this._autoSearchScheduled = false
          this._autoSearchPending = false
          this._autoRunVisibleSearches()
        })
      }
    } else if (!outlet.searchLoaded && !outlet.element.classList.contains("d-none")) {
      // A new row was added after initial load — search it immediately
      outlet.rerunSearch()
    }
  }

  // Handles query-row:queryDeleted events bubbled up from query-row controllers
  handleQueryDeleted(event) {
    const queryId = normalizeQueryId(event.detail?.queryId)
    if (queryId === undefined) return
    delete this.queryScores[queryId]
    this._updateCaseScore()
    this._applyVisibility()
  }

  // Handles query-row:scoreChanged events bubbled up from query-row controllers
  handleScoreChanged(event) {
    const { queryText, score, maxScore, numFound } = event.detail
    const queryId = normalizeQueryId(event.detail?.queryId)
    if (queryId === undefined) return

    this.queryScores[queryId] = {
      text: queryText,
      score: typeof score === "number" ? score : null,
      maxScore: maxScore,
      numFound: numFound,
    }

    this._updateCaseScore()
  }

  filter() {
    this.currentFilter = this.filterInputTarget.value.toLowerCase()
    this.currentPage = 1
    this._applyVisibility()
  }

  /** Link next to checkbox (Angular parity: both toggle the same filter). */
  toggleShowOnlyRated(event) {
    event.preventDefault()
    this.showOnlyRatedCheckboxTarget.checked = !this.showOnlyRatedCheckboxTarget.checked
    this._syncShowOnlyRatedFromCheckbox()
  }

  /** Checkbox uses `change` so native toggling works; avoids `click` + preventDefault fighting the control. */
  showOnlyRatedChanged() {
    this._syncShowOnlyRatedFromCheckbox()
  }

  _syncShowOnlyRatedFromCheckbox() {
    this.showOnlyRated = this.showOnlyRatedCheckboxTarget.checked
    this.currentPage = 1
    this._applyVisibility()
  }

  goToPage(event) {
    event.preventDefault()
    const page = parseInt(event.currentTarget.dataset.page, 10)
    if (!Number.isFinite(page) || page < 1) return
    // _applyVisibility clamps the page, so just set and let it handle bounds
    this.currentPage = page
    this._applyVisibility()
  }

  nextPage(event) {
    event.preventDefault()
    this.currentPage++
    this._applyVisibility()
  }

  previousPage(event) {
    event.preventDefault()
    if (this.currentPage > 1) {
      this.currentPage--
      this._applyVisibility()
    }
  }

  collapseAll(event) {
    event.preventDefault()
    this.queryRowOutlets.forEach((outlet) => {
      if (outlet.expanded) {
        outlet.collapse()
      }
    })
  }

  async runAllSearches(event) {
    event.preventDefault()
    // Run searches for all rows that match current filters (across all pages),
    // not just the visible page. This matches Angular's "Run All" behavior.
    const matchingOutlets = this.queryRowOutlets.filter((outlet) => {
      const row = outlet.element
      const text = (row.dataset.queryText || "").toLowerCase()
      const rated = row.dataset.rated === "true"
      const matchesFilter = !this.currentFilter || text.includes(this.currentFilter)
      const matchesRated = !this.showOnlyRated || rated
      return matchesFilter && matchesRated
    })

    // Run in batches of MAX_CONCURRENT — allSettled so one failure doesn't block the rest
    for (let i = 0; i < matchingOutlets.length; i += MAX_CONCURRENT) {
      const batch = matchingOutlets.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(batch.map((outlet) => outlet.rerunSearch()))
    }
  }

  sortBy(event) {
    event.preventDefault()
    const sortKey = event.currentTarget.dataset.sort
    if (!sortKey) return

    const prevName = this.currentSortName
    if (sortKey === prevName) {
      this.sortReverse = !this.sortReverse
    } else {
      this.sortReverse = false
    }

    // Update active state on sort links
    this.sortLinkTargets.forEach((link) => link.classList.remove("active"))
    event.currentTarget.classList.add("active")

    this.currentSortName = sortKey
    this.currentPage = 1
    this._sortRows(sortKey)
    this._applyVisibility()
    this._updateSortableState()
    this._syncSortToUrl()
  }

  // Private

  /** Match Angular QueriesCtrl: honor ?sort= / ?reverse= on load without writing defaults back. */
  _applyInitialSortFromUrl() {
    const { sort, sortReverse } = parseQueryListSortFromSearch(window.location.search)

    this.sortReverse = sortReverse
    this.currentSortName = sort

    this._setActiveSortLink(sort)
    this._sortRows(sort)
    this._applyVisibility()
  }

  _setActiveSortLink(sortKey) {
    this.sortLinkTargets.forEach((link) => {
      link.classList.toggle("active", link.dataset.sort === sortKey)
    })
  }

  /** Updates `?sort=` / `?reverse=` only when the normalized query string would change (fewer history writes). */
  _syncSortToUrl() {
    const url = new URL(window.location.href)
    const next = new URL(url.href)
    next.searchParams.set("sort", this.currentSortName)
    if (this.sortReverse) next.searchParams.set("reverse", "true")
    else next.searchParams.delete("reverse")
    if (next.search === url.search) return
    window.history.replaceState({}, "", next)
  }

  _updateCaseScore() {
    const { score, allRated } = computeCaseScore(this.queryScores)

    if (this.hasCaseScoreOutlet) {
      this.caseScoreOutlet.updateScore({
        score,
        allRated,
        queryScores: this.queryScores,
      })
    }
  }

  _applyVisibility() {
    // First pass: determine which rows match filters
    const matchingRows = []

    this.queryRowTargets.forEach((row) => {
      const text = (row.dataset.queryText || "").toLowerCase()
      const rated = row.dataset.rated === "true"

      const matchesFilter = !this.currentFilter || text.includes(this.currentFilter)
      const matchesRated = !this.showOnlyRated || rated

      if (matchesFilter && matchesRated) {
        matchingRows.push(row)
      }
    })

    // Clamp current page
    const totalPages = Math.max(1, Math.ceil(matchingRows.length / PAGE_SIZE))
    if (this.currentPage > totalPages) this.currentPage = totalPages

    // Second pass: show only rows on the current page
    const startIdx = (this.currentPage - 1) * PAGE_SIZE
    const endIdx = startIdx + PAGE_SIZE

    this.queryRowTargets.forEach((row) => row.classList.add("d-none"))
    matchingRows.forEach((row, idx) => {
      if (idx >= startIdx && idx < endIdx) {
        row.classList.remove("d-none")
      }
    })

    this.queryCountTarget.textContent = matchingRows.length
    this._renderPagination(matchingRows.length)

    // Auto-search any newly visible rows that haven't been searched yet
    if (!this._autoSearchPending) {
      this._autoRunVisibleSearches()
    }
  }

  _renderPagination(totalItems) {
    if (!this.hasPaginationContainerTarget) return

    const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
    const container = this.paginationContainerTarget

    if (totalPages <= 1) {
      container.innerHTML = ""
      return
    }

    const prevDisabled = this.currentPage <= 1 ? "disabled" : ""
    const nextDisabled = this.currentPage >= totalPages ? "disabled" : ""

    let pages = ""
    for (let i = 1; i <= totalPages; i++) {
      const active = i === this.currentPage ? "active" : ""
      pages += `<li class="page-item ${active}">
        <a class="page-link" href="#" data-action="click->query-list#goToPage" data-page="${i}">${i}</a>
      </li>`
    }

    container.innerHTML = `
      <nav aria-label="Query list pagination">
        <ul class="pagination pagination-sm justify-content-center">
          <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" data-action="click->query-list#previousPage">&laquo;</a>
          </li>
          ${pages}
          <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" data-action="click->query-list#nextPage">&raquo;</a>
          </li>
        </ul>
      </nav>`
  }

  _sortRows(sortKey) {
    const rows = [...this.queryRowTargets]
    const inv = this.sortReverse ? -1 : 1

    rows.sort((a, b) => {
      if (sortKey === "score") {
        const sa = this._queryScore(a)
        const sb = this._queryScore(b)
        // Nulls stay at the bottom regardless of reverse (Angular keeps unscored at end)
        if (sa === null && sb === null) return 0
        if (sa === null) return 1
        if (sb === null) return -1
        return inv * (sb - sa)
      }

      let cmp
      switch (sortKey) {
        case "query":
          cmp = (a.dataset.queryText || "").localeCompare(b.dataset.queryText || "")
          break
        case "modified":
          cmp = (b.dataset.modifiedAt || "").localeCompare(a.dataset.modifiedAt || "")
          break
        case "error": {
          const ea = this._hasError(a) ? 0 : 1
          const eb = this._hasError(b) ? 0 : 1
          cmp = ea - eb
          break
        }
        default:
          cmp = parseInt(a.dataset.originalIndex, 10) - parseInt(b.dataset.originalIndex, 10)
      }
      return inv * cmp
    })

    // Re-append in sorted order (JS sort is stable; default sort uses originalIndex)
    const list = this.listTarget
    rows.forEach((row) => list.appendChild(row))
  }

  async _initSortable() {
    if (!this.sortableValue) return

    try {
      const { default: Sortable } = await import("sortablejs")
      this.sortableInstance = new Sortable(this.listTarget, {
        animation: 150,
        handle: ".drag-handle",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        disabled: true, // enabled only when sort mode is "default"
        onEnd: (evt) => this._handleDragEnd(evt),
      })
      this._updateSortableState()
    } catch (e) {
      console.warn("SortableJS not available:", e)
    }
  }

  _updateSortableState() {
    if (!this.sortableInstance) return
    const isManualSort = !this.currentSortName || this.currentSortName === "default"
    this.sortableInstance.option("disabled", !isManualSort)

    // Show/hide drag handles via CSS class
    this.listTarget.querySelectorAll(".drag-handle").forEach((handle) => {
      handle.classList.toggle("drag-handle-hidden", !isManualSort)
    })
  }

  async _handleDragEnd(evt) {
    if (evt.oldIndex === evt.newIndex) return

    const listEl = this.listTarget
    const revertDrag = () => {
      const item = evt.item
      const { oldIndex } = evt
      listEl.removeChild(item)
      const ref = listEl.children[oldIndex] ?? null
      listEl.insertBefore(item, ref)
    }

    const movedRow = this.queryRowTargets[evt.newIndex]
    const queryId = movedRow.dataset.queryId
    const caseId = document.body.dataset.caseId

    // When moved to the top, use "reverse: true" with the item now below it.
    // move_to(afterId) places the query after afterId; move_to(id, reverse=true)
    // places it before that id. Passing afterId=0 with reverse=false would cause
    // find_by(id: 0) → nil → NoMethodError on the server.
    let body
    if (evt.newIndex === 0) {
      const nextRow = this.queryRowTargets[1]
      body = { after: nextRow ? nextRow.dataset.queryId : 0, reverse: true }
    } else {
      const previousRow = this.queryRowTargets[evt.newIndex - 1]
      body = { after: previousRow.dataset.queryId }
    }

    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/queries/${queryId}/position`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        console.error("Failed to save query position:", response.status)
        revertDrag()
        return
      }

      this.queryRowTargets.forEach((row, idx) => {
        row.dataset.originalIndex = idx
      })
    } catch (error) {
      console.error("Failed to save query position:", error)
      revertDrag()
    }
  }

  /** Handle newly added queries: clear filter, jump to last page, re-apply visibility.
   *  Auto-search is triggered by queryRowOutletConnected when Stimulus wires the new rows. */
  _handleQueriesAdded() {
    // Clear any active filter so the new queries are visible
    this.currentFilter = ""
    if (this.hasFilterInputTarget) this.filterInputTarget.value = ""
    this.showOnlyRated = false
    if (this.hasShowOnlyRatedCheckboxTarget) this.showOnlyRatedCheckboxTarget.checked = false

    const totalRows = this.queryRowTargets.length
    this.currentPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE))
    this._applyVisibility()
  }

  /** Run searches for query rows visible on the current page (Angular parity: search on load). */
  async _autoRunVisibleSearches() {
    const visibleOutlets = this.queryRowOutlets.filter(
      (outlet) => !outlet.element.classList.contains("d-none") && !outlet.searchLoaded,
    )

    for (let i = 0; i < visibleOutlets.length; i += MAX_CONCURRENT) {
      const batch = visibleOutlets.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(batch.map((outlet) => outlet.rerunSearch()))
    }
  }

  _queryScore(row) {
    const qId = row.dataset.queryId
    const qs = this.queryScores[qId]
    return qs && typeof qs.score === "number" ? qs.score : null
  }

  _hasError(row) {
    const qId = row.dataset.queryId
    const qs = this.queryScores[qId]
    // A query has an "error" if it was scored but produced a non-numeric result
    return qs !== undefined && typeof qs.score !== "number"
  }
}

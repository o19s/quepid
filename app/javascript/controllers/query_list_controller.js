import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { computeCaseScore } from "modules/scorer_executor"

const MAX_CONCURRENT = 8
const PAGE_SIZE = 15

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

    // Store original DOM indices so "default" sort can restore server-rendered order
    this.queryRowTargets.forEach((row, idx) => {
      row.dataset.originalIndex = idx
    })

    this._applyVisibility()
    this._initSortable()
  }

  disconnect() {
    if (this.sortableInstance) {
      this.sortableInstance.destroy()
      this.sortableInstance = null
    }
  }

  // Handles query-row:queryDeleted events bubbled up from query-row controllers
  handleQueryDeleted(event) {
    const { queryId } = event.detail
    delete this.queryScores[queryId]
    this._updateCaseScore()
    this._applyVisibility()
  }

  // Handles query-row:scoreChanged events bubbled up from query-row controllers
  handleScoreChanged(event) {
    const { queryId, queryText, score, maxScore, numFound } = event.detail

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

  toggleShowOnlyRated(event) {
    event.preventDefault()
    this.showOnlyRated = !this.showOnlyRated
    this.showOnlyRatedCheckboxTarget.checked = this.showOnlyRated
    this.currentPage = 1
    this._applyVisibility()
  }

  goToPage(event) {
    event.preventDefault()
    const page = parseInt(event.currentTarget.dataset.page, 10)
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

    // Update active state on sort links
    this.sortLinkTargets.forEach((link) => link.classList.remove("active"))
    event.currentTarget.classList.add("active")

    this.currentSort = sortKey
    this.currentPage = 1
    this._sortRows(sortKey)
    this._applyVisibility()
    this._updateSortableState()
  }

  // Private

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

    rows.sort((a, b) => {
      switch (sortKey) {
        case "query":
          return (a.dataset.queryText || "").localeCompare(b.dataset.queryText || "")
        case "score": {
          const sa = this._queryScore(a)
          const sb = this._queryScore(b)
          // Nulls sort to the bottom
          if (sa === null && sb === null) return 0
          if (sa === null) return 1
          if (sb === null) return -1
          return sb - sa
        }
        case "modified":
          return (b.dataset.modifiedAt || "").localeCompare(a.dataset.modifiedAt || "")
        case "error": {
          // Rows with errors (null score after search ran) sort to the top
          const ea = this._hasError(a) ? 0 : 1
          const eb = this._hasError(b) ? 0 : 1
          return ea - eb
        }
        case "default":
        default:
          // Restore original server-rendered order using stored indices
          return parseInt(a.dataset.originalIndex, 10) - parseInt(b.dataset.originalIndex, 10)
      }
    })

    // Re-append in sorted order (stable for "default" since sort returns 0)
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
    const isManualSort = !this.currentSort || this.currentSort === "default"
    this.sortableInstance.option("disabled", !isManualSort)

    // Show/hide drag handles via CSS class
    this.listTarget.querySelectorAll(".drag-handle").forEach((handle) => {
      handle.classList.toggle("drag-handle-hidden", !isManualSort)
    })
  }

  async _handleDragEnd(evt) {
    if (evt.oldIndex === evt.newIndex) return

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
      }

      // Update original indices to reflect new order
      this.queryRowTargets.forEach((row, idx) => {
        row.dataset.originalIndex = idx
      })
    } catch (error) {
      console.error("Failed to save query position:", error)
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

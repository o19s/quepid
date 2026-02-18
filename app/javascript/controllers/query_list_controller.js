import { Controller } from "@hotwired/stimulus"
import Sortable from "sortablejs"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

// Query list container for the case/try workspace. Selection is via link (?query_id=).
// When sortable is enabled, initializes SortableJS for drag-and-drop reorder and
// persists order via PUT api/cases/:caseId/queries/:queryId/position.
// Also provides client-side filter (text + rated-only), sort, and visible/total count.
// Listens for "query-score:refresh" events to update individual query scores via
// the lightweight scoring endpoint (no full re-evaluation needed).
export default class extends Controller {
  static values = { sortable: Boolean }

  static targets = ["list", "filterInput", "ratedToggle", "sortSelect", "count"]

  connect() {
    if (this.sortableValue && this.hasListTarget) {
      this._initSortable()
    }
    this._snapshotOriginalOrder()
    this._updateCount()
    this._restoreSortFromUrl()

    // Listen for lightweight per-query score refresh events
    this._boundHandleScoreRefresh = this._handleScoreRefresh.bind(this)
    document.addEventListener("query-score:refresh", this._boundHandleScoreRefresh)

    // Watch for Turbo Stream additions/removals so _originalOrder stays fresh
    if (this.hasListTarget) {
      this._observer = new MutationObserver(() => {
        if (this._pauseObserver) return
        this._snapshotOriginalOrder()
        this._updateCount()
      })
      this._observer.observe(this.listTarget, { childList: true })
    }
  }

  disconnect() {
    document.removeEventListener("query-score:refresh", this._boundHandleScoreRefresh)
    if (this._observer) {
      this._observer.disconnect()
      this._observer = null
    }
    if (this._sortable) {
      this._sortable.destroy()
      this._sortable = null
    }
  }

  async _handleScoreRefresh(event) {
    const { queryId, caseId } = event.detail || {}
    if (!queryId || !caseId) return

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", caseId, "queries", queryId, "score")
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" }
      })
      if (!res.ok) return

      const data = await res.json()
      if (data.score == null) return

      this._updateQueryScoreBadge(queryId, data.score, data.max_score)
    } catch (err) {
      console.warn("Lightweight score refresh failed:", err)
    }
  }

  _updateQueryScoreBadge(queryId, score, maxScore) {
    if (!this.hasListTarget) return
    const row = this.listTarget.querySelector(`[data-query-id="${queryId}"]`)
    if (!row) return

    // Update data attribute for sorting
    row.dataset.queryScore = String(score)

    // Find and update the score badge (dispatches qscore:update for color)
    const scoreBadge = row.querySelector("[data-controller~='qscore']")
    if (scoreBadge) {
      const scoreText = scoreBadge.querySelector(".qscore-value, .badge")
      if (scoreText) scoreText.textContent = score

      // Dispatch qscore:update for color recalculation
      document.dispatchEvent(new CustomEvent("qscore:update", {
        detail: { queryId, caseId: this.caseId, score, maxScore }
      }))
    }
  }

  expandAll() {
    this._toggleAllQueryExpand(true)
  }

  collapseAll() {
    this._toggleAllQueryExpand(false)
  }

  _toggleAllQueryExpand(expand) {
    if (!this.hasListTarget) return
    const rows = this.listTarget.querySelectorAll("[data-controller~='query-expand']")
    rows.forEach(row => {
      const app = this.application
      const controller = app.getControllerForElementAndIdentifier(row, "query-expand")
      if (!controller) return
      const resultsTarget = row.querySelector("[data-query-expand-target='inlineResults']")
      if (!resultsTarget) return
      const isExpanded = !resultsTarget.classList.contains("d-none")
      if (expand && !isExpanded) {
        controller.toggle()
      } else if (!expand && isExpanded) {
        controller.toggle()
      }
    })
  }

  _snapshotOriginalOrder() {
    if (this.hasListTarget) {
      this._originalOrder = Array.from(this.listTarget.querySelectorAll("[data-query-id]"))
    }
  }

  filter() {
    if (!this.hasListTarget) return

    const text = this.hasFilterInputTarget ? this.filterInputTarget.value.toLowerCase().trim() : ""
    const ratedOnly = this.hasRatedToggleTarget ? this.ratedToggleTarget.checked : false

    const items = this.listTarget.querySelectorAll("[data-query-id]")
    items.forEach((li) => {
      const queryText = li.dataset.queryText || ""
      const queryScore = li.dataset.queryScore || ""

      const matchesText = !text || queryText.includes(text)
      const matchesRated = !ratedOnly || (queryScore !== "" && queryScore !== "?")

      li.style.display = (matchesText && matchesRated) ? "" : "none"
    })

    this._updateCount()
  }

  sort() {
    if (!this.hasListTarget || !this.hasSortSelectTarget) return

    const sortBy = this.sortSelectTarget.value
    const list = this.listTarget
    const items = Array.from(list.querySelectorAll("[data-query-id]"))

    // Pause observer during reorder to avoid overwriting _originalOrder
    this._pauseObserver = true
    try {
      if (sortBy === "default" && this._originalOrder) {
        // Restore original order
        this._originalOrder.forEach((li) => {
          if (li.parentNode === list) list.appendChild(li)
        })
      } else if (sortBy === "name" || sortBy === "name_desc") {
        const dir = sortBy === "name_desc" ? -1 : 1
        items.sort((a, b) => dir * (a.dataset.queryText || "").localeCompare(b.dataset.queryText || ""))
        items.forEach((li) => list.appendChild(li))
      } else if (sortBy === "score_asc" || sortBy === "score_desc") {
        items.sort((a, b) => {
          const sa = this._parseScore(a.dataset.queryScore)
          const sb = this._parseScore(b.dataset.queryScore)
          return sortBy === "score_asc" ? sa - sb : sb - sa
        })
        items.forEach((li) => list.appendChild(li))
      }
    } finally {
      this._pauseObserver = false
    }

    // Persist sort choice in URL
    this._persistSortToUrl(sortBy)
  }

  _persistSortToUrl(sortBy) {
    const url = new URL(window.location.href)
    if (sortBy && sortBy !== "default") {
      url.searchParams.set("sort", sortBy)
    } else {
      url.searchParams.delete("sort")
    }
    window.history.replaceState({}, "", url.toString())
  }

  _restoreSortFromUrl() {
    const url = new URL(window.location.href)
    const sort = url.searchParams.get("sort")
    if (sort && this.hasSortSelectTarget) {
      const option = this.sortSelectTarget.querySelector(`option[value="${sort}"]`)
      if (option) {
        this.sortSelectTarget.value = sort
        this.sort()
      }
    }
  }

  _parseScore(val) {
    if (val === "" || val === "?" || val == null) return -Infinity
    const n = parseFloat(val)
    return isNaN(n) ? -Infinity : n
  }

  _updateCount() {
    if (!this.hasCountTarget || !this.hasListTarget) return

    const all = this.listTarget.querySelectorAll("[data-query-id]")
    const visible = Array.from(all).filter((li) => li.style.display !== "none")
    const total = all.length

    if (visible.length === total) {
      this.countTarget.textContent = total
    } else {
      this.countTarget.textContent = `${visible.length} / ${total}`
    }
  }

  _initSortable() {
    const list = this.listTarget
    this._sortable = Sortable.create(list, {
      animation: 150,
      handle: ".query-drag-handle",
      ghostClass: "opacity-50",
      onEnd: (evt) => this._onSortEnd(evt)
    })
  }

  async _onSortEnd(evt) {
    const { item, oldIndex, newIndex } = evt
    if (oldIndex === newIndex) return

    const caseId = this.caseId
    if (!caseId) return

    const queryId = parseInt(item.dataset.queryId, 10)
    if (!queryId) return

    const list = this.listTarget
    const items = Array.from(list.querySelectorAll("[data-query-id]"))
    const movedIndex = items.findIndex((el) => parseInt(el.dataset.queryId, 10) === queryId)

    // move_to(afterId, reverse): reverse=true = prepend before that node; reverse=false = place after that node
    let afterId, reverse
    if (movedIndex === 0) {
      // Moved to top: prepend before the current first
      reverse = true
      afterId = items[1] ? parseInt(items[1].dataset.queryId, 10) : null
    } else {
      // Moved down: place after the previous item
      reverse = false
      afterId = parseInt(items[movedIndex - 1].dataset.queryId, 10)
    }
    if (afterId == null) return

    const root = getQuepidRootUrl()
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const url = buildApiUrl(root, "cases", caseId, "queries", queryId, "position")

    this._sortable?.option("disabled", true)
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          "X-CSRF-Token": token || "",
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ after: afterId, reverse })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      if (window.flash) window.flash.success = "Query order updated."
    } catch (err) {
      console.error("Update query position failed:", err)
      if (window.flash) window.flash.error = "Could not update query order. " + (err.message || "")
      // Revert by reloading
      window.location.reload()
    } finally {
      this._sortable?.option("disabled", false)
    }
  }

  get caseId() {
    const workspace = document.querySelector("[data-workspace-case-id-value]")
    return workspace?.dataset?.workspaceCaseIdValue || ""
  }
}

import { Controller } from "@hotwired/stimulus"
import { computeCaseScore } from "modules/scorer_executor"

const MAX_CONCURRENT = 8

export default class extends Controller {
  static targets = ["list", "queryRow", "filterInput", "queryCount",
                     "showOnlyRatedCheckbox", "sortLink"]
  static outlets = ["query-row", "case-score"]

  connect() {
    this.showOnlyRated = false
    this.currentFilter = ""
    this.queryScores = {} // { queryId: { text, score, maxScore, numFound } }
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
    this._applyVisibility()
  }

  toggleShowOnlyRated(event) {
    event.preventDefault()
    this.showOnlyRated = !this.showOnlyRated
    this.showOnlyRatedCheckboxTarget.checked = this.showOnlyRated
    this._applyVisibility()
  }

  collapseAll(event) {
    event.preventDefault()
    this.queryRowOutlets.forEach(outlet => {
      if (outlet.expanded) {
        outlet.collapse()
      }
    })
  }

  async runAllSearches(event) {
    event.preventDefault()
    // Only run searches for visible rows
    const visibleOutlets = this.queryRowOutlets.filter(outlet =>
      outlet.element.style.display !== "none"
    )

    // Run in batches of MAX_CONCURRENT — allSettled so one failure doesn't block the rest
    for (let i = 0; i < visibleOutlets.length; i += MAX_CONCURRENT) {
      const batch = visibleOutlets.slice(i, i + MAX_CONCURRENT)
      await Promise.allSettled(batch.map(outlet => outlet.rerunSearch()))
    }
  }

  sortBy(event) {
    event.preventDefault()
    const sortKey = event.currentTarget.dataset.sort

    // Update active state on sort links
    this.sortLinkTargets.forEach(link => link.classList.remove("active"))
    event.currentTarget.classList.add("active")

    this._sortRows(sortKey)
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
    let visibleCount = 0

    this.queryRowTargets.forEach(row => {
      const text = (row.dataset.queryText || "").toLowerCase()
      const rated = row.dataset.rated === "true"

      const matchesFilter = !this.currentFilter || text.includes(this.currentFilter)
      const matchesRated = !this.showOnlyRated || rated

      const visible = matchesFilter && matchesRated
      row.style.display = visible ? "" : "none"
      if (visible) visibleCount++
    })

    this.queryCountTarget.textContent = visibleCount
  }

  _sortRows(sortKey) {
    const rows = [...this.queryRowTargets]

    rows.sort((a, b) => {
      switch (sortKey) {
        case "query":
          return (a.dataset.queryText || "").localeCompare(b.dataset.queryText || "")
        case "default":
        default:
          // Default order is the server-rendered order (DOM order)
          return 0
      }
    })

    // Re-append in sorted order (stable for "default" since sort returns 0)
    const list = this.listTarget
    rows.forEach(row => list.appendChild(row))
  }
}

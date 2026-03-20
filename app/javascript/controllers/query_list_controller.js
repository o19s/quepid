import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["list", "queryRow", "filterInput", "queryCount",
                     "showOnlyRatedCheckbox", "sortLink"]

  connect() {
    this.showOnlyRated = false
    this.currentFilter = ""
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
    // Find all query-row controllers and collapse them
    this.queryRowTargets.forEach(row => {
      const controller = this.application.getControllerForElementAndIdentifier(row, "query-row")
      if (controller && controller.expanded) {
        controller.toggle()
      }
    })
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

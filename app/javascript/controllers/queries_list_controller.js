import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { hideTooltipsWithin } from "utils/bs_tooltip"

/**
 * Query-list toolbar and drag lifecycle. Angular still owns query rows,
 * pagination, and search/scoring; this controller owns reorder persistence
 * during the incremental migration.
 */
export default class extends Controller {
  static targets = ["ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink", "sortIcon", "manualHelp", "list"]
  static values = {
    showOnlyRated: Boolean,
    showOnlyRatedUnsupported: Boolean,
    sortName: String,
    reverse: Boolean,
    queryListSortable: Boolean,
    positionUrl: String
  }

  connect() {
    this.setupSortable()
    this.render()
  }

  disconnect() {
    this.sortable?.destroy()
  }

  showOnlyRatedValueChanged() {
    this.render()
  }

  showOnlyRatedUnsupportedValueChanged() {
    this.render()
  }

  sortNameValueChanged() {
    this.updateSortableState()
    this.render()
  }

  reverseValueChanged() {
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
    this.dispatch("sort", { detail: { field } })
  }

  filter(event) {
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
  }
}

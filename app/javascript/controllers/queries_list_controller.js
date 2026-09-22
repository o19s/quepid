import { Controller } from "@hotwired/stimulus"
import { hideTooltipsWithin } from "utils/bs_tooltip"

/**
 * Query-list toolbar and drag lifecycle. Angular still owns query rows,
 * pagination, and mutations; this controller bridges actions back to
 * QueriesCtrl with semantic CustomEvents during the incremental migration.
 */
export default class extends Controller {
  static targets = ["ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink", "sortIcon", "manualHelp", "list"]
  static values = {
    showOnlyRated: Boolean,
    showOnlyRatedUnsupported: Boolean,
    sortName: String,
    reverse: Boolean,
    queryListSortable: Boolean
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
    this.dispatch("drag-start")
  }

  dragEnd(event) {
    hideTooltipsWithin(this.listTarget)
    this.dispatch("drag-end", { detail: { oldIndex: event.oldIndex, newIndex: event.newIndex } })
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

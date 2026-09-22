import { describe, expect, it, vi } from "vitest"
import QueriesListController from "controllers/queries_list_controller"

function controllerFor(values = {}) {
  const element = document.createElement("div")
  element.innerHTML = `
    <input data-queries-list-target="ratedCheckbox">
    <a data-queries-list-target="ratedLabel"></a>
    <input data-queries-list-target="filter">
    <a data-queries-list-target="sortLink" data-sort-field="default"></a>
    <a data-queries-list-target="manualSortLink" data-sort-field="default"></a>
    <a data-queries-list-target="sortLink" data-sort-field="score"></a>
    <i data-queries-list-target="sortIcon" data-sort-field="default"></i>
    <i data-queries-list-target="sortIcon" data-sort-field="score"></i>
    <i data-queries-list-target="manualHelp"></i>
    <ul data-queries-list-target="list"></ul>
  `
  const controller = new QueriesListController(element)
  controller.element = element
  const state = {
    showOnlyRatedValue: false,
    showOnlyRatedUnsupportedValue: false,
    sortNameValue: "default",
    reverseValue: false,
    queryListSortableValue: true,
    ...values
  }
  Object.keys(state).forEach(key => {
    Object.defineProperty(controller, key, { configurable: true, value: state[key] })
  })
  controller.dispatch = (name, options = {}) => {
    element.dispatchEvent(new CustomEvent(`queries-list:${name}`, { bubbles: true, detail: options.detail }))
  }
  controller.ratedCheckboxTarget = element.querySelector('[data-queries-list-target="ratedCheckbox"]')
  controller.hasRatedCheckboxTarget = true
  controller.ratedLabelTarget = element.querySelector('[data-queries-list-target="ratedLabel"]')
  controller.hasRatedLabelTarget = true
  controller.filterTarget = element.querySelector('[data-queries-list-target="filter"]')
  controller.hasFilterTarget = true
  controller.sortLinkTargets = [...element.querySelectorAll('[data-queries-list-target="sortLink"]')]
  controller.manualSortLinkTarget = element.querySelector('[data-queries-list-target="manualSortLink"]')
  controller.hasManualSortLinkTarget = true
  controller.sortIconTargets = [...element.querySelectorAll('[data-queries-list-target="sortIcon"]')]
  controller.manualHelpTarget = element.querySelector('[data-queries-list-target="manualHelp"]')
  controller.hasManualHelpTarget = true
  controller.listTarget = element.querySelector('[data-queries-list-target="list"]')
  controller.hasListTarget = true
  controller.render()
  return { controller, element }
}

describe("queries_list_controller", () => {
  it("renders rated state and the active sort direction", () => {
    const { element } = controllerFor({ showOnlyRatedValue: true, sortNameValue: "score", reverseValue: true })

    expect(element.querySelector('[data-queries-list-target="ratedCheckbox"]').checked).toBe(true)
    expect(element.querySelector('[data-sort-field="score"]').classList.contains("active")).toBe(true)
    expect(element.querySelector('[data-queries-list-target="sortIcon"][data-sort-field="score"]').classList.contains("bi-arrow-up")).toBe(true)
    expect(element.querySelector('[data-queries-list-target="sortIcon"][data-sort-field="default"]').classList.contains("d-none")).toBe(true)
  })

  it("disables rated filtering and manual sorting when unsupported", () => {
    const { element } = controllerFor({ showOnlyRatedUnsupportedValue: true, queryListSortableValue: false })

    expect(element.querySelector('[data-queries-list-target="ratedCheckbox"]').disabled).toBe(true)
    expect(element.querySelector('[data-queries-list-target="ratedLabel"]').classList.contains("text-muted")).toBe(true)
    expect(element.querySelector('[data-queries-list-target="manualHelp"]').classList.contains("d-none")).toBe(false)
    expect(element.querySelector('[data-queries-list-target="manualSortLink"]').classList.contains("d-none")).toBe(true)
  })

  it("bridges toolbar actions as bubbling semantic events", () => {
    const { controller } = controllerFor()
    const events = []
    controller.element.addEventListener("queries-list:sort", event => events.push(event.detail.field))
    controller.element.addEventListener("queries-list:collapse-all", () => events.push("collapse"))
    controller.element.addEventListener("queries-list:filter", event => events.push(event.detail.value))

    controller.sort({ preventDefault() {}, currentTarget: { dataset: { sortField: "score" } } })
    controller.collapseAll({ preventDefault() {} })
    controller.filter({ currentTarget: { value: "star" } })

    expect(events).toEqual(["score", "collapse", "star"])
  })

  it("updates Sortable when the sort changes", () => {
    const { controller } = controllerFor()
    controller.sortable = { option: vi.fn() }
    Object.defineProperty(controller, "sortNameValue", { configurable: true, value: "score" })
    controller.sortNameValueChanged()

    expect(controller.sortable.option).toHaveBeenCalledWith("disabled", true)
  })

  it("bridges drag lifecycle events with Sortable indexes", () => {
    const { controller } = controllerFor()
    const events = []
    controller.element.addEventListener("queries-list:drag-start", () => events.push("start"))
    controller.element.addEventListener("queries-list:drag-end", event => events.push([event.detail.oldIndex, event.detail.newIndex]))

    controller.dragStart()
    controller.dragEnd({ oldIndex: 1, newIndex: 3 })

    expect(events).toEqual(["start", [1, 3]])
  })
})

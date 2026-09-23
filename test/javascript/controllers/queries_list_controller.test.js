import { describe, expect, it, vi } from "vitest"
import QueriesListController from "controllers/queries_list_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

import { apiFetch } from "api/fetch"

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
    positionUrlValue: "api/cases/4/queries",
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

  it("bridges drag start while reorder persistence owns drag end", () => {
    const { controller } = controllerFor()
    const events = []
    controller.element.addEventListener("queries-list:drag-start", () => events.push("start"))
    controller.element.addEventListener("queries-list:drag-end", event => events.push([event.detail.oldIndex, event.detail.newIndex]))

    controller.dragStart()
    controller.dragEnd({ oldIndex: 1, newIndex: 3 })

    expect(events).toEqual(["start"])
    expect(controller.listTarget.classList.contains("dragging")).toBe(false)
  })

  it("persists a drag using the visible query order and updates Angular through an event", async () => {
    const { controller, element } = controllerFor()
    controller.listTarget.innerHTML = `
      <li><div data-query-row-query-id-value="11"></div></li>
      <li><div data-query-row-query-id-value="12"></div></li>
    `
    apiFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ display_order: [12, 11] }) })
    const saved = vi.fn()
    element.addEventListener("queries-list:position-saved", event => saved(event.detail))

    controller.dragStart()
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/11/position", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ after: "12", reverse: false })
    }))
    expect(saved).toHaveBeenCalledWith({ displayOrder: [12, 11] })
    expect(controller.listTarget.classList.contains("dragging")).toBe(false)
  })

  it("uses indexes local to the visible page", async () => {
    const { controller } = controllerFor()
    controller.listTarget.innerHTML = `
      <li><div data-query-row-query-id-value="31"></div></li>
      <li><div data-query-row-query-id-value="32"></div></li>
    `
    apiFetch.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ display_order: [32, 31] }) })

    controller.dragStart()
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/31/position", expect.objectContaining({
      body: JSON.stringify({ after: "32", reverse: false })
    }))
  })

  it("restores the original DOM order when reorder persistence fails", async () => {
    const { controller, element } = controllerFor()
    controller.listTarget.innerHTML = `
      <li><div data-query-row-query-id-value="11"></div></li>
      <li><div data-query-row-query-id-value="12"></div></li>
    `
    apiFetch.mockResolvedValue({ ok: false, status: 500 })
    window.quepidDom = { flash: { show: vi.fn() } }

    controller.dragStart()
    controller.listTarget.append(controller.listTarget.firstElementChild)
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect([...controller.listTarget.children].map(item => item.querySelector("[data-query-row-query-id-value]").dataset.queryRowQueryIdValue)).toEqual(["11", "12"])
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("error", "Unable to reorder queries.")
    delete window.quepidDom
  })
})

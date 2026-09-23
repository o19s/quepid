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

  it("orders live queries from the collection store and filters by query text", () => {
    const { controller } = controllerFor()
    controller.store = { orderedQueryIds: () => [2, 1] }
    controller.angularScope = {
      queriesSvc: {
        queries: {
          1: { queryId: 1, queryText: "Star Wars" },
          2: { queryId: 2, queryText: "Dune" }
        }
      }
    }
    controller.filterValue = "star"

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([1])
  })

  it("preserves manual order and renders pagination controls", () => {
    const { controller } = controllerFor()
    controller.store = { orderedQueryIds: () => [3, 2, 1] }
    controller.angularScope = {
      queriesSvc: {
        queries: {
          1: { queryId: 1, queryText: "one" },
          2: { queryId: 2, queryText: "two" },
          3: { queryId: 3, queryText: "three" }
        }
      }
    }
    controller.currentPage = 2
    controller.paginationTarget = document.createElement("div")
    controller.hasPaginationTarget = true

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([3, 2, 1])
    controller.renderPagination(3, 5)
    expect(controller.paginationTarget.textContent).toContain("Page 2 of 3 (5 queries)")
    expect(controller.paginationTarget.querySelector('[data-page="previous"]').disabled).toBe(false)
    expect(controller.paginationTarget.querySelector('[data-page="next"]').disabled).toBe(false)
  })

  it("sorts scores numerically and reverses the selected sort", () => {
    const { controller } = controllerFor()
    controller.store = { orderedQueryIds: () => [1, 2] }
    controller.angularScope = {
      queriesSvc: {
        queries: {
          1: { queryId: 1, queryText: "one", lastScore: 2 },
          2: { queryId: 2, queryText: "two", lastScore: 10 }
        }
      }
    }
    controller.clientSortName = "score"
    controller.clientReverse = false

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([2, 1])

    controller.clientReverse = true
    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([1, 2])
  })

  it("uses all-rated status as the Errors sort tie-breaker", () => {
    const { controller } = controllerFor()
    controller.store = { orderedQueryIds: () => [1, 2] }
    controller.angularScope = {
      queriesSvc: {
        queries: {
          1: { queryId: 1, errorText: "same error", allRated: true },
          2: { queryId: 2, errorText: "same error", allRated: false }
        }
      }
    }
    controller.clientSortName = "error"
    controller.clientReverse = false

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([2, 1])
  })

  it("renders the query shell without an Angular search-results host", () => {
    const { controller } = controllerFor()
    const row = document.createElement("li")
    const query = {
      queryId: 7,
      queryText: "Star & Wars",
      informationNeed: 'Movies "with space"',
      state: () => "ready",
      isToggled: () => false,
      diffs: null
    }

    controller.renderQueryShell(row, query, 2)

    expect(row.querySelector('[data-controller="query-row"]')).not.toBeNull()
    expect(row.querySelector('[data-query-row-target="text"]').textContent).toBe("\u00a0")
    expect(row.querySelector('[data-query-row-target="expanded"]').childElementCount).toBe(0)
    expect(row.querySelector('[data-query-row-target="query"]').dataset.bsTooltipTitleValue).toBe('Info Need: Movies "with space"')
  })

  it("uses the collection store expanded state when rebuilding a query shell", () => {
    const { controller } = controllerFor()
    controller.store = { query: () => ({ expanded: true }) }
    const row = document.createElement("li")
    const query = {
      queryId: 7,
      queryText: "Star Wars",
      informationNeed: "Movies",
      state: () => "ready",
      diffs: null
    }

    controller.renderQueryShell(row, query, 2)

    expect(row.querySelector('[data-query-row-toggled-value="true"]')).not.toBeNull()
    expect(controller.queryExpanded(query)).toBe(true)
  })

  it("forwards row toggles to the Stimulus expanded-results island", () => {
    const { controller } = controllerFor()
    const row = document.createElement("li")
    row.innerHTML = `
      <div data-query-row-query-id-value="7">
        <div data-query-row-target="expanded"><div data-controller="search-results"></div></div>
      </div>
    `
    const expandedIsland = row.querySelector('[data-controller="search-results"]')
    const toggle = vi.fn()
    expandedIsland.addEventListener("query-row:toggle", event => toggle(event.detail))

    controller.forwardQueryToggle({
      target: row.querySelector('[data-query-row-query-id-value="7"]'),
      detail: { queryId: 7 }
    })

    expect(toggle).toHaveBeenCalledWith({ queryId: 7 })
  })

  it("removes a query after the delete controller reports success", () => {
    const { controller } = controllerFor()
    const removeQueryFromState = vi.fn()
    controller.angularScope = { queriesSvc: { removeQueryFromState } }
    controller.scheduleRender = vi.fn()

    controller.handleQueryDeleteCompleted({ detail: { queryId: 7 } })

    expect(removeQueryFromState).toHaveBeenCalledWith(7)
    expect(controller.scheduleRender).toHaveBeenCalled()
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

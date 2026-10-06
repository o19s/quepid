import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { describe, expect, it, vi, beforeEach } from "vitest"
import QueriesListController from "controllers/queries_list_controller"
import { QueryCollectionStore } from "stores/query_collection_store"
import { QueryDocumentsStore } from "stores/query_documents_store"
import { SearchError } from "utils/search_error"
import { loadViewTemplate } from "../support/view_template"
import { apiFetch } from "api/fetch"

let testStores

vi.mock("utils/core_store_access", () => ({ getCoreStores: () => testStores || {} }))

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

// A new row as renderQueryCollection builds it: the shell, then its values.
function renderRow(controller, row, query, rank, expanded = controller.queryExpanded(query)) {
  controller.renderQueryShell(row, query)
  controller.updateQueryRow(row, query, rank, expanded)
}

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
    ${loadViewTemplate("app/views/core/_query_list_templates.html.erb")}
  `
  const state = {
    showOnlyRatedValue: false,
    showOnlyRatedUnsupportedValue: false,
    sortNameValue: "default",
    reverseValue: false,
    queryListSortableValue: true,
    positionUrlTemplateValue: "api/cases/4/queries/__QUERY_ID__/position",
    queryUrlTemplateValue: "api/cases/4/queries/__QUERY_ID__",
    notesUrlTemplateValue: "api/cases/4/queries/__QUERY_ID__/notes",
    ...values
  }
  const targetNames = [
    "ratedCheckbox", "ratedLabel", "filter", "sortLink", "manualSortLink",
    "sortIcon", "manualHelp", "list", "rowTemplate", "searchResultsTemplate",
    "paginationTemplate", "diffScoreTemplate"
  ]
  const controller = buildControllerFixture(QueriesListController, {
    element,
    targets: Object.fromEntries(targetNames.map(name => [
      name, [...element.querySelectorAll(`[data-queries-list-target="${name}"]`)]
    ])),
    values: Object.fromEntries(Object.entries(state).map(([key, value]) => [key.replace(/Value$/, ""), value])),
    overrides: {
      dispatch: (name, options = {}) => {
        element.dispatchEvent(new CustomEvent(`queries-list:${name}`, { bubbles: true, detail: options.detail }))
      }
    }
  })
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
    expect(element.querySelector('[data-queries-list-target="ratedLabel"]').title).toBe("Not supported for this search engine yet")
    expect(element.querySelector('[data-queries-list-target="manualHelp"]').classList.contains("d-none")).toBe(false)
    expect(element.querySelector('[data-queries-list-target="manualSortLink"]').classList.contains("d-none")).toBe(true)
  })

  it("removes the rated-filter tooltip when the control is supported", () => {
    const { element } = controllerFor()

    expect(element.querySelector('[data-queries-list-target="ratedLabel"]').title).toBe("")
  })

  it("owns toolbar actions without an event bridge", () => {
    const { controller } = controllerFor()
    const collapseAll = vi.fn()
    controller.store = { requestCollapseAll: collapseAll }
    const sortStateChanged = vi.fn()
    controller.element.addEventListener("queries-list:sort-state-changed", event => sortStateChanged(event.detail))

    controller.sort({ preventDefault() {}, currentTarget: { dataset: { sortField: "score" } } })
    controller.collapseAll({ preventDefault() {} })
    controller.filter({ currentTarget: { value: "star" } })

    expect(controller.clientSortName).toBe("score")
    expect(controller.sortNameValue).toBe("score")
    expect(controller.reverseValue).toBe(false)
    expect(controller.filterValue).toBe("star")
    expect(collapseAll).toHaveBeenCalled()
    expect(sortStateChanged).toHaveBeenCalledWith({ sort: "score", reverse: "false" })
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
    controller.store = {
      orderedQueryIds: () => [2, 1],
      query: queryId => ({
        1: { queryId: 1, queryText: "Star Wars" },
        2: { queryId: 2, queryText: "Dune" }
      })[queryId]
    }
    controller.filterValue = "star"

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([1])
  })

  it("preserves manual order and renders pagination controls", () => {
    const { controller } = controllerFor()
    controller.store = {
      orderedQueryIds: () => [3, 2, 1],
      query: queryId => ({
        1: { queryId: 1, queryText: "one" },
        2: { queryId: 2, queryText: "two" },
        3: { queryId: 3, queryText: "three" }
      })[queryId]
    }
    controller.currentPage = 2
    controller.paginationTarget = document.createElement("div")
    controller.hasPaginationTarget = true

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([3, 2, 1])
    controller.renderPagination(3, 5)
    expect(controller.paginationTarget.textContent).toContain("Page 2 of 3 (5 queries)")
    expect(controller.paginationTarget.querySelector('[data-slot="previous"]').disabled).toBe(false)
    expect(controller.paginationTarget.querySelector('[data-slot="next"]').disabled).toBe(false)
  })

  describe("keyed row reconciliation", () => {
    function renderable(controller) {
      controller.pageSize = 15
      controller.currentPage = 1
      return controller
    }

    function liveStore(queries) {
      return {
        status: "ready",
        caseId: 4,
        orderedQueryIds: () => queries.map(query => query.queryId),
        query: queryId => queries.find(query => query.queryId === queryId)
      }
    }
    const rows = controller => [...controller.listTarget.children]

    it("reuses each query's row across renders and updates its values in place", () => {
      const controller = renderable(controllerFor().controller)
      const queries = [{ queryId: 1, queryText: "one", numFound: 3 }, { queryId: 2, queryText: "two" }]
      controller.store = liveStore(queries)
      controller.renderQueryCollection()
      const [first, second] = rows(controller)
      const notes = first.querySelector('[data-query-notes-target="notes"]')
      notes.value = "half-typed note"

      queries[0].numFound = 9
      queries[0].informationNeed = "fresh need"
      controller.renderQueryCollection()

      expect(rows(controller)).toEqual([first, second])
      expect(first.querySelector('[data-query-notes-target="notes"]')).toBe(notes)
      expect(notes.value).toBe("half-typed note")
      const shell = first.querySelector('[data-slot="row"]')
      expect(shell.dataset.queryRowNumFoundValue).toBe("9")
      expect(shell.dataset.queryRowInformationNeedValue).toBe("fresh need")
      expect(first.querySelector('[data-slot="resultCount"]').dataset.countUpNumberValue).toBe("9")
    })

    it("follows the store's order and drops rows for queries that left the page", () => {
      const controller = renderable(controllerFor().controller)
      const queries = [{ queryId: 1, queryText: "one" }, { queryId: 2, queryText: "two" }, { queryId: 3, queryText: "three" }]
      controller.store = liveStore(queries)
      controller.renderQueryCollection()
      const [one, , three] = rows(controller)

      controller.store = liveStore([queries[2], queries[0]])
      controller.renderQueryCollection()

      expect(rows(controller)).toEqual([three, one])
      expect(three.querySelector('[data-slot="row"]').dataset.queryRowRankValue).toBe("1")
      expect(one.querySelector('[data-slot="row"]').dataset.queryRowRankValue).toBe("2")
    })

    it("adds a diff-score badge per diff searcher, from the template", () => {
      const controller = renderable(controllerFor().controller)
      controller.store = liveStore([{ queryId: 5, queryText: "five" }])
      controller.documentStore = { query: () => ({ diffs: { searchers: [{}, {}] } }) }

      controller.renderQueryCollection()

      const badges = controller.listTarget.querySelectorAll('[data-slot="diffScores"] [data-controller="diff-score"]')
      expect([...badges].map(badge => badge.dataset.diffScoreIndexValue)).toEqual(["0", "1"])
      expect(badges[0].dataset.diffScoreQueryIdValue).toBe("5")
    })
  })

  it("sorts scores numerically and reverses the selected sort", () => {
    const { controller } = controllerFor()
    controller.store = {
      orderedQueryIds: () => [1, 2],
      query: queryId => ({
        1: { queryId: 1, queryText: "one", lastScore: 2 },
        2: { queryId: 2, queryText: "two", lastScore: 10 }
      })[queryId]
    }
    controller.clientSortName = "score"
    controller.clientReverse = false

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([2, 1])

    controller.clientReverse = true
    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([1, 2])
  })

  it("uses all-rated status as the Errors sort tie-breaker", () => {
    const { controller } = controllerFor()
    controller.store = {
      orderedQueryIds: () => [1, 2],
      query: queryId => ({
        1: { queryId: 1, errorText: "same error", allRated: true },
        2: { queryId: 2, errorText: "same error", allRated: false }
      })[queryId]
    }
    controller.clientSortName = "error"
    controller.clientReverse = false

    expect(controller.orderedLiveQueries().map(query => query.queryId)).toEqual([2, 1])
  })

  it("renders the query shell with its expanded-results host", () => {
    const { controller } = controllerFor()
    const row = document.createElement("li")
    const query = {
      queryId: 7,
      queryText: "Star & Wars",
      informationNeed: 'Movies "with space"',
      state: "ready",
      isToggled: () => false,
      diffs: null
    }

    renderRow(controller, row, query, 2)

    expect(row.querySelector('[data-controller="query-row"]')).not.toBeNull()
    expect(row.querySelector('[data-query-row-target="text"]').textContent).toBe("\u00a0")
    expect(row.querySelector('[data-query-row-target="expanded"] > [data-controller="search-results"]')).not.toBeNull()
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
      state: "ready",
      diffs: null
    }

    renderRow(controller, row, query, 2)

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

  it("renders expanded query controls without a compilation island", () => {
    const { controller } = controllerFor()
    const row = document.createElement("li")
    row.appendChild(controller.buildSearchResults({ queryId: 7, caseNo: 4, options: {} }))

    expect(row.querySelector('[data-controller="search-results"]')).not.toBeNull()
    expect(row.querySelector('[data-bs-target="#queryOptionsModal"]')).not.toBeNull()
    expect(row.querySelector('[data-controller="missing-documents"]')).not.toBeNull()
  })

  it("renders query headers entirely from the collection read model", () => {
    const { controller } = controllerFor()
    controller.store = {
      query: () => ({
        queryId: 7,
        queryText: "Star Wars",
        informationNeed: "Movies",
        state: "ready",
        numFound: 12,
        parsedQueryDetails: { querqy: { rewrite: "expanded" } },
        options: {}
      })
    }
    const row = document.createElement("li")

    renderRow(controller, row, controller.store.query(7), 1)

    expect(row.querySelector('[data-query-row-state-value="ready"]')).not.toBeNull()
    expect(row.querySelector('[data-query-row-num-found-value="12"]')).not.toBeNull()
    expect(row.querySelector('[data-query-row-querqy-triggered-value="true"]')).not.toBeNull()
  })

  it("removes a query from the stores after the delete controller reports success", () => {
    const { controller } = controllerFor()
    const remove = vi.fn()
    const removeQuery = vi.fn()
    controller.store = { remove }
    controller.documentStore = { removeQuery }
    controller.scheduleRender = vi.fn()

    controller.handleQueryDeleteCompleted({ detail: { queryId: 7 } })

    expect(remove).toHaveBeenCalledWith(7)
    expect(removeQuery).toHaveBeenCalledWith(7)
    expect(controller.scheduleRender).toHaveBeenCalled()
  })

  it("accepts the document-level query-delete completion event", () => {
    const { controller } = controllerFor()
    const store = new QueryCollectionStore()
    const remove = vi.spyOn(store, "remove")
    const documentStore = new QueryDocumentsStore()
    const removeQuery = vi.spyOn(documentStore, "removeQuery")
    testStores = { queries: store, documents: documentStore }
    controller.scheduleRender = vi.fn()
    controller.connect()

    controller.handleQueryDeleteCompleted(new CustomEvent("query-delete:completed", {
      detail: { queryId: 7 }
    }))

    expect(remove).toHaveBeenCalledWith(7)
    expect(removeQuery).toHaveBeenCalledWith(7)
    controller.disconnect()
    testStores = undefined
  })

  it("serves query-explain the store's latest explain data", () => {
    const { controller } = controllerFor()
    controller.store = { query: vi.fn(id => (id === 3 ? { queryDetails: { q: "x" }, parsedQueryDetails: { b: 1, a: 2 } } : undefined)) }

    const data = controller.explainData(3)

    expect(controller.store.query).toHaveBeenCalledWith(3)
    expect(data.queryDetails).toBe(JSON.stringify({ q: "x" }, null, 2))
    expect(data.parsedQueryDetails).toBe(JSON.stringify({ a: 2, b: 1 }, null, 2))
    expect(controller.explainData(99)).toMatchObject({ queryDetailsMessage: "No results yet." })
  })

  it("renders a templated query through the live searcher", async () => {
    const { controller } = controllerFor()
    const searcher = {
      args: { id: "tmpl" },
      isTemplateCall: vi.fn(() => true),
      renderTemplate: vi.fn(async () => { searcher.renderedTemplateJson = { template_output: { query: 1 } } })
    }
    controller.queryCapabilities = { getQuery: vi.fn(() => ({ searcher })) }

    await expect(controller.renderQueryTemplate(3)).resolves.toEqual({
      isTemplatedQuery: true,
      renderedQueryTemplate: JSON.stringify({ query: 1 }, null, 2)
    })
    expect(controller.queryCapabilities.getQuery).toHaveBeenCalledWith(3)
    expect(searcher.isTemplateCall).toHaveBeenCalledWith({ id: "tmpl" })
  })

  it("does not ask the engine to render a non-templated query", async () => {
    const { controller } = controllerFor()
    const searcher = { isTemplateCall: () => false, renderTemplate: vi.fn() }
    controller.queryCapabilities = { getQuery: () => ({ searcher }) }

    await expect(controller.renderQueryTemplate(3)).resolves.toEqual({ isTemplatedQuery: false })
    expect(searcher.renderTemplate).not.toHaveBeenCalled()
  })

  it("rejects template rendering when there is no live searcher or the engine fails", async () => {
    const { controller } = controllerFor()
    controller.queryCapabilities = { getQuery: () => undefined }
    await expect(controller.renderQueryTemplate(3)).rejects.toThrow("No live searcher for query 3")

    const searcher = { isTemplateCall: () => true, renderTemplate: vi.fn().mockRejectedValue(new Error("400")) }
    controller.queryCapabilities = { getQuery: () => ({ searcher }) }
    await expect(controller.renderQueryTemplate(3)).rejects.toThrow("400")
  })

  it("subscribes to the live collection store and flashes a sticky search-error on search-failed", () => {
    const { controller } = controllerFor()
    const store = new QueryCollectionStore()
    testStores = { queries: store }
    Object.assign(coreFlash, { show: vi.fn(), hide: vi.fn() })

    controller.connect()
    const generation = store.beginSearch()
    store.failSearch(new Error("Solr is unreachable"), generation)

    expect(coreFlash.show).toHaveBeenCalledWith("error", "Solr is unreachable", "search-error")

    controller.disconnect()
    testStores = undefined

  })

  it("clears the sticky search-error flash once the store reports a new search starting", () => {
    const { controller } = controllerFor()
    const store = new QueryCollectionStore()
    testStores = { queries: store }
    Object.assign(coreFlash, { show: vi.fn(), hide: vi.fn() })

    controller.connect()
    store.beginSearch()

    expect(coreFlash.hide).toHaveBeenCalledWith("search-error")

    controller.disconnect()
    testStores = undefined

  })

  it("stops reacting to the collection store's search events after disconnect", () => {
    const { controller } = controllerFor()
    const store = new QueryCollectionStore()
    testStores = { queries: store }
    Object.assign(coreFlash, { show: vi.fn(), hide: vi.fn() })

    controller.connect()
    controller.disconnect()
    const generation = store.beginSearch()
    store.failSearch(new Error("too late"), generation)

    expect(coreFlash.show).not.toHaveBeenCalled()

    testStores = undefined

  })

  it("passes a translated search error through intact so the flash can render its links", () => {
    const { controller } = controllerFor()
    Object.assign(coreFlash, { show: vi.fn(), hide: vi.fn() })
    const error = new SearchError([{ text: "see " }, { text: "wiki", href: "https://example.com" }])

    controller.handleSearchFailed({ detail: { error } })

    expect(coreFlash.show).toHaveBeenCalledWith("error", error, "search-error")

  })

  it("falls back to a generic message when the search error has no message", () => {
    const { controller } = controllerFor()
    Object.assign(coreFlash, { show: vi.fn(), hide: vi.fn() })

    controller.handleSearchFailed({ detail: { error: {} } })

    expect(coreFlash.show).toHaveBeenCalledWith(
      "error",
      "Search failed. Some queries may not have updated.",
      "search-error"
    )

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

  it("persists a drag using the visible query order and updates the query store directly", async () => {
    const { controller } = controllerFor()
    controller.listTarget.innerHTML = `
      <li data-query-id="11"></li>
      <li data-query-id="12"></li>
    `
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: vi.fn(async () => null).mockResolvedValue({ display_order: [12, 11] }) })
    const setDisplayOrder = vi.fn()
    controller.queryCapabilities = { setDisplayOrder }

    controller.dragStart()
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/11/position", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ after: "12", reverse: false })
    }))
    expect(setDisplayOrder).toHaveBeenCalledWith([12, 11])
    expect(controller.listTarget.classList.contains("dragging")).toBe(false)
  })

  it("uses the active URL-synchronized reverse state when reordering", async () => {
    const { controller } = controllerFor({ reverseValue: true })
    controller.clientReverse = false
    controller.listTarget.innerHTML = `
      <li data-query-id="11"></li>
      <li data-query-id="12"></li>
    `
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: vi.fn(async () => null).mockResolvedValue({ display_order: [12, 11] }) })

    controller.dragStart()
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/11/position", expect.objectContaining({
      body: JSON.stringify({ after: "12", reverse: false })
    }))
  })

  it("uses indexes local to the visible page", async () => {
    const { controller } = controllerFor()
    controller.listTarget.innerHTML = `
      <li data-query-id="31"></li>
      <li data-query-id="32"></li>
    `
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: vi.fn(async () => null).mockResolvedValue({ display_order: [32, 31] }) })

    controller.dragStart()
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect(apiFetch).toHaveBeenCalledWith("api/cases/4/queries/31/position", expect.objectContaining({
      body: JSON.stringify({ after: "32", reverse: false })
    }))
  })

  it("restores the original DOM order when reorder persistence fails", async () => {
    const { controller, element } = controllerFor()
    controller.listTarget.innerHTML = `
      <li data-query-id="11"></li>
      <li data-query-id="12"></li>
    `
    apiFetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })
    Object.assign(coreFlash, { show: vi.fn() })

    controller.dragStart()
    controller.listTarget.append(controller.listTarget.firstElementChild)
    await controller.dragEnd({ oldIndex: 0, newIndex: 1 })

    expect([...controller.listTarget.children].map(item => item.dataset.queryId)).toEqual(["11", "12"])
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to reorder queries.")

  })

  it("renders hostile query text, info need, and state as inert data attributes", () => {
    const { controller } = controllerFor()
    const evil = '"><img src=x onerror=alert(1)>'
    const row = document.createElement("li")
    renderRow(controller, row, { queryId: 9, queryText: evil, informationNeed: evil, state: evil }, 1)

    expect(row.querySelector("[onerror]")).toBeNull()
    const el = row.querySelector('[data-controller="query-row"]')
    expect(el.dataset.queryRowQueryTextValue).toBe(evil)
    expect(el.dataset.queryRowInformationNeedValue).toBe(evil)
    expect(el.dataset.queryRowStateValue).toBe(evil)
    expect(row.querySelector('[data-query-row-target="query"]').dataset.bsTooltipTitleValue).toBe(`Info Need: ${evil}`)
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QueryCommandBridgeController from "controllers/query_command_bridge_controller"

function store() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    collapseAll: vi.fn()
  }
}

describe("query_command_bridge_controller", () => {
  let controller
  let collectionStore
  let documentsStore

  beforeEach(() => {
    vi.spyOn(document, "addEventListener")
    vi.spyOn(document, "removeEventListener")
    collectionStore = store()
    documentsStore = store()
    controller = new QueryCommandBridgeController()
    controller.element = document.createElement("body")
    window.quepidStore = { queries: collectionStore, documents: documentsStore }
    window.quepidSearch = {
      queryCapabilities: {
        reconcileQueryRemoval: vi.fn(),
        getCaseNo: vi.fn(() => 7)
      },
      queryCommands: {
        rateDocument: vi.fn(),
        rateAll: vi.fn(),
        toggleQuery: vi.fn(),
        paginateQuery: vi.fn(),
        toggleShowOnlyRated: vi.fn(),
        collapseAll: vi.fn()
      }
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("subscribes and removes the store command listeners", () => {
    controller.connect()

    expect(documentsStore.addEventListener).toHaveBeenCalledWith("command", controller.handleDocumentCommand)
    expect(collectionStore.addEventListener).toHaveBeenCalledWith("command", controller.handleCollectionCommand)

    controller.disconnect()

    expect(documentsStore.removeEventListener).toHaveBeenCalledWith("command", controller.handleDocumentCommand)
    expect(collectionStore.removeEventListener).toHaveBeenCalledWith("command", controller.handleCollectionCommand)
    expect(document.removeEventListener).toHaveBeenCalledWith("query-command:delete-completed", controller.handleQueryDeleteCompleted)
    expect(document.removeEventListener).toHaveBeenCalledWith("query-command:move-completed", controller.handleQueryMoveCompleted)
  })

  it("routes document commands through the explicit query command runtime", () => {
    controller.connect()

    controller.routeDocumentCommand({ command: "rate-document", queryId: 4, docId: "doc-1", rating: 2 })
    controller.routeDocumentCommand({ command: "rate-all", queryId: 4, rating: 3 })
    controller.routeDocumentCommand({ command: "toggle-query", queryId: 4 })
    controller.routeDocumentCommand({ command: "paginate-query", queryId: 4, ratedOnly: true })

    expect(window.quepidSearch.queryCommands.rateDocument).toHaveBeenCalledWith(4, "doc-1", 2)
    expect(window.quepidSearch.queryCommands.rateAll).toHaveBeenCalledWith(4, 3)
    expect(window.quepidSearch.queryCommands.toggleQuery).toHaveBeenCalledWith(4)
    expect(window.quepidSearch.queryCommands.paginateQuery).toHaveBeenCalledWith(4, true)
  })

  it("routes collection commands and keeps both stores in sync on collapse", () => {
    controller.connect()

    controller.routeCollectionCommand({ command: "toggle-show-only-rated" })
    controller.routeCollectionCommand({ command: "collapse-all" })

    expect(window.quepidSearch.queryCommands.toggleShowOnlyRated).toHaveBeenCalledOnce()
    expect(window.quepidSearch.queryCommands.collapseAll).toHaveBeenCalledOnce()
    expect(collectionStore.collapseAll).toHaveBeenCalledOnce()
    expect(documentsStore.collapseAll).toHaveBeenCalledOnce()
  })

  it("keeps live queries synchronized after Stimulus-owned mutations", () => {
    controller.connect()

    controller.handleQueryDeleteCompleted(new CustomEvent("query-command:delete-completed", {
      detail: { queryId: 4 }
    }))
    controller.handleQueryMoveCompleted(new CustomEvent("query-command:move-completed", {
      detail: { caseId: 7, queryId: 5 }
    }))
    controller.handleQueryMoveCompleted(new CustomEvent("query-command:move-completed", {
      detail: { caseId: 8, queryId: 6 }
    }))

    expect(window.quepidSearch.queryCapabilities.reconcileQueryRemoval).toHaveBeenNthCalledWith(1, 4, true)
    expect(window.quepidSearch.queryCapabilities.reconcileQueryRemoval).toHaveBeenNthCalledWith(2, 5, true)
    expect(window.quepidSearch.queryCapabilities.reconcileQueryRemoval).toHaveBeenCalledTimes(2)
  })
})

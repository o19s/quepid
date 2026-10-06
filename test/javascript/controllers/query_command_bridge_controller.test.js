import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QueryCommandBridgeController from "controllers/query_command_bridge_controller"

let testStores

vi.mock("utils/core_store_access", () => ({ getCoreStores: () => testStores || {} }))

let testCapabilities

vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: () => testCapabilities || {} }))

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
    collectionStore = store()
    documentsStore = store()
    controller = new QueryCommandBridgeController()
    controller.element = document.createElement("body")
    testStores = { queries: collectionStore, documents: documentsStore }
    testCapabilities = {
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
  })

  it("routes document commands through the explicit query command runtime", () => {
    controller.connect()

    controller.routeDocumentCommand({ command: "rate-document", queryId: 4, docId: "doc-1", rating: 2 })
    controller.routeDocumentCommand({ command: "rate-all", queryId: 4, rating: 3 })
    controller.routeDocumentCommand({ command: "toggle-query", queryId: 4 })
    controller.routeDocumentCommand({ command: "paginate-query", queryId: 4, ratedOnly: true })

    expect(testCapabilities.queryCommands.rateDocument).toHaveBeenCalledWith(4, "doc-1", 2)
    expect(testCapabilities.queryCommands.rateAll).toHaveBeenCalledWith(4, 3)
    expect(testCapabilities.queryCommands.toggleQuery).toHaveBeenCalledWith(4)
    expect(testCapabilities.queryCommands.paginateQuery).toHaveBeenCalledWith(4, true)
  })

  it("routes collapse once through the query owner", () => {
    controller.connect()

    controller.routeCollectionCommand({ command: "toggle-show-only-rated" })
    controller.routeCollectionCommand({ command: "collapse-all" })

    expect(testCapabilities.queryCommands.toggleShowOnlyRated).toHaveBeenCalledOnce()
    expect(testCapabilities.queryCommands.collapseAll).toHaveBeenCalledOnce()
    expect(collectionStore.collapseAll).not.toHaveBeenCalled()
    expect(documentsStore.collapseAll).not.toHaveBeenCalled()
  })

  it("keeps live queries synchronized after Stimulus-owned mutations", () => {
    controller.connect()

    controller.queryRemoved({ queryId: 4 })
    controller.queryRemoved({ caseId: 7, queryId: 5 })
    controller.queryRemoved({ caseId: 8, queryId: 6 })
    controller.queryRemoved({ caseId: 7 })

    expect(testCapabilities.queryCapabilities.reconcileQueryRemoval).toHaveBeenNthCalledWith(1, 4, true)
    expect(testCapabilities.queryCapabilities.reconcileQueryRemoval).toHaveBeenNthCalledWith(2, 5, true)
    expect(testCapabilities.queryCapabilities.reconcileQueryRemoval).toHaveBeenCalledTimes(2)
  })
})

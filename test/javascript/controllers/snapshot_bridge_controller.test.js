import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SnapshotBridgeController from "controllers/snapshot_bridge_controller"
import { resetCoreServiceCache } from "utils/core_angular_adapter"

const api = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("api/fetch", () => api)

const snapshotApi = vi.hoisted(() => ({
  fetchSnapshot: vi.fn(),
  deleteSnapshot: vi.fn()
}))

vi.mock("utils/snapshot_api", () => snapshotApi)

const snapshotHydration = vi.hoisted(() => ({
  registerAndHydrateSnapshots: vi.fn().mockReturnValue({ promise: Promise.resolve() })
}))

vi.mock("utils/snapshot_hydration", () => snapshotHydration)

function buildController(services) {
  const controller = Object.create(SnapshotBridgeController.prototype)
  document.body.setAttribute("ng-app", "QuepidApp")
  window.angular = { element: () => ({ injector: () => ({ get: (name) => services[name] }) }) }
  return controller
}

describe("SnapshotBridgeController", () => {
  let services
  let controller

  beforeEach(() => {
    snapshotApi.fetchSnapshot.mockResolvedValue({ id: 7 })
    snapshotApi.deleteSnapshot.mockResolvedValue(undefined)
    api.apiFetch.mockReset()
    services = {
      settingsSvc: {
        editableSettings: vi.fn().mockReturnValue({}),
        supportLookupById: vi.fn()
      },
      caseTryNavSvc: {
        getQuepidRootUrl: vi.fn().mockReturnValue("/"),
        getCaseNo: vi.fn().mockReturnValue(1)
      },
      fieldSpecSvc: { createFieldSpec: vi.fn() },
      docCache: {
        addIds: vi.fn(),
        empty: vi.fn(),
        update: vi.fn(),
        getDoc: vi.fn()
      },
      normalDocsSvc: { explainDoc: vi.fn() },
      queriesSvc: {
        queryArray: vi.fn().mockReturnValue([]),
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      },
      $rootScope: {
        $evalAsync: (callback) => callback()
      }
    }
    window.quepidSearch = {
      docCache: services.docCache,
      snapshotSearch: {
        snapshots: {},
        createSnapshotModel: vi.fn()
      },
      queryState: {
        refreshAllDiffs: services.queriesSvc.refreshAllDiffs
      }
    }
    window.quepidStore = {
      diff: {
        selections: vi.fn().mockReturnValue(["7"]),
        enable: vi.fn(),
        disable: vi.fn()
      }
    }
    controller = buildController(services)
  })

  afterEach(() => {
    delete window.quepidStore
    delete window.quepidSearch
    delete window.angular
    document.body.removeAttribute("ng-app")
    resetCoreServiceCache()
    vi.restoreAllMocks()
  })

  it("clears comparisons and completes through the event callback", async () => {
    const done = vi.fn()

    controller.clear({ detail: { done } })
    await vi.waitFor(() => expect(window.quepidStore.diff.disable).toHaveBeenCalled())

    expect(window.quepidStore.diff.disable).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledWith(null)
  })

  it("applies selections while keeping refresh and scoring in the adapter", async () => {
    const done = vi.fn()

    controller.apply({ detail: { selections: ["7"], snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(snapshotApi.fetchSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots/7")
    expect(snapshotHydration.registerAndHydrateSnapshots).toHaveBeenCalledWith(expect.objectContaining({
      snapshots: [{ id: 7 }],
      registry: window.quepidSearch?.snapshotSearch?.snapshots
    }))
    expect(window.quepidStore.diff.enable).toHaveBeenCalledWith(["7"])
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("deletes snapshots and refreshes comparisons inside the adapter", async () => {
    const done = vi.fn()

    controller.delete({ detail: { snapshotId: "7", snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(snapshotApi.deleteSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots", "7")
    expect(window.quepidSearch.snapshotSearch.snapshots["7"]).toBeUndefined()
    expect(window.quepidStore.diff.disable).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("returns the current selections", () => {
    const done = vi.fn()

    controller.selectionRequest({ detail: { done } })

    expect(done).toHaveBeenCalledWith(["7"])
  })

  it("uses the snapshot-scoped cache for static engines", async () => {
    services.settingsSvc.editableSettings.mockReturnValue({ searchEngine: "static" })
    const scopedDoc = { id: "scoped" }
    services.docCache.getDoc.mockReturnValue(scopedDoc)

    await controller.registerSnapshots([{ id: 7 }])
    const hydrationOptions = snapshotHydration.registerAndHydrateSnapshots.mock.calls.at(-1)[0]
    hydrationOptions.createModel({
      params: { id: 7 },
      getDoc: () => sharedDoc,
      explainDoc: vi.fn(),
      log: vi.fn()
    })

    const modelOptions = window.quepidSearch.snapshotSearch.createSnapshotModel.mock.calls.at(-1)[0]
    expect(modelOptions.getDoc("doc-1")).toBe(scopedDoc)
    expect(services.docCache.getDoc).toHaveBeenLastCalledWith("doc-1", 7)
  })

  it("bootstraps shallow snapshots into the shared registry", async () => {
    controller.element = { dataset: { coreBootstrapCaseNoValue: "1" } }
    api.apiFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ snapshots: [{ id: 8 }] })
    })

    await controller.bootstrapSnapshots()

    expect(api.apiFetch).toHaveBeenCalledWith("api/cases/1/snapshots?shallow=true")
    expect(snapshotHydration.registerAndHydrateSnapshots).toHaveBeenCalledWith(expect.objectContaining({
      snapshots: [{ id: 8 }]
    }))
  })

  it("creates a snapshot from the live query collection", async () => {
    const done = vi.fn()
    api.apiFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ id: 9 })
    })

    await controller.create({
      detail: { caseId: 1, name: "new snapshot", recordDocumentFields: true, done }
    })

    expect(api.apiFetch).toHaveBeenCalledWith("api/cases/1/snapshots", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining('"name":"new snapshot"')
    }))
    expect(services.queriesSvc.queryArray).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledWith(null)
  })
})

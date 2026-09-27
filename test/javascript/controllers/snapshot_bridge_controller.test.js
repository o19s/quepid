import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SnapshotBridgeController from "controllers/snapshot_bridge_controller"

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
  controller.injector = () => ({ get: (name) => services[name] })
  return controller
}

describe("SnapshotBridgeController", () => {
  let services
  let controller

  beforeEach(() => {
    snapshotApi.fetchSnapshot.mockResolvedValue({ id: 7 })
    snapshotApi.deleteSnapshot.mockResolvedValue(undefined)
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
      docCacheSvc: {
        addIds: vi.fn(),
        empty: vi.fn(),
        update: vi.fn(),
        getDoc: vi.fn()
      },
      normalDocsSvc: { explainDoc: vi.fn() },
      queryViewSvc: {
        disableComparisons: vi.fn(),
        enableDiffs: vi.fn(),
        getAllDiffSettings: vi.fn().mockReturnValue(["7"])
      },
      queriesSvc: {
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      },
      $rootScope: {
        $evalAsync: (callback) => callback()
      }
    }
    window.quepidSearch = {
      snapshotSearch: {
        snapshots: {},
        createSnapshotModel: vi.fn()
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
    vi.restoreAllMocks()
  })

  it("clears comparisons and completes through the event callback", async () => {
    const done = vi.fn()

    controller.clear({ detail: { done } })
    await Promise.resolve()

    expect(window.quepidStore.diff.disable).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledWith(null)
  })

  it("applies selections while keeping refresh and scoring in the adapter", async () => {
    const done = vi.fn()
    let digestCallback
    services.$rootScope.$evalAsync = vi.fn((callback) => {
      digestCallback = callback
    })

    controller.apply({ detail: { selections: ["7"], snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    digestCallback()
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
    let digestCallback
    services.$rootScope.$evalAsync = vi.fn((callback) => {
      digestCallback = callback
    })

    controller.delete({ detail: { snapshotId: "7", snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    digestCallback()
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
    services.docCacheSvc.getDoc.mockReturnValue(scopedDoc)

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
    expect(services.docCacheSvc.getDoc).toHaveBeenLastCalledWith("doc-1", 7)
  })
})

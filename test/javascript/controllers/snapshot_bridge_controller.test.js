import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SnapshotBridgeController from "controllers/snapshot_bridge_controller"

const snapshotApi = vi.hoisted(() => ({
  fetchSnapshot: vi.fn(),
  deleteSnapshot: vi.fn()
}))

vi.mock("utils/snapshot_api", () => snapshotApi)

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
      queryViewSvc: {
        disableComparisons: vi.fn(),
        enableDiffs: vi.fn(),
        getAllDiffSettings: vi.fn().mockReturnValue(["7"])
      },
      queriesSvc: {
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      },
      querySnapshotSvc: {
        registerSnapshots: vi.fn().mockResolvedValue(undefined),
        removeSnapshot: vi.fn()
      },
      $rootScope: {
        $evalAsync: (callback) => callback()
      }
    }
    controller = buildController(services)
  })

  afterEach(() => vi.restoreAllMocks())

  it("clears comparisons and completes through the event callback", async () => {
    const done = vi.fn()

    controller.clear({ detail: { done } })
    await Promise.resolve()

    expect(services.queryViewSvc.disableComparisons).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
    expect(done).toHaveBeenCalledWith(null)
  })

  it("applies selections inside an Angular digest", async () => {
    const done = vi.fn()
    let digestCallback
    services.$rootScope.$evalAsync = vi.fn((callback) => {
      digestCallback = callback
    })

    controller.apply({ detail: { selections: ["7"], snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    expect(services.queryViewSvc.enableDiffs).not.toHaveBeenCalled()
    digestCallback()
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(snapshotApi.fetchSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots/7")
    expect(services.querySnapshotSvc.registerSnapshots).toHaveBeenCalledWith([{ id: 7 }])
    expect(services.queryViewSvc.enableDiffs).toHaveBeenCalledWith(["7"])
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("deletes snapshots and refreshes comparisons inside an Angular digest", async () => {
    const done = vi.fn()
    let digestCallback
    services.$rootScope.$evalAsync = vi.fn((callback) => {
      digestCallback = callback
    })

    controller.delete({ detail: { snapshotId: "7", snapshotsUrl: "api/cases/1/snapshots", done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    expect(services.queryViewSvc.disableComparisons).not.toHaveBeenCalled()
    digestCallback()
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(snapshotApi.deleteSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots", "7")
    expect(services.querySnapshotSvc.removeSnapshot).toHaveBeenCalledWith("7")
    expect(services.queryViewSvc.disableComparisons).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("returns the current selections", () => {
    const done = vi.fn()

    controller.selectionRequest({ detail: { done } })

    expect(done).toHaveBeenCalledWith(["7"])
  })
})

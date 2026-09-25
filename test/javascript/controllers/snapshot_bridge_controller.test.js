import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SnapshotBridgeController from "controllers/snapshot_bridge_controller"

function buildController(services) {
  const controller = Object.create(SnapshotBridgeController.prototype)
  controller.injector = () => ({ get: (name) => services[name] })
  return controller
}

describe("SnapshotBridgeController", () => {
  let services
  let controller

  beforeEach(() => {
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
        get: vi.fn().mockResolvedValue(undefined),
        deleteSnapshot: vi.fn().mockResolvedValue(undefined)
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

    controller.apply({ detail: { selections: ["7"], done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    expect(services.queryViewSvc.enableDiffs).not.toHaveBeenCalled()
    digestCallback()
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(services.querySnapshotSvc.get).toHaveBeenCalledWith("7")
    expect(services.queryViewSvc.enableDiffs).toHaveBeenCalledWith(["7"])
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("deletes snapshots and refreshes comparisons inside an Angular digest", async () => {
    const done = vi.fn()
    let digestCallback
    services.$rootScope.$evalAsync = vi.fn((callback) => {
      digestCallback = callback
    })

    controller.delete({ detail: { snapshotId: "7", done } })
    await vi.waitFor(() => expect(services.$rootScope.$evalAsync).toHaveBeenCalledOnce())

    expect(services.queryViewSvc.disableComparisons).not.toHaveBeenCalled()
    digestCallback()
    await vi.waitFor(() => expect(done).toHaveBeenCalledWith(null))

    expect(services.querySnapshotSvc.deleteSnapshot).toHaveBeenCalledWith("7")
    expect(services.queryViewSvc.disableComparisons).toHaveBeenCalledOnce()
    expect(services.queriesSvc.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("returns the current selections", () => {
    const done = vi.fn()

    controller.selectionRequest({ detail: { done } })

    expect(done).toHaveBeenCalledWith(["7"])
  })
})

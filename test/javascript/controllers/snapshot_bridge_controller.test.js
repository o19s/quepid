import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import SnapshotBridgeController from "controllers/snapshot_bridge_controller"
import { createSnapshotModel } from "utils/snapshot_model"

let testStores

vi.mock("utils/core_store_access", () => ({ getCoreStores: () => testStores || {} }))

let testCapabilities

vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: () => testCapabilities || {} }))

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
vi.mock("utils/snapshot_model", () => ({ createSnapshotModel: vi.fn() }))

function buildController(services) {
  const controller = buildControllerFixture(SnapshotBridgeController)
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
      fieldSpecSvc: { createFieldSpec: vi.fn() },
      docCache: {
        addIds: vi.fn(),
        empty: vi.fn(),
        update: vi.fn(),
        getDoc: vi.fn()
      },
      normalDocsSvc: { explainDoc: vi.fn() },
      queries: {
        queryArray: vi.fn().mockReturnValue([]),
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      }
    }
    testCapabilities = {
      caseRuntime: {
        snapshots: {
          capability: {
            settings: { editable: () => ({}), supportsLookupById: () => true },
            navigation: { rootUrl: () => "/", caseNo: () => 1 },
            fieldSpec: { create: services.fieldSpecSvc.createFieldSpec },
            documents: { explain: services.normalDocsSvc.explainDoc }
          },
          docCache: services.docCache
        }
      },
      docCache: services.docCache,
      snapshotRegistry: {},
      queryCapabilities: {
        refreshAllDiffs: services.queries.refreshAllDiffs,
        getQueryArray: services.queries.queryArray
      }
    }
    testStores = {
      diff: {
        selections: vi.fn().mockReturnValue(["7"]),
        enable: vi.fn(),
        disable: vi.fn()
      }
    }
    controller = buildController(services)
  })

  afterEach(() => {
    testStores = undefined
    testCapabilities = undefined
    vi.restoreAllMocks()
  })

  it("clears comparisons and resolves once diffs refresh", async () => {
    await controller.clear()

    expect(testStores.diff.disable).toHaveBeenCalledOnce()
    expect(services.queries.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("applies selections while keeping refresh and scoring in the adapter", async () => {
    await controller.apply({ selections: ["7"], snapshotsUrl: "api/cases/1/snapshots" })

    expect(snapshotApi.fetchSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots/7")
    expect(snapshotHydration.registerAndHydrateSnapshots).toHaveBeenCalledWith(expect.objectContaining({
      snapshots: [{ id: 7 }],
      registry: testCapabilities?.snapshotRegistry
    }))
    expect(testStores.diff.enable).toHaveBeenCalledWith(["7"])
    expect(services.queries.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("deletes snapshots and refreshes comparisons inside the adapter", async () => {
    await controller.delete({ snapshotId: "7", snapshotsUrl: "api/cases/1/snapshots" })

    expect(snapshotApi.deleteSnapshot).toHaveBeenCalledWith("api/cases/1/snapshots", "7")
    expect(testCapabilities.snapshotRegistry["7"]).toBeUndefined()
    expect(testStores.diff.disable).toHaveBeenCalledOnce()
    expect(services.queries.refreshAllDiffs).toHaveBeenCalledOnce()
  })

  it("returns the current selections", () => {
    expect(controller.currentSelections()).toEqual(["7"])
  })

  it.each(["apply", "delete"])("rejects %s without a snapshots URL", async (command) => {
    await expect(controller[command]({ selections: ["7"], snapshotId: "7" })).rejects.toThrow("Snapshot comparison services are not available")
    expect(services.queries.refreshAllDiffs).not.toHaveBeenCalled()
  })

  it("rejects a failed refresh so the caller can report it", async () => {
    services.queries.refreshAllDiffs.mockRejectedValue(new Error("refresh failed"))

    await expect(controller.clear()).rejects.toThrow("refresh failed")
  })

  it("uses the snapshot-scoped cache for static engines", async () => {
    testCapabilities.caseRuntime = {
      snapshots: {
        capability: {
          settings: {
            editable: () => ({ searchEngine: "static" }),
            supportsLookupById: () => false
          },
          navigation: {
            rootUrl: () => "/",
            caseNo: () => 1
          },
          fieldSpec: { create: vi.fn() },
          documents: { explain: vi.fn() }
        },
        docCache: services.docCache
      }
    }
    const scopedDoc = { id: "scoped" }
    services.docCache.getDoc.mockReturnValue(scopedDoc)

    await controller.registerSnapshots([{ id: 7 }])
    const hydrationOptions = snapshotHydration.registerAndHydrateSnapshots.mock.calls.at(-1)[0]
    hydrationOptions.createModel({
      params: { id: 7 },
      getDoc: () => scopedDoc,
      explainDoc: vi.fn(),
      log: vi.fn()
    })

    const modelOptions = createSnapshotModel.mock.calls.at(-1)[0]
    expect(modelOptions.getDoc("doc-1")).toBe(scopedDoc)
    expect(services.docCache.getDoc).toHaveBeenLastCalledWith("doc-1", 7)
  })

  it("bootstraps shallow snapshots into the shared registry", async () => {
    controller.snapshotsUrlValue = "api/cases/1/snapshots"
    api.apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: vi.fn(async () => null).mockResolvedValue({ snapshots: [{ id: 8 }] })
    })

    await controller.bootstrapSnapshots()

    expect(api.apiFetch).toHaveBeenCalledWith("api/cases/1/snapshots?shallow=true", { method: "GET", headers: { Accept: "application/json" } })
    expect(snapshotHydration.registerAndHydrateSnapshots).toHaveBeenCalledWith(expect.objectContaining({
      snapshots: [{ id: 8 }]
    }))
  })

  it("skips bootstrapping on a page without a case", async () => {
    controller.snapshotsUrlValue = ""

    await controller.bootstrapSnapshots()

    expect(api.apiFetch).not.toHaveBeenCalled()
  })

  it("creates a snapshot from the live query collection", async () => {
    testCapabilities.caseRuntime = {
      snapshots: {
        capability: {
          settings: {
            editable: () => ({}),
            supportsLookupById: () => true
          },
          navigation: {
            rootUrl: () => "/",
            caseNo: () => 1
          },
          fieldSpec: { create: vi.fn() },
          documents: { explain: vi.fn() }
        },
        docCache: services.docCache
      }
    }
    api.apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: vi.fn(async () => null).mockResolvedValue({ id: 9 })
    })

    controller.snapshotsUrlValue = "api/cases/1/snapshots"
    await controller.create({ caseId: 1, name: "new snapshot", recordDocumentFields: true })

    expect(api.apiFetch).toHaveBeenCalledWith("api/cases/1/snapshots", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: expect.stringContaining('"name":"new snapshot"')
    }))
    expect(services.queries.queryArray).toHaveBeenCalledOnce()
  })

  it("refuses to snapshot a different case", async () => {
    testCapabilities.caseRuntime = {
      snapshots: {
        capability: { navigation: { caseNo: () => 1 } },
        docCache: services.docCache
      }
    }

    await expect(controller.create({ caseId: 2, name: "other", recordDocumentFields: false })).rejects.toThrow("case mismatch")
    expect(api.apiFetch).not.toHaveBeenCalled()
  })
})

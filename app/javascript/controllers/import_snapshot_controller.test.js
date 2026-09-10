import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ImportSnapshotController from "./import_snapshot_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

describe("ImportSnapshotController sendSnapshotToAPI", () => {
  beforeEach(() => {
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete document.body.dataset.quepidRootUrl
  })

  it("builds the import URL under the quepid root, not a bare /api path", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await ImportSnapshotController.prototype.sendSnapshotToAPI.call(controller, "4", { name: "Snap A" })

    expect(apiFetch).toHaveBeenCalledWith(
      "https://example.com/quepid/api/cases/4/snapshots/imports",
      expect.objectContaining({ method: "POST" })
    )
  })
})

describe("ImportSnapshotController importSnapshots", () => {
  it("groups rows into a queries hash keyed by query text, not an array", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    controller.sendSnapshotToAPI = vi.fn().mockResolvedValue({})

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "2" },
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "cat", "Doc ID": "doc3", "Doc Position": "1" }
    ]

    await ImportSnapshotController.prototype.importSnapshots.call(controller, rows)

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledOnce()
    const [caseId, payload] = controller.sendSnapshotToAPI.mock.calls[0]

    expect(caseId).toBe("4")
    expect(payload.name).toBe("Snap A")
    expect(Array.isArray(payload.queries)).toBe(false)
    expect(payload.queries.dog.docs).toEqual([
      { id: "doc1", position: "1" },
      { id: "doc2", position: "2" }
    ])
    expect(payload.queries.cat.docs).toEqual([ { id: "doc3", position: "1" } ])
  })

  it("sends multiple snapshots for the same case sequentially, not concurrently", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)

    let inFlight = 0
    let concurrentCallsSeen = 0
    controller.sendSnapshotToAPI = vi.fn().mockImplementation(async () => {
      inFlight += 1
      if (inFlight > 1) concurrentCallsSeen += 1
      await new Promise(resolve => setTimeout(resolve, 0))
      inFlight -= 1
      return {}
    })

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap B", "Snapshot Time": "2026-09-01T13:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "1" }
    ]

    await ImportSnapshotController.prototype.importSnapshots.call(controller, rows)

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledTimes(2)
    expect(concurrentCallsSeen).toBe(0)
  })

  it("counts failures without aborting remaining snapshots, and still throws", async () => {
    const controller = Object.create(ImportSnapshotController.prototype)
    controller.sendSnapshotToAPI = vi.fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({})

    const rows = [
      { "Case ID": "4", "Snapshot Name": "Snap A", "Snapshot Time": "2026-09-01T12:00:00Z", "Query Text": "dog", "Doc ID": "doc1", "Doc Position": "1" },
      { "Case ID": "4", "Snapshot Name": "Snap B", "Snapshot Time": "2026-09-01T13:00:00Z", "Query Text": "dog", "Doc ID": "doc2", "Doc Position": "1" }
    ]

    await expect(
      ImportSnapshotController.prototype.importSnapshots.call(controller, rows)
    ).rejects.toThrow("1 snapshot(s) failed to import")

    expect(controller.sendSnapshotToAPI).toHaveBeenCalledTimes(2)
  })
})

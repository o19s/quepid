import { describe, expect, it, vi } from "vitest"
import ImportSnapshotController from "./import_snapshot_controller"

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
})

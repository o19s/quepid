import { afterEach, describe, expect, it, vi } from "vitest"
import { buildSnapshotImportGroups, importSnapshotsToCase } from "utils/snapshot_import"

describe("snapshot import runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const rows = [{
    "Case ID": "ignored",
    "Snapshot Name": "Weekly",
    "Snapshot Time": "2026-09-27",
    "Query Text": "star wars",
    "Doc ID": "doc-1",
    "Doc Position": "1",
    title: "Star Wars"
  }]

  it("groups rows and preserves imported document fields", () => {
    expect(buildSnapshotImportGroups(rows, 7)[7].snapshots.Weekly).toEqual({
      name: "Weekly",
      created_at: "2026-09-27",
      queries: { "star wars": { docs: [{ id: "doc-1", position: "1", fields: { title: "Star Wars" } }] } }
    })
  })

  it("posts grouped snapshots sequentially and returns imported snapshots", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({ snapshots: [{ id: 9 }] }) })
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({ snapshots: [{ id: 10 }] }) })

    vi.stubGlobal("fetch", fetcher)
    const imported = await importSnapshotsToCase(rows, 7, "")

    expect(imported).toEqual([{ id: 9 }])
    expect(fetcher).toHaveBeenCalledWith("/api/cases/7/snapshots/imports", expect.objectContaining({ method: "POST" }))
  })
})

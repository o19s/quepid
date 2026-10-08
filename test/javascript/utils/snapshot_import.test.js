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

  it("keeps CSV case IDs and omits fields for the list importer", () => {
    const groups = buildSnapshotImportGroups([
      { ...rows[0], "Case ID": "7" },
      { ...rows[0], "Case ID": "8", "Doc ID": "doc-2" }
    ], undefined, { includeFields: false })
    expect(Object.keys(groups)).toEqual(["7", "8"])
    expect(groups[7].snapshots.Weekly.queries["star wars"].docs).toEqual([
      { id: "doc-1", position: "1" }
    ])
    expect(groups[8].snapshots.Weekly.queries["star wars"].docs[0].id).toBe("doc-2")
  })

  it.each(["10/07/26 21:10", "10/07/2026 21:10"])(
    "parses the documented month/day/year timestamp %s without browser timezone conversion",
    (timestamp) => {
      const groups = buildSnapshotImportGroups([{ ...rows[0], "Snapshot Time": timestamp }], 7)
      expect(groups[7].snapshots.Weekly.created_at).toBe("2026-10-07T21:10:00")
    }
  )

  it("preserves ISO timestamps including their timezone", () => {
    const timestamp = "2026-10-07T21:10:00-05:00"
    const groups = buildSnapshotImportGroups([{ ...rows[0], "Snapshot Time": timestamp }], 7)
    expect(groups[7].snapshots.Weekly.created_at).toBe(timestamp)
  })

  it("keeps the static wizard contract when Snapshot Time is omitted", () => {
    const { "Snapshot Time": _time, ...row } = rows[0]
    expect(buildSnapshotImportGroups([row], 7)[7].snapshots.Weekly.created_at).toBeUndefined()
  })

  it.each(["02/29/26 12:00", "13/01/26 12:00", "10/07/26 24:00", "not a date", ""])(
    "rejects invalid timestamps with the CSV row number: %s",
    (timestamp) => {
      expect(() => buildSnapshotImportGroups([
        rows[0], { ...rows[0], "Snapshot Name": "Invalid", "Snapshot Time": timestamp }
      ], 7)).toThrow(/Row 3: invalid Snapshot Time/)
    }
  )

  it("groups names that collide with object prototype properties", () => {
    const groups = buildSnapshotImportGroups([
      { ...rows[0], "Snapshot Name": "__proto__", "Query Text": "constructor" }
    ], 7)
    expect(groups[7].snapshots.__proto__.queries.constructor.docs[0].id).toBe("doc-1")
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
  it("posts one snapshot per request with its queries and docs", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({ snapshots: [] }),
      text: async () => "{}"
    }))
    vi.stubGlobal("fetch", fetcher)

    await importSnapshotsToCase(rows, 7, "")

    const body = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(body.snapshots).toHaveLength(1)
    expect(body.snapshots[0].name).toBe("Weekly")
    expect(body.snapshots[0].queries["star wars"].docs[0].id).toBe("doc-1")
  })
})

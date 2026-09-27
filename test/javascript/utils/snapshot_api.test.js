import { describe, expect, it, vi } from "vitest"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"

describe("snapshot api", () => {
  it("fetches a shallow snapshot payload", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 7 }) })

    await expect(fetchSnapshot("api/cases/1/snapshots/7", fetcher)).resolves.toEqual({ id: 7 })
    expect(fetcher).toHaveBeenCalledWith("api/cases/1/snapshots/7?shallow=true")
  })

  it("rejects failed snapshot requests", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    await expect(fetchSnapshot("snapshots/7", fetcher)).rejects.toThrow("Snapshot request failed (500)")
  })

  it("deletes a snapshot through the API", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true })
    await deleteSnapshot("api/cases/1/snapshots", "7", fetcher)
    expect(fetcher).toHaveBeenCalledWith("api/cases/1/snapshots/7", { method: "DELETE" })
  })
})

import { describe, expect, it, vi } from "vitest"
import { deleteSnapshot, fetchSnapshot } from "utils/snapshot_api"

describe("snapshot api", () => {
  it("fetches a shallow snapshot payload", async () => {
    const fetcher = vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({ id: 7 }) })

    await expect(fetchSnapshot("api/cases/1/snapshots/7", fetcher)).resolves.toEqual({ id: 7 })
    expect(fetcher).toHaveBeenCalledWith("api/cases/1/snapshots/7?shallow=true", { headers: { Accept: "application/json" } })
  })

  it("rejects failed snapshot requests", async () => {
    const fetcher = vi.fn().mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })
    await expect(fetchSnapshot("snapshots/7", fetcher)).rejects.toThrow("Request failed (500)")
  })

  it("deletes a snapshot through the API", async () => {
    const fetcher = vi.fn().mockResolvedValue({ text: async () => "", json: async () => null,  ok: true })
    await deleteSnapshot("api/cases/1/snapshots", "7", fetcher)
    expect(fetcher).toHaveBeenCalledWith("api/cases/1/snapshots/7", { method: "DELETE", headers: { Accept: "application/json" } })
  })
})

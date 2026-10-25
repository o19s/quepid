import { beforeEach, describe, expect, it, vi } from "vitest"
import { deleteJson, postJson, putJson } from "api/json"
import { RatingsStore } from "utils/ratings_store"

vi.mock("api/json", () => ({
  deleteJson: vi.fn(() => Promise.resolve(null)),
  postJson: vi.fn(() => Promise.resolve(null)),
  putJson: vi.fn(() => Promise.resolve(null))
}))

describe("RatingsStore", () => {
  let onChanged
  let store

  beforeEach(() => {
    vi.clearAllMocks()
    onChanged = vi.fn()
    store = new RatingsStore({
      caseNo: 0,
      queryId: 1,
      ratingsDict: { doc1: "10", doc2: 8 },
      onChanged
    })
  })

  it("converts string ratings and sorts best documents", () => {
    expect(store.getRating("doc1")).toBe(10)
    expect(store.bestDocs()).toEqual([
      { id: "doc1", rating: 10 },
      { id: "doc2", rating: 8 }
    ])
  })

  it("updates ratings only after the request succeeds", async () => {
    await store.rateDocument("doc3", 5)

    expect(store.getRating("doc3")).toBe(5)
    expect(store.version()).toBe(1)
    expect(onChanged).toHaveBeenCalledWith(1)
    expect(putJson).toHaveBeenCalledWith("api/cases/0/queries/1/ratings", { rating: { doc_id: "doc3", rating: 5 } })
  })

  it("updates bulk ratings and bulk resets", async () => {
    await store.rateBulkDocuments(["doc3", "doc4"], 7)
    expect(store.getRating("doc3")).toBe(7)
    expect(store.getRating("doc4")).toBe(7)

    await store.resetBulkRatings(["doc3", "doc4"])
    expect(store.hasRating("doc3")).toBe(false)
    expect(store.hasRating("doc4")).toBe(false)
    expect(store.version()).toBe(2)
    expect(putJson).toHaveBeenCalledWith("api/cases/0/queries/1/bulk/ratings", { doc_ids: ["doc3", "doc4"], rating: 7 })
    expect(postJson).toHaveBeenCalledWith("api/cases/0/queries/1/bulk/ratings/delete", { doc_ids: ["doc3", "doc4"] })
  })

  it("leaves ratings unchanged when the request fails", async () => {
    putJson.mockRejectedValueOnce(new Error("offline"))

    await expect(store.rateDocument("doc3", 5)).rejects.toThrow("offline")

    expect(store.hasRating("doc3")).toBe(false)
    expect(onChanged).not.toHaveBeenCalled()
  })

  it("resets a rating with a JSON DELETE body", async () => {
    await store.resetRating("doc1")

    expect(store.hasRating("doc1")).toBe(false)
    expect(deleteJson).toHaveBeenCalledWith("api/cases/0/queries/1/ratings", { rating: { doc_id: "doc1" } })
  })

  it("adds rating behavior without replacing document behavior", async () => {
    const document = { id: "doc3", explain: () => "ok" }
    const rateable = store.createRateableDoc(document)

    expect(rateable.explain()).toBe("ok")
    expect(rateable.hasRating()).toBe(false)
    await rateable.rate(4)
    expect(rateable.getRating()).toBe(4)
  })

  it("changes the query id used by later requests", async () => {
    store.setQueryId(9)
    await store.rateDocument("doc1", 3)

    expect(putJson).toHaveBeenCalledWith("api/cases/0/queries/9/ratings", expect.anything())
  })
  it("sorts best documents highest first regardless of insertion order", () => {
    const unordered = new RatingsStore({
      caseNo: 0,
      queryId: 1,
      ratingsDict: { low: 1, high: "9", mid: 5 },
      onChanged
    })
    expect(unordered.bestDocs().map((doc) => doc.id)).toEqual(["high", "mid", "low"])
  })
})

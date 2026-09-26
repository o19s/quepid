import { beforeEach, describe, expect, it, vi } from "vitest"
import { RatingsStore } from "utils/ratings_store"

describe("RatingsStore", () => {
  let request
  let onChanged
  let store

  beforeEach(() => {
    request = vi.fn(() => Promise.resolve())
    onChanged = vi.fn()
    store = new RatingsStore({
      caseNo: 0,
      queryId: 1,
      ratingsDict: { doc1: "10", doc2: 8 },
      request,
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
    expect(request).toHaveBeenCalledWith({
      method: "PUT",
      url: "api/cases/0/queries/1/ratings",
      data: { rating: { doc_id: "doc3", rating: 5 } }
    })
  })

  it("updates bulk ratings and bulk resets", async () => {
    await store.rateBulkDocuments(["doc3", "doc4"], 7)
    expect(store.getRating("doc3")).toBe(7)
    expect(store.getRating("doc4")).toBe(7)

    await store.resetBulkRatings(["doc3", "doc4"])
    expect(store.hasRating("doc3")).toBe(false)
    expect(store.hasRating("doc4")).toBe(false)
    expect(store.version()).toBe(2)
  })

  it("uses the legacy delete request shape", async () => {
    await store.resetRating("doc1")

    expect(store.hasRating("doc1")).toBe(false)
    expect(request).toHaveBeenCalledWith({
      method: "DELETE",
      url: "api/cases/0/queries/1/ratings",
      data: JSON.stringify({ rating: { doc_id: "doc1" } }),
      headers: { "Content-Type": "application/json;charset=UTF-8" }
    })
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

    expect(request).toHaveBeenCalledWith(expect.objectContaining({
      url: "api/cases/0/queries/9/ratings"
    }))
  })
})

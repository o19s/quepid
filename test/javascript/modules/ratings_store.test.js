import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { RatingsStore } from "modules/ratings_store"

// Mock the api_url module
vi.mock("modules/api_url", () => ({
  apiUrl: (path) => `http://localhost/${path}`,
  csrfToken: () => "test-token",
}))

describe("RatingsStore", () => {
  let store
  let fetchSpy

  beforeEach(() => {
    store = new RatingsStore(1, 42, { "doc-a": 3, "doc-b": "1" })
    fetchSpy = vi.spyOn(globalThis, "fetch")
  })

  afterEach(() => {
    fetchSpy.mockRestore()
  })

  describe("constructor", () => {
    it("parses initial ratings as integers", () => {
      expect(store.getRating("doc-a")).toBe(3)
      expect(store.getRating("doc-b")).toBe(1)
    })

    it("handles empty initial ratings", () => {
      const empty = new RatingsStore(1, 42)
      expect(empty.ratedCount()).toBe(0)
    })
  })

  describe("getRating", () => {
    it("returns null for unrated doc", () => {
      expect(store.getRating("unknown")).toBeNull()
    })

    it("returns the rating value for a rated doc", () => {
      expect(store.getRating("doc-a")).toBe(3)
    })
  })

  describe("hasRating", () => {
    it("returns true for rated doc", () => {
      expect(store.hasRating("doc-a")).toBe(true)
    })

    it("returns false for unrated doc", () => {
      expect(store.hasRating("unknown")).toBe(false)
    })
  })

  describe("bestDocs", () => {
    it("returns rated docs sorted by rating desc", () => {
      const best = store.bestDocs()
      expect(best).toEqual([
        { docId: "doc-a", rating: 3 },
        { docId: "doc-b", rating: 1 },
      ])
    })
  })

  describe("ratedCount", () => {
    it("returns count of rated docs", () => {
      expect(store.ratedCount()).toBe(2)
    })
  })

  describe("constructor edge cases", () => {
    it("skips NaN values from initial ratings", () => {
      const store2 = new RatingsStore(1, 42, { "doc-x": null, "doc-y": "not-a-number" })
      expect(store2.hasRating("doc-x")).toBe(false)
      expect(store2.hasRating("doc-y")).toBe(false)
      expect(store2.ratedCount()).toBe(0)
    })
  })

  describe("rate", () => {
    it("sends PUT and updates local cache", async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, doc_id: "doc-c", rating: 2, query_id: 42 }),
      })

      await store.rate("doc-c", 2)

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost/api/cases/1/queries/42/ratings",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ rating: { doc_id: "doc-c", rating: 2 } }),
        }),
      )
      expect(store.getRating("doc-c")).toBe(2)
      expect(store.ratedCount()).toBe(3)
    })

    it("throws on non-ok response", async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 422 })

      await expect(store.rate("doc-c", 2)).rejects.toThrow("Failed to save rating (422)")
      expect(store.getRating("doc-c")).toBeNull()
    })
  })

  describe("unrate", () => {
    it("sends DELETE and removes from local cache", async () => {
      fetchSpy.mockResolvedValue({ ok: true })

      await store.unrate("doc-a")

      expect(fetchSpy).toHaveBeenCalledWith(
        "http://localhost/api/cases/1/queries/42/ratings",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ rating: { doc_id: "doc-a" } }),
        }),
      )
      expect(store.getRating("doc-a")).toBeNull()
      expect(store.ratedCount()).toBe(1)
    })
  })
})

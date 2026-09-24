import { describe, expect, it, vi } from "vitest"
import { createQueryDiff } from "utils/diff_results"

function buildQuery() {
  return {
    queryId: 1,
    scoreOthers: vi.fn(() => ({ score: 50, allRated: true }))
  }
}

function buildSearcher(id, docs = [{ id, ratedOnly: false }]) {
  return {
    docs,
    search: vi.fn(() => Promise.resolve()),
    name: () => `Snapshot ${id}`,
    version: () => id
  }
}

describe("createQueryDiff", () => {
  it("clears the compatibility wrappers when comparisons are disabled", async () => {
    const query = buildQuery()
    query.diff = { stale: true }

    await createQueryDiff({
      query,
      diffSettings: [],
      createSearcherFromSnapshot: vi.fn()
    })

    expect(query.diff).toBeNull()
    expect(query.diffs).toBeNull()
    expect(query.diffSearchers).toEqual([])
  })

  it("creates a single-diff compatibility wrapper and scores unrated-only docs", async () => {
    const query = buildQuery()
    const searcher = buildSearcher("one", [
      { id: "rated", ratedOnly: true },
      { id: "unrated", ratedOnly: false }
    ])
    const factory = vi.fn(() => searcher)

    await createQueryDiff({
      query,
      diffSettings: ["one"],
      settings: { id: "settings" },
      createSearcherFromSnapshot: factory
    })

    expect(factory).toHaveBeenCalledWith("one", query, { id: "settings" })
    expect(query.diff.name()).toBe("Snapshot one")
    expect(query.diff.docs()).toEqual([{ id: "unrated", ratedOnly: false }])
    expect(query.scoreOthers).toHaveBeenCalledWith([{ id: "unrated", ratedOnly: false }])
    await expect(query.diff.score()).resolves.toEqual({ score: 50, allRated: true })
  })

  it("retains multiple diff searchers and skips missing snapshots", async () => {
    const query = buildQuery()
    const first = buildSearcher("one")
    const factory = vi.fn((id) => id === "one" ? first : null)

    await createQueryDiff({
      query,
      diffSettings: ["one", "missing"],
      createSearcherFromSnapshot: factory
    })

    expect(query.diff).toBeNull()
    expect(query.diffs.getSearchers()).toEqual([first])
    expect(query.diffs.names()).toEqual(["Snapshot one"])
    expect(query.diffs.docs(3)).toEqual([])
  })

  it("supports scoreOthers promises", async () => {
    const query = buildQuery()
    query.scoreOthers.mockResolvedValue({ score: 75, allRated: false })
    const searcher = buildSearcher("one")

    await createQueryDiff({
      query,
      diffSettings: ["one"],
      createSearcherFromSnapshot: () => searcher
    })

    expect(searcher.diffScore).toEqual({ score: 75, allRated: false })
  })
})

import { describe, expect, it, vi } from "vitest"
import {
  createSnapshotSearcher,
  createSnapshotSearcherFromRegistry
} from "utils/snapshot_searcher"

describe("snapshot searcher", () => {
  const query = { queryId: 7, version: vi.fn(() => 3) }

  function makeSnapshot(overrides = {}) {
    return {
      name: () => "snapshot name",
      getSearchResults: () => [
        { id: "rated", rated_only: true, explain: '{"value":2}' },
        { id: "unrated", rated_only: false, explain: '{"value":1}' }
      ],
      ...overrides
    }
  }

  it("hydrates snapshot documents through the injected factories", () => {
    const createRateableDoc = vi.fn((doc) => ({ ...doc }))
    const explainDoc = vi.fn((doc, explain) => ({ ...doc, explain }))
    const searcher = createSnapshotSearcher({
      snapshot: makeSnapshot(),
      query,
      fieldSpec: { id: "id" },
      createRateableDoc,
      explainDoc
    })

    expect(searcher.type).toBe("snapshot")
    expect(searcher.numFound).toBe(2)
    expect(searcher.docs).toEqual([
      { id: "rated", rated_only: true, explain: { value: 2 }, ratedOnly: true },
      { id: "unrated", rated_only: false, explain: { value: 1 }, ratedOnly: false }
    ])
    expect(searcher.getFilteredDocs(true)).toHaveLength(1)
    expect(searcher.getFilteredDocs(false)).toHaveLength(1)
    expect(createRateableDoc).toHaveBeenCalledTimes(2)
    expect(explainDoc).toHaveBeenCalledTimes(2)
  })

  it("preserves the snapshot searcher interface", async () => {
    const searcher = createSnapshotSearcher({
      snapshot: makeSnapshot(),
      query,
      fieldSpec: null,
      createRateableDoc: (doc) => doc,
      explainDoc: (doc) => doc
    })

    await expect(searcher.search()).resolves.toBeUndefined()
    expect(searcher.pager()).toBeNull()
    await expect(searcher.explainOther("q", {})).rejects.toBe("ExplainOther not supported for snapshots")
    expect(searcher.name()).toBe("snapshot name")
    expect(searcher.version()).toBe(3)
  })

  it("surfaces recorded query errors and empty snapshots", () => {
    const searcher = createSnapshotSearcher({
      snapshot: makeSnapshot({
        getQueryError: () => "mapper failed",
        getSearchResults: () => null
      }),
      query,
      fieldSpec: null,
      createRateableDoc: (doc) => doc,
      explainDoc: (doc) => doc
    })

    expect(searcher.inError).toBe(true)
    expect(searcher.searchError).toBe("mapper failed")
    expect(searcher.numFound).toBe(0)
    expect(searcher.docs).toEqual([])
  })

  it("creates a searcher from a snapshot registry", () => {
    const settings = { createFieldSpec: vi.fn(() => ({ id: "id" })) }
    const snapshot = makeSnapshot()
    const searcher = createSnapshotSearcherFromRegistry({
      snapshotId: "snapshot-1",
      snapshots: { "snapshot-1": snapshot },
      query,
      settings,
      createRateableDoc: (doc) => doc,
      explainDoc: (doc) => doc
    })

    expect(searcher.snapshot).toBe(snapshot)
    expect(searcher.fieldSpec).toEqual({ id: "id" })
    expect(settings.createFieldSpec).toHaveBeenCalledOnce()
  })

  it("returns null and logs when a snapshot is missing", () => {
    const log = vi.fn()

    expect(createSnapshotSearcherFromRegistry({
      snapshotId: "missing",
      snapshots: {},
      query,
      createRateableDoc: (doc) => doc,
      explainDoc: (doc) => doc,
      log
    })).toBeNull()
    expect(log).toHaveBeenCalledWith("Snapshot not found: missing")
  })
})

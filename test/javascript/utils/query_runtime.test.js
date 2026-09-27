import { describe, expect, it, vi } from "vitest"
import { createQueryRuntime } from "utils/query_runtime"

function buildRuntime(overrides = {}) {
  const query = {
    searcher: null,
    ratedSearcher: null,
    docs: [],
    ratedDocs: [],
    ratingsStore: { id: "ratings" },
    ...overrides.query
  }
  const publish = vi.fn()
  const runtime = createQueryRuntime({
    query,
    getSettings: () => ({ createFieldSpec: () => ({ id: "id" }) }),
    createSearcher: vi.fn(() => ({ search: vi.fn(() => Promise.resolve()), docs: [], numFound: 0 })),
    createSnapshotSearcher: vi.fn(),
    normalizeDocuments: vi.fn(() => [{ id: "rated-2" }]),
    createDocList: vi.fn(() => ({ list: () => [{ id: "doc-2" }] })),
    matchFeaturesExplain: vi.fn(),
    setDocs: vi.fn(() => undefined),
    onError: vi.fn(),
    parseError: vi.fn(),
    publish,
    logger: { debug: vi.fn() },
    ...overrides
  })
  return { query, runtime, publish }
}

describe("query runtime", () => {
  it("delegates live search while keeping searcher construction injected", async () => {
    const searcher = { search: vi.fn(() => Promise.resolve()), docs: [], numFound: 0 }
    const createSearcher = vi.fn(() => searcher)
    const setDocs = vi.fn(() => undefined)
    const { query, runtime } = buildRuntime({ createSearcher, setDocs })

    await runtime.search()

    expect(createSearcher).toHaveBeenNthCalledWith(1)
    expect(createSearcher).toHaveBeenNthCalledWith(2, { filterToRated: true })
    expect(query.searcher).toBe(searcher)
    expect(setDocs).toHaveBeenCalledWith([], 0)
  })

  it("appends normalized documents when paging", async () => {
    const nextSearcher = { docs: [{ id: "raw" }], search: vi.fn(() => Promise.resolve()) }
    const query = {
      searcher: { pager: vi.fn(() => nextSearcher) },
      docs: [{ id: "doc-1" }],
      ratedDocs: [],
      ratingsStore: {}
    }
    const { runtime, publish } = buildRuntime({ query })

    await runtime.paginate()

    expect(query.docs).toEqual([{ id: "doc-1" }, { id: "doc-2" }])
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("handles rated-result paging through the injected normalization seam", async () => {
    const nextSearcher = { search: vi.fn(() => Promise.resolve()) }
    const query = {
      searcher: null,
      ratedSearcher: { pager: vi.fn(() => nextSearcher) },
      docs: [],
      ratedDocs: [{ id: "rated-1" }],
      ratingsStore: {}
    }
    const { runtime, publish } = buildRuntime({ query })

    await runtime.ratedPaginate()

    expect(query.ratedDocs).toEqual([{ id: "rated-1" }, { id: "rated-2" }])
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("reports missing snapshots through the injected error boundary", async () => {
    const onError = vi.fn()
    const { runtime } = buildRuntime({ createSnapshotSearcher: vi.fn(() => null), onError })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe("Snapshot not found: 42")
    expect(onError).toHaveBeenCalledWith("Snapshot not found: 42")
  })

  it("converts synchronous snapshot construction failures into rejections", async () => {
    const error = new Error("malformed snapshot")
    const { runtime } = buildRuntime({ createSnapshotSearcher: vi.fn(() => { throw error }) })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe(error)
  })

  it("converts synchronous snapshot search failures into rejections", async () => {
    const error = new Error("snapshot search failed")
    const { runtime } = buildRuntime({
      createSnapshotSearcher: vi.fn(() => ({ search: vi.fn(() => { throw error }) }))
    })

    await expect(runtime.searchFromSnapshot(42)).rejects.toBe(error)
  })
})

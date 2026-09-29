import { describe, expect, it, vi } from "vitest"
import { createLiveQueryDiffRuntime } from "utils/live_query_diff"

function runtimeFor(overrides = {}) {
  return createLiveQueryDiffRuntime({
    createDiff: vi.fn(() => Promise.resolve()),
    getQueries: vi.fn(() => ({ 1: { queryId: 1 } })),
    getDiffSettings: vi.fn(() => ["snapshot"]),
    getSettings: vi.fn(() => ({ searchEngine: "solr" })),
    createSearcherFromSnapshot: vi.fn(),
    publish: vi.fn(),
    notify: vi.fn(),
    promiseApi: Promise,
    ...overrides
  })
}

describe("createLiveQueryDiffRuntime", () => {
  it("assembles a framework-free diff with the current service adapters", () => {
    const createDiff = vi.fn(() => Promise.resolve())
    const getDiffSettings = vi.fn(() => ["snapshot"])
    const getSettings = vi.fn(() => ({ searchEngine: "solr" }))
    const createSearcherFromSnapshot = vi.fn()
    const query = { queryId: 4 }
    const runtime = runtimeFor({ createDiff, getDiffSettings, getSettings, createSearcherFromSnapshot })

    return runtime.create(query).then(() => {
      expect(createDiff).toHaveBeenCalledWith({
        query,
        diffSettings: ["snapshot"],
        settings: { searchEngine: "solr" },
        createSearcherFromSnapshot
      })
    })
  })

  it("publishes initial and refreshed diff state and reports completion", async () => {
    const query = { queryId: 1 }
    const publish = vi.fn()
    const notify = vi.fn()
    const runtime = runtimeFor({
      getQueries: vi.fn(() => ({ 1: query })),
      publish,
      notify
    })

    await runtime.refreshAll()

    expect(publish).toHaveBeenNthCalledWith(1, query)
    expect(publish).toHaveBeenNthCalledWith(2, query)
    expect(notify).toHaveBeenCalledWith({ success: true })
  })

  it("reports refresh failures and preserves the rejection", async () => {
    const error = new Error("diff failed")
    const notify = vi.fn()
    const runtime = runtimeFor({
      createDiff: vi.fn(() => Promise.reject(error)),
      notify
    })

    await expect(runtime.refreshAll()).rejects.toBe(error)
    expect(notify).toHaveBeenCalledWith({ success: false })
  })
})

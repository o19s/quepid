import { describe, expect, it, vi } from "vitest"
import { createLiveQueryRuntime } from "utils/live_query_runtime"

describe("createLiveQueryRuntime", () => {
  it("assembles Angular compatibility callbacks around the framework-free runtime", () => {
    const createRuntime = vi.fn(() => "runtime")
    const query = { id: 1 }
    const dependencies = {
      createRuntime,
      getSettings: vi.fn(),
      copySettings: vi.fn(),
      createSearcher: vi.fn(),
      createRatedSearcher: vi.fn(),
      searchApiRatedDocs: vi.fn(),
      supportsSearchApiRatedDocsLookup: vi.fn(),
      createSnapshotSearcher: vi.fn(),
      normalizeDocuments: vi.fn(),
      createDocList: vi.fn(),
      createRateableDoc: vi.fn(),
      matchFeaturesExplain: vi.fn(),
      setDocs: vi.fn(),
      onError: vi.fn(),
      parseError: vi.fn(),
      publish: vi.fn(),
      promiseApi: {},
      logger: {}
    }

    const runtime = createLiveQueryRuntime(dependencies).create(query)

    expect(runtime).toBe("runtime")
    expect(createRuntime).toHaveBeenCalledWith(expect.objectContaining({ query }))
  })

  it("forwards the query to query-specific compatibility callbacks", () => {
    const createRuntime = vi.fn((options) => options)
    const query = { id: 2 }
    const createSearcher = vi.fn()
    const createRateableDoc = vi.fn()
    const setDocs = vi.fn()
    const onError = vi.fn()
    const runtime = createLiveQueryRuntime({
      createRuntime,
      getSettings: vi.fn(),
      createSearcher,
      createRatedSearcher: vi.fn(),
      searchApiRatedDocs: vi.fn(),
      supportsSearchApiRatedDocsLookup: vi.fn(),
      createSnapshotSearcher: vi.fn(),
      normalizeDocuments: vi.fn(),
      createDocList: vi.fn(),
      createRateableDoc,
      matchFeaturesExplain: vi.fn(),
      setDocs,
      onError,
      parseError: vi.fn(),
      publish: vi.fn()
    }).create(query)

    runtime.createSearcher({ filterToRated: true })
    runtime.createRateableDoc("doc")
    runtime.setDocs(["doc"], 1)
    runtime.onError("failed")

    expect(createSearcher).toHaveBeenCalledWith(query, { filterToRated: true })
    expect(createRateableDoc).toHaveBeenCalledWith(query, "doc")
    expect(setDocs).toHaveBeenCalledWith(query, ["doc"], 1)
    expect(onError).toHaveBeenCalledWith(query, "failed")
  })
})

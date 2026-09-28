import { describe, expect, it, vi } from "vitest"
import { createLiveQueryExecutionRuntime } from "utils/live_query_execution"

describe("live query execution runtime", () => {
  it("assembles search, document, and error adapters into the query runtime", () => {
    const createRuntime = vi.fn().mockReturnValue({ create: vi.fn() })
    const settings = { get: vi.fn(), copy: vi.fn() }
    const searchers = {
      create: vi.fn(),
      createRated: vi.fn(),
      searchApiRatedDocs: vi.fn(),
      supportsRated: vi.fn(),
      createSnapshot: vi.fn()
    }
    const documents = {
      normalize: vi.fn(),
      createList: vi.fn(),
      createRateable: vi.fn(),
      matchFeaturesExplain: vi.fn(),
      setDocs: vi.fn()
    }
    const errors = { onError: vi.fn(), parse: vi.fn() }

    createLiveQueryExecutionRuntime({
      createRuntime,
      settings,
      searchers,
      documents,
      errors,
      publish: vi.fn(),
      promiseApi: {},
      logger: {}
    })

    expect(createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      getSettings: settings.get,
      createSearcher: searchers.create,
      createRatedSearcher: searchers.createRated,
      searchApiRatedDocs: searchers.searchApiRatedDocs,
      normalizeDocuments: documents.normalize,
      createDocList: documents.createList,
      setDocs: documents.setDocs,
      onError: errors.onError,
      parseError: errors.parse
    }))
  })
})

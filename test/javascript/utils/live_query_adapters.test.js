import { describe, expect, it, vi } from "vitest"
import { createLiveQueryAdapters } from "utils/live_query_adapters"

describe("createLiveQueryAdapters", () => {
  it("keeps compatibility, scoring, and book callbacks in explicit groups", () => {
    const model = { getDefaultScorer: vi.fn() }
    const documents = { normalize: vi.fn() }
    const factory = { create: vi.fn() }
    const execution = { searchers: { create: vi.fn() } }
    const scoring = {
      getDefault: vi.fn(),
      select: vi.fn(),
      bootstrap: vi.fn()
    }
    const book = {
      configure: vi.fn(),
      reset: vi.fn(),
      sync: vi.fn()
    }

    const adapters = createLiveQueryAdapters({ model, documents, factory, execution, scoring, book })

    expect(adapters.compatibility).toEqual({ model, documents, factory, execution })
    expect(adapters.scoring).toEqual(scoring)
    expect(adapters.book).toEqual(book)
  })

  it("does not require optional callback groups", () => {
    expect(createLiveQueryAdapters({})).toEqual({
      compatibility: {
        model: {},
        documents: {},
        factory: {},
        execution: {}
      },
      scoring: {
        getDefault: undefined,
        select: undefined,
        bootstrap: undefined
      },
      book: {
        configure: undefined,
        reset: undefined,
        sync: undefined
      }
    })
  })
})

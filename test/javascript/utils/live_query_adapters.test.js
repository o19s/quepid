import { describe, expect, it, vi } from "vitest"
import { createLiveQueryAdapters } from "utils/live_query_adapters"

describe("createLiveQueryAdapters", () => {
  it("keeps compatibility, scoring, and book callbacks in explicit groups", () => {
    const factoryOptions = { model: { getDefaultScorer: vi.fn() } }
    const executionOptions = { searchers: { create: vi.fn() } }
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

    const adapters = createLiveQueryAdapters({
      compatibility: { factoryOptions, executionOptions },
      scoring,
      book
    })

    expect(adapters.compatibility).toEqual({
      factoryOptions: {
        model: factoryOptions.model,
        documents: {},
        factory: {}
      },
      executionOptions: {
        settings: {},
        searchers: executionOptions.searchers,
        documents: {},
        errors: {}
      }
    })
    expect(adapters.scoring).toEqual(scoring)
    expect(adapters.book).toEqual(book)
  })

  it("does not require optional callback groups", () => {
    expect(createLiveQueryAdapters({})).toEqual({
      compatibility: {
        factoryOptions: {
          model: {},
          documents: {},
          factory: {}
        },
        executionOptions: {
          settings: {},
          searchers: {},
          documents: {},
          errors: {}
        }
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

import { describe, expect, it, vi } from "vitest"
import { createLiveQueryAdapters } from "utils/live_query_adapters"

describe("createLiveQueryAdapters", () => {
  it("keeps compatibility, scoring, and book callbacks in explicit groups", () => {
    const factoryOptions = { model: { getDefaultScorer: vi.fn() } }
    const executionOptions = { searchers: { create: vi.fn() } }
    const scoring = {
      getDefault: vi.fn(),
      select: vi.fn(),
      bootstrap: vi.fn(),
      run: vi.fn()
    }
    const book = {
      configure: vi.fn(),
      reset: vi.fn(),
      sync: vi.fn()
    }
    const search = {
      create: vi.fn(),
      createSnapshot: vi.fn()
    }
    const ratings = { request: vi.fn(), changed: vi.fn() }

    const adapters = createLiveQueryAdapters({
      compatibility: { factoryOptions, executionOptions },
      scoring,
      book,
      search,
      ratings
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
    expect(adapters.search).toEqual(search)
    expect(adapters.ratings).toEqual(ratings)
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
        bootstrap: undefined,
        run: undefined
      },
      book: {
        configure: undefined,
        reset: undefined,
        sync: undefined
      },
      search: {
        create: undefined,
        createSnapshot: undefined
      },
      ratings: {
        request: undefined,
        changed: undefined
      }
    })
  })
})

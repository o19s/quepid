import { describe, expect, it, vi } from "vitest"
import { createLiveQueryAdapters } from "utils/live_query_adapters"

describe("createLiveQueryAdapters", () => {
  it("keeps runtime, scoring, and book callbacks in explicit groups", () => {
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
    const framework = {
      request: vi.fn(),
      get: vi.fn(),
      promiseApi: {},
      schedule: vi.fn(),
      applyAsync: vi.fn(),
      logger: {},
      reject: vi.fn(),
      resolve: vi.fn()
    }
    const domain = {
      settings: { editable: vi.fn() },
      scorer: { getDefault: vi.fn() },
      navigation: { proxyUrlFor: vi.fn() },
      search: { create: vi.fn() },
      documents: { createDocList: vi.fn() }
    }

    const adapters = createLiveQueryAdapters({
      runtime: { factoryOptions, executionOptions },
      scoring,
      book,
      search,
      ratings,
      framework,
      domain
    })

    expect(adapters.runtime).toEqual({
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
    expect(adapters.framework).toEqual(framework)
    expect(adapters.domain).toEqual(domain)
  })

  it("does not require optional callback groups", () => {
    expect(createLiveQueryAdapters({})).toEqual({
      runtime: {
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
      },
      framework: {
        request: undefined,
        get: undefined,
        promiseApi: undefined,
        schedule: undefined,
        applyAsync: undefined,
        logger: undefined,
        reject: undefined,
        resolve: undefined
      },
      domain: {
        settings: {},
        scorer: {},
        navigation: {},
        search: {},
        documents: {}
      }
    })
  })
})

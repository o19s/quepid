import { describe, expect, it, vi } from "vitest"
import { createLiveQueryFactory } from "utils/live_query_factory"

describe("live query factory", () => {
  function setup() {
    const ratingsStore = { version: vi.fn().mockReturnValue(1) }
    const RatingsStore = vi.fn().mockImplementation(function() { return ratingsStore })
    const createModel = vi.fn().mockImplementation(({ getQueryState }) => ({
      score: vi.fn(),
      state: getQueryState
    }))
    const getQueryState = vi.fn().mockReturnValue("loaded")
    const getShowOnlyRated = vi.fn().mockReturnValue(false)
    const factory = createLiveQueryFactory({
      getCaseNo: vi.fn().mockReturnValue(7),
      getShowOnlyRated,
      RatingsStore,
      request: vi.fn(),
      onRatingChanged: vi.fn(),
      createModel,
      getQueryState
    })
    return { factory, ratingsStore, RatingsStore, createModel, getQueryState, getShowOnlyRated }
  }

  it("creates the shared live query shape and model methods", () => {
    const { factory, RatingsStore, createModel, getQueryState } = setup()

    const query = factory.create({
      queryId: 3,
      query_text: "star wars",
      ratings: { doc1: 2 },
      options: { field: "title" },
      modified_at: "2026-01-01"
    })

    expect(query.queryId).toBe(3)
    expect(query.caseNo).toBe(7)
    expect(query.queryText).toBe("star wars")
    expect(query.ratings).toEqual({ doc1: 2 })
    expect(query.docs).toEqual([])
    expect(query.ratedDocs).toEqual([])
    expect(query.options).toEqual({ field: "title" })
    expect(RatingsStore).toHaveBeenCalledOnce()
    expect(createModel).toHaveBeenCalledWith(expect.objectContaining({ query, ratingsStore: query.ratingsStore }))
    expect(getQueryState).not.toHaveBeenCalled()
    expect(query.score).toBeTypeOf("function")
  })

  it("uses the current rated-only URL when browsing", () => {
    const { factory, getShowOnlyRated } = setup()
    const query = factory.create({ queryId: 1, query_text: "test" })

    query.linkUrl = "all-results"
    query.ratedUrl = "rated-results"
    expect(query.browseUrl()).toBe("all-results")
    getShowOnlyRated.mockReturnValue(true)
    expect(query.browseUrl()).toBe("rated-results")
  })

  it("delegates query state evaluation to the injected adapter", () => {
    const { factory, getQueryState } = setup()
    const query = factory.create({ queryId: 1, query_text: "test" })

    expect(query.state()).toBe("loaded")
    expect(getQueryState).toHaveBeenCalledWith(query)
  })
})

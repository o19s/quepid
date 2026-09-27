import { describe, expect, it, vi } from "vitest"
import { createCaseScoringRuntime, scoreAllQueries, scoreQuery } from "utils/query_scoring"

describe("query scoring runtime", () => {
  it("scores a query and counts missing ratings only through the scorer depth", async () => {
    const docs = [{ hasRating: () => true }, { hasRating: () => false }, { hasRating: () => false }]
    const query = { docs, numFound: 3, options: {}, queryId: 7 }
    const scorer = { score: vi.fn(() => Promise.resolve(0.75)), maxScore: () => 1 }
    const ratingsStore = { bestDocs: () => [{ id: "rated", rating: 1 }] }

    const result = await scoreQuery({
      query,
      docs,
      ratingsStore,
      scorer,
      depthOfRating: 2
    })

    expect(scorer.score).toHaveBeenCalledWith(query, 3, docs, [{ id: "rated", rating: 1 }], {})
    expect(result).toMatchObject({ score: 0.75, maxScore: 1, allRated: false, countMissingRatings: 1 })
  })

  it("preserves zero scores and scorer max-score defaults", async () => {
    const query = { docs: [], numFound: 0, options: {} }
    const result = await scoreQuery({
      query,
      docs: [],
      ratingsStore: { bestDocs: () => [] },
      scorer: { score: () => Promise.resolve(0), maxScore: () => 0 }
    })

    expect(result.score).toBe(0)
    expect(result.maxScore).toBe(1)
  })

  it("checks every document when no rating depth is configured", async () => {
    const query = {
      docs: [{ hasRating: () => true }, { hasRating: () => false }],
      numFound: 2,
      options: {}
    }

    const result = await scoreQuery({
      query,
      docs: query.docs,
      ratingsStore: { bestDocs: () => [] },
      scorer: { score: () => Promise.resolve(1), maxScore: () => 1 }
    })

    expect(result.allRated).toBe(false)
    expect(result.countMissingRatings).toBe(1)
  })

  it("aggregates object collections, excludes null scores, and keeps sentinel averages", async () => {
    const logger = { log: vi.fn() }
    const result = await scoreAllQueries({
      scorableCollection: {
        first: {
          queryId: 1,
          queryText: "one",
          numFound: 4,
          score: () => Promise.resolve({ score: 0.5, maxScore: 1, allRated: true, countMissingRatings: 0 })
        },
        second: {
          queryId: 2,
          queryText: "two",
          numFound: 0,
          score: () => Promise.resolve({ score: null, maxScore: 1, allRated: false })
        },
        third: {
          queryId: 3,
          queryText: "three",
          numFound: 0,
          score: () => Promise.resolve({ score: "--", maxScore: 1, allRated: false })
        }
      },
      logger
    })

    expect(result).toEqual({
      allRated: false,
      score: 0.5,
      queries: {
        1: { score: 0.5, maxScore: 1, text: "one", numFound: 4, allRated: true, countMissingRatings: 0 },
        3: { score: "--", maxScore: 1, text: "three", numFound: 0, allRated: false, countMissingRatings: undefined }
      }
    })
    expect(logger.log).toHaveBeenCalledWith("Skipping null score in scoreAll calculation")
  })

  it("accepts array collections for explicit diff scoring", async () => {
    const result = await scoreAllQueries({
      scorableCollection: [
        { queryId: 9, score: () => Promise.resolve({ score: "zsr", allRated: true, maxScore: 1 }) }
      ]
    })

    expect(result.score).toBe("--")
    expect(result.queries[9].score).toBe("zsr")
  })

  it("scores the current collection and publishes completion metadata", async () => {
    const currentQueries = {
      first: {
        queryId: 1,
        queryText: "one",
        numFound: 1,
        score: () => Promise.resolve({ score: 1, maxScore: 1, allRated: true })
      }
    }
    const onComplete = vi.fn()
    const runtime = createCaseScoringRuntime({
      getScorables: () => currentQueries,
      onComplete
    })

    await runtime.scoreAll()

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ score: 1 }),
      { isFullScoreAll: true }
    )
  })

  it("marks explicit collections as partial scoring", async () => {
    const onComplete = vi.fn()
    const runtime = createCaseScoringRuntime({
      getScorables: () => [],
      onComplete
    })

    await runtime.scoreAll([
      { queryId: 2, score: () => Promise.resolve({ score: 0.5, maxScore: 1, allRated: true }) }
    ])

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({ score: 0.5 }),
      { isFullScoreAll: false }
    )
  })
})

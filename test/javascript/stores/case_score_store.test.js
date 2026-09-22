import { beforeEach, describe, expect, it, vi } from "vitest"
import { CaseScoreStore } from "stores/case_score_store"

/**
 * Unit contract for the dual-run shadow store (see
 * docs/todo/angularjs_removal_inventory.md § Re-render mechanism, step 3).
 * A fresh instance per test, not the page-scoped `caseScoreStore` singleton,
 * so tests can't leak state into each other.
 */
describe("CaseScoreStore", () => {
  let store

  beforeEach(() => {
    store = new CaseScoreStore()
  })

  it("starts with no case score and no query scores", () => {
    expect(store.caseScore).toBe(null)
    expect(store.queryScore("1")).toBe(null)
  })

  it("mirrors queriesSvc.latestScoreInfo's exact shape on setLatestScoreInfo", () => {
    store.setLatestScoreInfo({
      allRated: false,
      score: 0.75,
      queries: {
        1: { score: 0.5, maxScore: 1, text: "star wars", numFound: 8516 },
        2: { score: 1, maxScore: 1, text: "star trek", numFound: 42 }
      }
    })

    expect(store.caseScore).toEqual({ score: 0.75, allRated: false, maxScore: 1 })
    expect(store.queryScore(1)).toEqual({ score: 0.5, maxScore: 1, text: "star wars", numFound: 8516 })
    expect(store.queryScore("2")).toEqual({ score: 1, maxScore: 1, text: "star trek", numFound: 42 })
  })

  it("derives caseScore.maxScore as the average of each query's own maxScore", () => {
    store.setLatestScoreInfo({
      allRated: true,
      score: 0.5,
      queries: { 1: { score: 0, maxScore: 1 }, 2: { score: 1, maxScore: 3 } }
    })

    expect(store.caseScore.maxScore).toBe(2)
  })

  it("caseScore.maxScore is NaN when no query has a usable maxScore yet", () => {
    store.setLatestScoreInfo({ allRated: true, score: "--", queries: {} })

    expect(store.caseScore.maxScore).toBeNaN()
  })

  it("looks up a query score by string or number id the same way", () => {
    store.setLatestScoreInfo({ allRated: true, score: 1, queries: { 42: { score: 1 } } })

    expect(store.queryScore(42)).toEqual({ score: 1 })
    expect(store.queryScore("42")).toEqual({ score: 1 })
  })

  it("returns null for a query id that hasn't been scored", () => {
    store.setLatestScoreInfo({ allRated: true, score: "--", queries: {} })

    expect(store.queryScore("999")).toBe(null)
  })

  it("replaces the whole query-score set on each call, not merges it", () => {
    store.setLatestScoreInfo({ allRated: true, score: 1, queries: { 1: { score: 1 } } })
    store.setLatestScoreInfo({ allRated: true, score: 1, queries: { 2: { score: 1 } } })

    expect(store.queryScore("1")).toBe(null)
    expect(store.queryScore("2")).toEqual({ score: 1 })
  })

  it("fires one 'change' event per setLatestScoreInfo call, with a snapshot as detail", () => {
    const listener = vi.fn()
    store.addEventListener("change", listener)

    store.setLatestScoreInfo({ allRated: true, score: 1, queries: { 1: { score: 1 } } })

    expect(listener).toHaveBeenCalledOnce()
    expect(listener.mock.calls[0][0].detail).toEqual({
      caseScore: { score: 1, allRated: true, maxScore: NaN },
      queryScores: { 1: { score: 1 } }
    })
  })

  it("snapshot() reflects the current state without needing a change event", () => {
    store.setLatestScoreInfo({ allRated: false, score: "--", queries: { 3: { score: "--" } } })

    expect(store.snapshot()).toEqual({
      caseScore: { score: "--", allRated: false, maxScore: NaN },
      queryScores: { 3: { score: "--" } }
    })
  })
})

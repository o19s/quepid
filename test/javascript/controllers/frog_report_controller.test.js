import { describe, it, expect } from "vitest"
import { computeFrogStatistics } from "../../../app/javascript/controllers/frog_report_controller"

describe("computeFrogStatistics", () => {
  it("returns zeros for empty query data", () => {
    const stats = computeFrogStatistics([])
    expect(stats.totalRatingsNeeded).toBe(0)
    expect(stats.numberOfRatings).toBe(0)
    expect(stats.numberOfMissingRatings).toBe(0)
    expect(stats.missingRatingsRate).toBe(0)
    expect(stats.queriesWithResults).toBe(0)
    expect(stats.queriesWithoutResults).toBe(0)
    expect(stats.allRated).toBe(false)
    expect(stats.tableRows).toEqual([])
  })

  it("counts queries without results separately", () => {
    const stats = computeFrogStatistics([
      { docsCount: 0, ratedCount: 0 },
      { docsCount: 0, ratedCount: 0 },
      { docsCount: 5, ratedCount: 5 },
    ])
    expect(stats.queriesWithoutResults).toBe(2)
    expect(stats.queriesWithResults).toBe(1)
    expect(stats.totalRatingsNeeded).toBe(5)
  })

  it("computes allRated when everything is rated", () => {
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 10 },
      { docsCount: 5, ratedCount: 5 },
    ])
    expect(stats.allRated).toBe(true)
    expect(stats.numberOfMissingRatings).toBe(0)
    expect(stats.missingRatingsRate).toBe(0)
    expect(stats.tableRows).toEqual([{ category: "Fully Rated", amount: 2 }])
  })

  it("computes missing ratings rate correctly", () => {
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 8 },
      { docsCount: 10, ratedCount: 5 },
    ])
    expect(stats.totalRatingsNeeded).toBe(20)
    expect(stats.numberOfRatings).toBe(13)
    expect(stats.numberOfMissingRatings).toBe(7)
    // 7/20 = 35%
    expect(stats.missingRatingsRate).toBe(35)
    expect(stats.allRated).toBe(false)
  })

  it("rounds missingRatingsRate to one decimal", () => {
    // 1/3 ≈ 33.333...%
    const stats = computeFrogStatistics([{ docsCount: 3, ratedCount: 2 }])
    expect(stats.missingRatingsRate).toBe(33.3)
  })

  it("labels fully rated and no ratings buckets correctly", () => {
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 10 }, // missing 0 → "Fully Rated"
      { docsCount: 10, ratedCount: 0 }, // missing 10 → "No Ratings"
      { docsCount: 10, ratedCount: 7 }, // missing 3 → "Missing 3"
    ])
    expect(stats.tableRows).toEqual([
      { category: "Fully Rated", amount: 1 },
      { category: "Missing 3", amount: 1 },
      { category: "No Ratings", amount: 1 },
    ])
  })

  it("groups queries by missing count", () => {
    const stats = computeFrogStatistics([
      { docsCount: 5, ratedCount: 5 },
      { docsCount: 5, ratedCount: 5 },
      { docsCount: 5, ratedCount: 3 },
      { docsCount: 5, ratedCount: 3 },
      { docsCount: 5, ratedCount: 3 },
    ])
    // Two fully rated, three missing 2
    expect(stats.tableRows).toEqual([
      { category: "Fully Rated", amount: 2 },
      { category: "Missing 2", amount: 3 },
    ])
  })

  it("handles mixed depths correctly — fully unrated queries all get 'No Ratings'", () => {
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 0 }, // missing 10, fully unrated → "No Ratings"
      { docsCount: 5, ratedCount: 0 }, // missing 5, fully unrated → "No Ratings"
      { docsCount: 3, ratedCount: 3 }, // missing 0 → "Fully Rated"
    ])
    expect(stats.tableRows).toEqual([
      { category: "Fully Rated", amount: 1 },
      { category: "No Ratings", amount: 1 },
      { category: "No Ratings", amount: 1 },
    ])
  })

  it("labels mixed bucket as 'Missing N' when not all queries are fully unrated", () => {
    // Query A: 10 docs, 5 rated → missing 5 (partially rated)
    // Query B: 5 docs, 0 rated → missing 5 (fully unrated)
    // Both share bucket "missing 5", but Query A has ratings —
    // so the bucket gets "Missing 5", not "No Ratings".
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 5 },
      { docsCount: 5, ratedCount: 0 },
    ])
    expect(stats.tableRows).toEqual([{ category: "Missing 5", amount: 2 }])
  })

  it("sorts table rows by missing count ascending", () => {
    const stats = computeFrogStatistics([
      { docsCount: 10, ratedCount: 3 }, // missing 7
      { docsCount: 10, ratedCount: 8 }, // missing 2
      { docsCount: 10, ratedCount: 0 }, // missing 10 → "No Ratings"
      { docsCount: 10, ratedCount: 10 }, // missing 0 → "Fully Rated"
    ])
    const categories = stats.tableRows.map((r) => r.category)
    expect(categories).toEqual(["Fully Rated", "Missing 2", "Missing 7", "No Ratings"])
  })
})

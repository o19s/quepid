import { describe, expect, it } from "vitest"
import { buildFrogReportStats } from "controllers/frog_report_controller"

describe("buildFrogReportStats", () => {
  it("counts results, ratings, and missing ratings from document snapshots", () => {
    expect(buildFrogReportStats([
      { docs: [{ id: 1 }, { id: 2 }], depthOfRating: 2, missingRatings: 1 },
      { docs: [], depthOfRating: 2, missingRatings: 0 }
    ])).toEqual({
      withResults: 1,
      withoutResults: 1,
      ratingsNeeded: 2,
      missingRatings: 1,
      missingRate: 50,
      allRated: false
    })
  })

  it("avoids a NaN missing rate when there are no results", () => {
    expect(buildFrogReportStats([{ docs: [], depthOfRating: 10, missingRatings: 0 }])).toMatchObject({
      ratingsNeeded: 0,
      missingRate: 0
    })
  })

  it("recognizes fully rated queries", () => {
    expect(buildFrogReportStats([{ docs: [{ id: 1 }], missingRatings: 0, allRated: true }]).allRated).toBe(true)
  })
})

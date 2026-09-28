import { describe, expect, it, vi } from "vitest"
import { createScorer } from "utils/scorer_runtime"

const makeDoc = (rating) => ({
  doc: { id: String(rating) },
  hasRating: () => rating !== undefined,
  getRating: () => rating
})

describe("scorer runtime", () => {
  it("preserves scorer metadata and scale helpers without Angular", () => {
    const scorer = createScorer({
      name: "Useful scorer",
      communal: true,
      scale: [0, 1, 2],
      scale_with_labels: { 0: "No", 2: "Yes" },
      show_scale_labels: true,
      teams: [{ name: "Relevance" }]
    })

    expect(scorer.displayName).toBe("Useful scorer (Communal)")
    expect(scorer.teamNames()).toBe("Relevance")
    expect(scorer.scaleToArray("1, 2, 3")).toEqual([1, 2, 3])
    expect(scorer.showScaleLabel(0)).toBe(true)
    expect(scorer.getColors()[1]).toEqual({
      color: "hsl(60, 100%, 50%)",
      showScaleLabels: true,
      label: undefined
    })
  })

  it("runs custom scorer code with the documented query helpers", async () => {
    const scorer = createScorer({
      scale: [0, 1, 2],
      code: "setScore(avgRating() + topRatings(1)[0] + numFound() + (docExistsAt(0) ? 1 : 0))"
    })
    const query = { ratedDocs: [] }
    const docs = [makeDoc(1)]
    const bestDocs = [{ rating: 2 }]

    await expect(scorer.score(query, 10, docs, bestDocs)).resolves.toBe(14)
  })

  it("treats omitted best documents as an empty rating set", async () => {
    const scorer = createScorer({ scale: [0, 1], code: "setScore(null)" })

    await expect(scorer.score({ ratedDocs: [] }, 1, [makeDoc(undefined)])).resolves.toBe("--")
  })

  it("records ranking depth and rejects loops through the framework-free contract", async () => {
    const schedule = vi.fn((callback) => callback())
    const scorer = createScorer({
      scale: [0, 1],
      code: "setScore(1); var k = 7"
    }, { schedule })
    const query = { ratedDocs: [] }

    await scorer.score(query, 1, [], [])
    expect(query.depthOfRating).toBe(7)
    expect(schedule).toHaveBeenCalledOnce()

    scorer.code = "for (const item of docs) { setScore(item) }"
    await expect(scorer.checkCode()).rejects.toContain("Loops are currently not supported")
  })
})

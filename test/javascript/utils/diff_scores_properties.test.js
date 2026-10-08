import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildCaseDiffScores } from "utils/diff_scores"

const searcher = (name, diffScore) => ({ name: () => name, version: () => 1, diffScore })
const queryOf = (searchers) => ({
  diffs: { getSearchers: () => searchers, getSearcher: (index) => searchers[index] }
})

// One diff score per query for a single snapshot position. Eighths keep the
// mean exact.
const diffScore = fc.oneof(
  fc.record({
    score: fc.integer({ min: 0, max: 80 }).map((n) => n / 8),
    allRated: fc.boolean()
  }),
  fc.record({ score: fc.constantFrom("--", "zsr", null), allRated: fc.boolean() }),
  fc.constant(undefined)
)
const scores = fc.array(diffScore, { minLength: 1, maxLength: 12 })

const caseDiff = (perQuery) => buildCaseDiffScores(perQuery.map((s) => queryOf([searcher("Snap", s)])))[0].score

describe("buildCaseDiffScores properties", () => {
  it("averages exactly the numeric scores, or reports '--' when there are none", () => {
    fc.assert(
      fc.property(scores, (perQuery) => {
        const numbers = perQuery.filter((s) => typeof s?.score === "number").map((s) => s.score)
        const { score } = caseDiff(perQuery)

        if (numbers.length === 0) expect(score).toBe("--")
        else expect(score).toBe(numbers.reduce((a, b) => a + b, 0) / numbers.length)
      })
    )
  })

  it("is all-rated only when no query with a diff score is partially rated", () => {
    fc.assert(
      fc.property(scores, (perQuery) => {
        const expected = perQuery.every((s) => !s || s.allRated)

        expect(caseDiff(perQuery).allRated).toBe(expected)
      })
    )
  })

  it("is independent of query order", () => {
    fc.assert(
      fc.property(scores, (perQuery) => {
        expect(caseDiff([...perQuery].reverse())).toEqual(caseDiff(perQuery))
      })
    )
  })
})

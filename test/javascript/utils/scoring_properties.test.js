import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { averageMaxScore, averageScore, formatScore, isUnratedScore, scoreToColor } from "utils/scoring"

// Eighths are exactly representable, so sums and means are order-independent
// and bounded without floating-point tolerance.
const numericScore = fc.integer({ min: -800, max: 800 }).map((n) => n / 8)
const sentinel = fc.constantFrom("zsr", "--", null, undefined)
const mixedScores = fc.array(fc.oneof(numericScore, sentinel), { maxLength: 30 })
const isNumber = (score) => typeof score === "number"

describe("averageScore properties", () => {
  it("is '--' exactly when there are no numeric scores", () => {
    fc.assert(
      fc.property(mixedScores, (scores) => {
        expect(averageScore(scores) === "--").toBe(!scores.some(isNumber))
      })
    )
  })

  it("stays within the min and max of the numeric scores", () => {
    fc.assert(
      fc.property(mixedScores, (scores) => {
        const numbers = scores.filter(isNumber)
        fc.pre(numbers.length > 0)

        const average = averageScore(scores)
        expect(average).toBeGreaterThanOrEqual(Math.min(...numbers))
        expect(average).toBeLessThanOrEqual(Math.max(...numbers))
      })
    )
  })

  it("ignores sentinels and ordering", () => {
    fc.assert(
      fc.property(mixedScores, (scores) => {
        expect(averageScore([...scores].reverse())).toEqual(averageScore(scores))
        expect(averageScore(scores)).toEqual(averageScore(scores.filter(isNumber)))
      })
    )
  })
})

describe("averageMaxScore properties", () => {
  it("is NaN for no usable entries, otherwise at least 1", () => {
    const entry = fc.record({ maxScore: fc.oneof(fc.integer({ min: -50, max: 500 }).map((n) => n / 8), fc.constant(null), fc.constant(undefined)) })
    fc.assert(
      fc.property(fc.dictionary(fc.stringMatching(/^[0-9]{1,4}$/), entry, { maxKeys: 10 }), (scores) => {
        const usable = Object.values(scores).filter((e) => e.maxScore != null)
        const result = averageMaxScore(scores)

        if (usable.length === 0) expect(result).toBeNaN()
        else expect(result).toBeGreaterThanOrEqual(1)
      })
    )
  })
})

describe("scoreToColor properties", () => {
  const maxScore = fc.integer({ min: 1, max: 400 }).map((n) => n / 4)

  it("returns a color string for every score from 0 up to and beyond the max", () => {
    fc.assert(
      fc.property(maxScore, fc.double({ min: 0, max: 1000, noNaN: true }), (max, score) => {
        expect(scoreToColor(score, max)).toEqual(expect.any(String))
      })
    )
  })

  it("treats scores above the max the same as the max", () => {
    fc.assert(
      fc.property(maxScore, fc.integer({ min: 0, max: 1000 }), (max, extra) => {
        expect(scoreToColor(max + extra, max)).toBe(scoreToColor(max, max))
      })
    )
  })

  it("gives sentinels a color without consulting maxScore", () => {
    fc.assert(
      fc.property(fc.constantFrom("zsr", "--", "?", null), fc.anything(), (score, max) => {
        expect(scoreToColor(score, max)).toEqual(expect.any(String))
      })
    )
  })
})

describe("formatScore properties", () => {
  it("passes non-numbers through and formats every finite number with two decimals", () => {
    fc.assert(
      fc.property(fc.double({ noNaN: true, noDefaultInfinity: true, min: -1e9, max: 1e9 }), (score) => {
        expect(formatScore(score)).toMatch(/^-?[\d,]+\.\d{2}$/)
      })
    )
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)), (score) => {
        expect(formatScore(score)).toBe(score)
        expect(isUnratedScore(score)).toBe(score === "zsr" || score === "--")
      })
    )
  })
})

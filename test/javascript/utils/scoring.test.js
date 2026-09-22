import { describe, expect, it } from "vitest"
import {
  averageMaxScore,
  averageScore,
  formatScore,
  isNotAllRated,
  isUnratedScore,
  ratingBackgroundColor,
  scoreToColor
} from "utils/scoring"

/**
 * Unit contract for the score display/aggregation rules extracted from Angular's
 * `scoreDisplay` / `ratingBgStyle` filters and `queriesSvc.scoreAll()`. None of
 * this had Vitest coverage before; `ratingBgStyle_spec.js` (Karma) only asserts
 * a background-color key exists, not which color, so this is the first real
 * coverage of the rating-scale lookup and the sentinel-exclusion averaging.
 */
describe("scoring", () => {
  describe("isUnratedScore", () => {
    it("is true for the not-yet-rated sentinels", () => {
      expect(isUnratedScore("zsr")).toBe(true)
      expect(isUnratedScore("--")).toBe(true)
    })

    it("is false for a numeric score, null, or undefined", () => {
      expect(isUnratedScore(0)).toBe(false)
      expect(isUnratedScore(1)).toBe(false)
      expect(isUnratedScore(null)).toBe(false)
      expect(isUnratedScore(undefined)).toBe(false)
    })
  })

  describe("formatScore", () => {
    it("formats a number to two decimal places with thousands grouping", () => {
      expect(formatScore(1)).toBe("1.00")
      expect(formatScore(0.5)).toBe("0.50")
      expect(formatScore(1234.567)).toBe("1,234.57")
    })

    it("passes sentinel and non-numeric values through unchanged", () => {
      expect(formatScore("zsr")).toBe("zsr")
      expect(formatScore("--")).toBe("--")
      expect(formatScore(null)).toBe(null)
      expect(formatScore(undefined)).toBe(undefined)
    })

    it("renders NaN as an empty string, matching AngularJS's number filter", () => {
      // AngularJS's formatNumber() explicitly returns '' for isNaN(number);
      // Number.prototype.toLocaleString has no such guard and would
      // otherwise render the literal string "NaN". Reachable via a custom
      // scorer whose eval'd code divides by zero (ScorerFactory.js's
      // score() treats NaN as angular.isNumber() === true and returns it
      // uncoerced).
      expect(formatScore(NaN)).toBe("")
    })

    it("still renders Infinity using Angular's infinity symbol", () => {
      expect(formatScore(Infinity)).toBe("∞")
      expect(formatScore(-Infinity)).toBe("-∞")
    })
  })

  describe("ratingBackgroundColor", () => {
    it("looks up a color for every rating 1-10 on the default scale", () => {
      for (let rating = 1; rating <= 10; rating++) {
        expect(ratingBackgroundColor({ rating })).toEqual({
          "background-color": expect.stringMatching(/^#[0-9a-f]{6}$/)
        })
      }
    })

    it("falls back to grey for an unrated or out-of-scale rating", () => {
      expect(ratingBackgroundColor({ rating: undefined })).toEqual({ "background-color": "#777" })
      expect(ratingBackgroundColor({ rating: 99 })).toEqual({ "background-color": "#777" })
      expect(ratingBackgroundColor()).toEqual({ "background-color": "#777" })
    })

    it("uses a custom scorer's scale instead of the default when one is given", () => {
      const scale = { 1: { color: "#111111" } }
      expect(ratingBackgroundColor({ rating: 1, scale })).toEqual({ "background-color": "#111111" })
      // The custom scale doesn't define rating 2, so it falls back to grey
      // rather than the default scale's color for 2.
      expect(ratingBackgroundColor({ rating: 2, scale })).toEqual({ "background-color": "#777" })
    })
  })

  describe("scoreToColor", () => {
    it("returns a gray for the not-yet-scored ('?') and null states", () => {
      expect(scoreToColor("?", 100)).toBe("hsl(0, 0%, 0%, 0.5)")
      expect(scoreToColor(null, 100)).toBe("hsl(0, 0%, 0%, 0.5)")
    })

    it("returns a lighter gray for the 'scored, nothing rated' sentinels", () => {
      expect(scoreToColor("zsr", 100)).toBe("hsl(0, 0%, 91%)")
      expect(scoreToColor("--", 100)).toBe("hsl(0, 0%, 91%)")
    })

    it("scales from red at 0 to green at maxScore", () => {
      expect(scoreToColor(0, 100)).toBe("hsl(5, 95%, 45%)")
      expect(scoreToColor(100, 100)).toBe("hsl(100, 90%, 35%)")
    })

    it("truncates (not rounds) the percentage before dividing by 10, matching qscoreSvc.scoreToColor", () => {
      // 55/100 = 55% -> parseInt(55, 10) = 55 -> 55/10 = 5.5 -> round -> step 6
      expect(scoreToColor(55, 100)).toBe("hsl(60, 55%, 65%)")
      // 54.9/100 = 54.9% -> parseInt(54.9, 10) = 54 -> 54/10 = 5.4 -> round -> step 5
      expect(scoreToColor(54.9, 100)).toBe("hsl(28, 65%, 75%)")
    })

    it("caps a score above maxScore at maxScore's color (e.g. switching from a nonbinary to a binary scorer)", () => {
      expect(scoreToColor(150, 100)).toBe(scoreToColor(100, 100))
    })
  })

  describe("averageScore", () => {
    it("averages only the numeric scores", () => {
      expect(averageScore([1, 2, 3])).toBe(2)
    })

    it("excludes 'zsr' and '--' sentinels from the average", () => {
      expect(averageScore([1, "zsr", 3, "--"])).toBe(2)
    })

    it("returns '--' when every score is a sentinel", () => {
      expect(averageScore(["zsr", "--", "zsr"])).toBe("--")
    })

    it("excludes null (queriesSvc.scoreAll()'s 'skip this scorable' case) without diluting the average", () => {
      // isUnratedScore(null) is false — null isn't a sentinel string — so the
      // numeric-type check has to do this exclusion on its own; a version of
      // averageScore built only on isUnratedScore would double-count here.
      expect(averageScore([2, null, 4])).toBe(3)
    })

    it("returns '--' for an empty list (no queries scored yet)", () => {
      expect(averageScore([])).toBe("--")
    })
  })

  describe("isNotAllRated", () => {
    it("is false when there is no score entry yet (query not searched/scored)", () => {
      expect(isNotAllRated(null)).toBe(false)
      expect(isNotAllRated(undefined)).toBe(false)
    })

    it("is false when the score is explicitly null (scoring hasn't resolved)", () => {
      expect(isNotAllRated({ score: null, allRated: false, countMissingRatings: 3 })).toBe(false)
    })

    it("is false once every result is rated", () => {
      expect(isNotAllRated({ score: 1, allRated: true, countMissingRatings: 0 })).toBe(false)
    })

    it("is true when scored but results remain unrated", () => {
      expect(isNotAllRated({ score: 0.5, allRated: false, countMissingRatings: 2 })).toBe(true)
    })
  })

  describe("averageMaxScore", () => {
    it("averages each query's own maxScore", () => {
      expect(averageMaxScore({ 1: { maxScore: 1 }, 2: { maxScore: 3 } })).toBe(2)
    })

    it("excludes entries with a null or undefined maxScore", () => {
      expect(
        averageMaxScore({
          1: { maxScore: 2 },
          2: { maxScore: null },
          3: { maxScore: undefined },
          4: { maxScore: 4 }
        })
      ).toBe(3)
    })

    it("floors the average at 1, e.g. for a 0-to-1-scale scorer averaging below 1", () => {
      expect(averageMaxScore({ 1: { maxScore: 0.5 } })).toBe(1)
    })

    it("returns NaN when no entry has a usable maxScore, matching queriesCtrl.js's runScore() leaving $scope.maxScore unset", () => {
      expect(averageMaxScore({})).toBeNaN()
      expect(averageMaxScore({ 1: { maxScore: null } })).toBeNaN()
    })
  })
})

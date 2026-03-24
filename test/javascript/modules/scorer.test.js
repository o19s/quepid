import { describe, it, expect } from "vitest"
import { scaleToColors, ratingColor, scoreToColor } from "modules/scorer"

describe("scaleToColors", () => {
  it("builds HSL color map from a scale array", () => {
    const colors = scaleToColors([0, 1, 2, 3])
    expect(colors[0]).toBe("hsl(0, 100%, 50%)")
    expect(colors[3]).toBe("hsl(120, 100%, 50%)")
  })

  it("handles two-value scale", () => {
    const colors = scaleToColors([0, 1])
    expect(colors[0]).toBe("hsl(0, 100%, 50%)")
    expect(colors[1]).toBe("hsl(120, 100%, 50%)")
  })

  it("handles string values in scale", () => {
    const colors = scaleToColors(["0", "1", "2", "3"])
    expect(colors[0]).toBe("hsl(0, 100%, 50%)")
    expect(colors[3]).toBe("hsl(120, 100%, 50%)")
  })

  it("returns empty map for empty or undefined scale", () => {
    expect(scaleToColors([])).toEqual({})
    expect(scaleToColors(null)).toEqual({})
    expect(scaleToColors(undefined)).toEqual({})
  })

  it("handles single-value scale without NaN", () => {
    const colors = scaleToColors([0])
    // range is 0, so hue = NaN → fallback to 0
    expect(colors[0]).toBe("hsl(0, 100%, 50%)")
  })
})

describe("ratingColor", () => {
  const colorMap = scaleToColors([0, 1, 2, 3])

  it("returns color for a rated value", () => {
    expect(ratingColor(0, colorMap)).toBe("hsl(0, 100%, 50%)")
    expect(ratingColor(3, colorMap)).toBe("hsl(120, 100%, 50%)")
  })

  it("returns gray for null or undefined", () => {
    expect(ratingColor(null, colorMap)).toBe("#777")
    expect(ratingColor(undefined, colorMap)).toBe("#777")
  })

  it("returns gray for a value not in the map", () => {
    expect(ratingColor(99, colorMap)).toBe("#777")
  })
})

describe("scoreToColor", () => {
  it("matches Angular qscoreSvc decile buckets (max score → bucket 10)", () => {
    expect(scoreToColor(100, 100)).toBe("hsl(100, 90%, 35%)")
  })

  it("maps zero score to bucket 0", () => {
    expect(scoreToColor(0, 100)).toBe("hsl(5, 95%, 45%)")
  })

  it("returns gray for null score", () => {
    expect(scoreToColor(null, 100)).toBe("#999")
  })

  it("returns gray when maxScore is 0", () => {
    expect(scoreToColor(5, 0)).toBe("#999")
  })

  it("clamps high scores to max then buckets; negative scores use bucket -1", () => {
    expect(scoreToColor(200, 100)).toBe("hsl(100, 90%, 35%)")
    expect(scoreToColor(-10, 100)).toBe("hsl(0, 100%, 40%)")
  })

  it("AP@10-style 0.46 on 0–1 scale matches Angular mid bucket", () => {
    expect(scoreToColor(0.46, 1)).toBe("hsl(28, 65%, 75%)")
  })
})

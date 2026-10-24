import { describe, expect, it } from "vitest"
import { graphData, graphSpec } from "utils/qgraph"

describe("qgraph", () => {
  it("uses the ten most recent scores in chronological order", () => {
    const scores = Array.from({ length: 11 }, (_, index) => ({
      score: index,
      updated_at: `2026-01-${String(index + 1).padStart(2, "0")}`
    })).reverse()

    expect(graphData(scores).scoreData).toHaveLength(10)
    expect(graphData(scores).scoreData[0]).toEqual({ index: 0, score: 1 })
    expect(graphData(scores).scoreData.at(-1)).toEqual({ index: 9, score: 10 })
  })

  it("snaps annotations to the nearest displayed score and excludes older ones", () => {
    const scores = [
      { score: 0.2, updated_at: "2026-01-01T00:00:00Z" },
      { score: 0.8, updated_at: "2026-01-02T00:00:00Z" }
    ]
    const annotations = [
      { message: "old", updatedAt: "2025-12-31T00:00:00Z" },
      { message: "near second", updatedAt: "2026-01-01T20:00:00Z" }
    ]

    expect(graphData(scores, annotations).annotationData).toEqual([
      { index: 1, message: "near second" }
    ])
  })

  it("keeps a flat zero-score history renderable", () => {
    const { scoreData } = graphData([
      { score: 0, updated_at: "2026-01-01T00:00:00Z" },
      { score: 0, updated_at: "2026-01-02T00:00:00Z" }
    ])

    expect(scoreData).toHaveLength(2)
    expect(graphSpec(scoreData, [], 1, 140, 72, { top: 4, right: 6, bottom: 4, left: 4 }).layer).toHaveLength(2)
  })
})

export function graphData(scores = [], annotations = []) {
  const sortedScores = scores
    .filter((score) => score?.updated_at)
    .slice()
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at))
  const lastTenScores = sortedScores.slice(-10)

  const scoreData = lastTenScores.map((score, index) => ({
    index,
    score: score.score
  }))

  const minDate = lastTenScores[0] ? new Date(lastTenScores[0].updated_at) : null
  const annotationData = annotations
    .filter(
      (annotation) => annotation.updatedAt && minDate && new Date(annotation.updatedAt) >= minDate
    )
    .map((annotation) => {
      const annotationTime = new Date(annotation.updatedAt).getTime()
      const nearest = lastTenScores.reduce(
        (match, score, index) => {
          const distance = Math.abs(new Date(score.updated_at).getTime() - annotationTime)
          return distance < match.distance ? { index, distance } : match
        },
        { index: 0, distance: Infinity }
      )

      return { index: nearest.index, message: annotation.message }
    })

  return { scoreData, annotationData }
}

export function graphSpec(scoreData, annotationData, maxScore, width, height, margin) {
  const lastIndex = scoreData.length - 1
  const xScale = { domain: [0, lastIndex || 1], nice: false }

  return {
    $schema: "https://vega.github.io/schema/vega-lite/v6.json",
    width,
    height,
    autosize: { type: "none" },
    padding: margin,
    background: null,
    layer: [
      {
        data: { values: scoreData },
        mark: { type: "line", interpolate: "linear" },
        encoding: {
          x: { field: "index", type: "quantitative", scale: xScale, axis: null },
          y: {
            field: "score",
            type: "quantitative",
            scale: { domain: [0, maxScore] },
            axis: null
          }
        }
      },
      {
        data: { values: annotationData },
        mark: { type: "rule" },
        encoding: {
          x: { field: "index", type: "quantitative", scale: xScale, axis: null },
          tooltip: { field: "message", type: "nominal" }
        }
      }
    ],
    config: { view: { stroke: "transparent" } }
  }
}

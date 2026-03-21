import { describe, it, expect } from "vitest"
import { runScorerCode, computeCaseScore } from "modules/scorer_executor"

describe("runScorerCode", () => {
  const scale = [0, 1, 2, 3]

  it("returns '--' when no ratings exist", () => {
    const code = "setScore(avgRating());"
    const docs = [{ id: "doc1" }, { id: "doc2" }]
    const ratings = {}
    const bestDocs = []

    const result = runScorerCode(code, scale, docs, ratings, 2, bestDocs)
    expect(result).toBe("--")
  })

  it("returns 'zsr' when no docs exist", () => {
    const code = "setScore(avgRating());"
    const result = runScorerCode(code, scale, [], {}, 0, [])
    expect(result).toBe("zsr")
  })

  it("computes a simple average rating", () => {
    const code = "setScore(avgRating());"
    const docs = [{ id: "doc1" }, { id: "doc2" }, { id: "doc3" }]
    const ratings = { doc1: 3, doc2: 1 }
    const bestDocs = [{ docId: "doc1", rating: 3 }, { docId: "doc2", rating: 1 }]

    const result = runScorerCode(code, scale, docs, ratings, 3, bestDocs)
    expect(result).toBe(2) // (3 + 1) / 2
  })

  it("runs setScore with a literal value", () => {
    const code = "setScore(42);"
    const docs = [{ id: "doc1" }]
    const ratings = { doc1: 2 }
    const bestDocs = [{ docId: "doc1", rating: 2 }]

    // 42 > maxScale(3) so it gets clamped
    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBe(3)
  })

  it("clamps negative scores to 0", () => {
    const code = "setScore(-5);"
    const docs = [{ id: "doc1" }]
    const ratings = { doc1: 1 }
    const bestDocs = [{ docId: "doc1", rating: 1 }]

    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBe(0)
  })

  it("runs eachDoc and docRating helpers", () => {
    const code = `
      var sum = 0;
      var count = 0;
      eachDoc(function(doc, i) {
        if (hasDocRating(i)) {
          sum += docRating(i);
          count++;
        }
      }, 10);
      setScore(count > 0 ? sum / count : null);
    `
    const docs = [{ id: "d1" }, { id: "d2" }, { id: "d3" }]
    const ratings = { d1: 2, d3: 3 }
    const bestDocs = [{ docId: "d3", rating: 3 }, { docId: "d1", rating: 2 }]

    const result = runScorerCode(code, scale, docs, ratings, 3, bestDocs)
    expect(result).toBe(2.5) // (2 + 3) / 2
  })

  it("supports eachDocWithRating for bestDocs iteration", () => {
    const code = `
      var totalRel = 0;
      eachDocWithRating(function(doc) {
        if (doc.rating > 0) totalRel++;
      });
      setScore(totalRel);
    `
    const docs = [{ id: "d1" }]
    const ratings = { d1: 2 }
    const bestDocs = [
      { docId: "d1", rating: 2 },
      { docId: "d2", rating: 1 },
      { docId: "d3", rating: 0 },
    ]

    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBe(2) // d1 (2>0) and d2 (1>0), d3 (0, not >0)
  })

  it("supports topRatings helper", () => {
    const code = `
      var top = topRatings(3);
      setScore(top.length);
    `
    const docs = [{ id: "d1" }]
    const ratings = { d1: 2 }
    const bestDocs = [
      { docId: "d1", rating: 3 },
      { docId: "d2", rating: 2 },
    ]

    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBe(2)
  })

  it("supports numFound and numReturned", () => {
    const code = "setScore(numFound() > numReturned() ? 1 : 0);"
    const docs = [{ id: "d1" }]
    const ratings = { d1: 1 }
    const bestDocs = [{ docId: "d1", rating: 1 }]

    const result = runScorerCode(code, scale, docs, ratings, 100, bestDocs)
    expect(result).toBe(1)
  })

  it("returns null on code error", () => {
    const code = "throw new Error('bad scorer');"
    const docs = [{ id: "d1" }]
    const ratings = { d1: 1 }
    const bestDocs = [{ docId: "d1", rating: 1 }]

    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBeNull()
  })

  it("returns null for null/undefined code", () => {
    expect(runScorerCode(null, scale, [], {}, 0, [])).toBeNull()
    expect(runScorerCode(undefined, scale, [], {}, 0, [])).toBeNull()
  })

  it("supports pass() and fail() for unit-test-style scorers", () => {
    const code = "pass();"
    const docs = [{ id: "d1" }]
    const ratings = { d1: 1 }
    const bestDocs = [{ docId: "d1", rating: 1 }]

    // pass() sets score to 100, clamped to max scale (3)
    const result = runScorerCode(code, scale, docs, ratings, 1, bestDocs)
    expect(result).toBe(3)
  })
})

describe("computeCaseScore", () => {
  it("returns null for empty query scores", () => {
    const result = computeCaseScore({})
    expect(result).toEqual({ score: null, allRated: false })
  })

  it("averages numeric query scores", () => {
    const result = computeCaseScore({
      1: { score: 0.5, text: "q1" },
      2: { score: 1.0, text: "q2" },
      3: { score: 0.75, text: "q3" },
    })
    expect(result.score).toBeCloseTo(0.75)
    expect(result.allRated).toBe(true)
  })

  it("ignores non-numeric scores in the average", () => {
    const result = computeCaseScore({
      1: { score: 0.8, text: "q1" },
      2: { score: null, text: "q2" },
    })
    expect(result.score).toBe(0.8)
    expect(result.allRated).toBe(false)
  })

  it("returns null when all scores are non-numeric", () => {
    const result = computeCaseScore({
      1: { score: null, text: "q1" },
      2: { score: null, text: "q2" },
    })
    expect(result).toEqual({ score: null, allRated: false })
  })
})

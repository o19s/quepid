import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"
import { createScorer } from "utils/scorer_runtime"

const makeDoc = (rating) => ({
  doc: { id: String(rating) },
  hasRating: () => rating !== undefined,
  getRating: () => rating
})

describe("scorer runtime", () => {
  it("preserves scorer metadata and scale helpers without a framework", () => {
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

  it("does not cap scores at the rating scale max", async () => {
    const code = readFileSync("db/scorers/cg@10.js", "utf8")
    const scorer = createScorer({ scale: [0, 1, 2, 3], code })
    const docs = [makeDoc(3), makeDoc(3), makeDoc(2)]

    await expect(scorer.score({ ratedDocs: [] }, 3, docs, [])).resolves.toBe(8)
  })

  it("clips negative scores to zero", async () => {
    const scorer = createScorer({ scale: [0, 1, 2, 3], code: "setScore(-5)" })

    await expect(scorer.score({ ratedDocs: [] }, 1, [makeDoc(1)], [])).resolves.toBe(0)
  })

  it("exposes the scale maximum to scorer code as max", async () => {
    const code = readFileSync("db/scorers/err@10.js", "utf8")
    const scorer = createScorer({ scale: [0, 1, 2, 3], code })
    const docs = [makeDoc(3), makeDoc(0)]

    await expect(scorer.score({ ratedDocs: [] }, 2, docs, [])).resolves.toBe(0.875)
    expect(scorer.error).toBeFalsy()
  })

  it("lets scorer code redeclare helper names with let or const", async () => {
    const scorer = createScorer({ scale: [0, 1, 2, 3], code: "const max = 5; setScore(max)" })

    await expect(scorer.score({ ratedDocs: [] }, 1, [makeDoc(1)], [])).resolves.toBe(5)
    expect(scorer.error).toBeFalsy()
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

  // Hand-computed for returned ratings [3, 0, 2] and best ratings [3, 2, 1] on a 0-3 scale.
  it.each([
    ["p@10", 2 / 3],
    ["rr@10", 1],
    ["ap@10", (1 + 2 / 3) / 3],
    ["dcg@10", 7 + 3 / 2],
    ["ndcg@10", 8.5 / (7 + 3 / Math.log2(3) + 1 / 2)],
    ["ndcg_cut@10", 8.5 / (7 + 3 / Math.log2(3) + 1 / 2)],
    // floor(avg 5/3 scaled to 100 over max 3) = 55, minus edit distance 2 from [3, 2, 1].
    ["v1", 53]
  ])("scores the built-in %s scorer", async (name, expected) => {
    const code = readFileSync(`db/scorers/${name}.js`, "utf8")
    const scorer = createScorer({ scale: [0, 1, 2, 3], code })
    const docs = [makeDoc(3), makeDoc(0), makeDoc(2)]
    const bestDocs = [{ rating: 3 }, { rating: 2 }, { rating: 1 }]

    const score = await scorer.score({ ratedDocs: [] }, 3, docs, bestDocs)

    expect(scorer.error).toBeFalsy()
    expect(score).toBeCloseTo(expected, 10)
  })

  it("exposes rated-doc, rating-filter, and option helpers to scorer code", async () => {
    const scorer = createScorer({
      scale: [0, 1, 2, 3],
      code: `
        const ids = []
        eachRatedDoc(function (doc, i) { ids.push(doc.id + "@" + i) }, 2)
        let threes = 0
        eachDocWithRatingEqualTo(3, function () { threes += 1 })
        setScore([ids.join(","), threes, qOption("boost"), qOption("missing"), docAt(5).id, docRating(9)].join("|"))
      `
    })
    const query = { ratedDocs: [{ id: "a" }, { id: "b" }, { id: "c" }] }

    const result = await scorer.runCode(query, 1, [makeDoc(1)], [{ rating: 3 }, { rating: 1 }, { rating: 3 }], undefined, { boost: 2 })

    expect(result).toBe("a@0,b@1|2|2|||")
  })

  it("lets scorer code pass, fail, and short-circuit with assertions", async () => {
    const run = (code) => createScorer({ scale: [0, 1], code }).runCode({ ratedDocs: [] }, 1, [makeDoc(1)], [])

    await expect(run("pass()")).resolves.toBe(100)
    await expect(run("fail()")).rejects.toBe(0)
    await expect(run("assert(true); setScore(7)")).resolves.toBe(7)
    await expect(run("assert(false); setScore(7)")).rejects.toBe(0)
    await expect(run("assertOrScore(false, 3); setScore(7)")).resolves.toBe(3)
    await expect(run("assertOrScore(true, 3); setScore(7)")).resolves.toBe(7)
  })

  it("scores every document at the scale max in max mode without mutating the originals", async () => {
    const scorer = createScorer({ scale: [0, 1, 2, 3], code: "setScore(avgRating())" })
    const docs = [makeDoc(1), makeDoc(0)]

    await expect(scorer.runCode({ ratedDocs: [] }, 2, docs, [], "max")).resolves.toBe(3)
    expect(docs[0].getRating()).toBe(1)
    // pass()-style scorers short-circuit to 100 synchronously instead of running.
    expect(createScorer({ scale: [0, 1], code: "pass()" }).runCode({ ratedDocs: [] }, 1, docs, [], "max")).toBe(100)
  })

  it("records a scorer error and returns null when scorer code throws", async () => {
    const scorer = createScorer({ scale: [0, 1], code: "throw new Error('bad scorer')" })

    await expect(scorer.score({ ratedDocs: [] }, 1, [makeDoc(1)], [])).resolves.toBeNull()
    expect(scorer.error).toBeInstanceOf(Error)
    expect(scorer.error.message).toBe("bad scorer")
  })

  it("reports zero-results and unrated queries distinctly when the scorer returns null", async () => {
    const scorer = createScorer({ scale: [0, 1], code: "setScore(null)" })

    await expect(scorer.score({ ratedDocs: [] }, 0, [], [{ rating: 1 }])).resolves.toBe("zsr")
    await expect(scorer.score({ ratedDocs: [] }, 1, [makeDoc(1)], [{ rating: 1 }])).resolves.toBeNull()
  })

  it("delegates rated-document refresh through the injected capability", async () => {
    const refreshRatedDocs = vi.fn().mockResolvedValue(undefined)
    const scorer = createScorer({
      scale: [0, 1],
      code: "refreshRatedDocs(25); setScore(1)"
    }, { refreshRatedDocs })
    const query = { queryId: 7, ratedDocs: [] }

    await scorer.score(query, 1, [], [])

    expect(refreshRatedDocs).toHaveBeenCalledWith(7, 25)
  })
})

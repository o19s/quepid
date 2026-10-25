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
  describe("scale helpers", () => {
    const scorer = (overrides = {}) => createScorer({ scale: [0, 1], ...overrides })

    it("parses comma separated scales regardless of surrounding whitespace", () => {
      const s = scorer()
      expect(s.scaleToArray("1,2,3")).toEqual([1, 2, 3])
      expect(s.scaleToArray(" 1 ,  2 , 3 ")).toEqual([1, 2, 3])
    })

    it("maps scale values to hues relative to the range, even for offset scales", () => {
      const s = scorer()
      expect(s.scaleToColors([1, 2, 3])).toEqual({
        1: { color: "hsl(0, 100%, 50%)" },
        2: { color: "hsl(60, 100%, 50%)" },
        3: { color: "hsl(120, 100%, 50%)" }
      })
      expect(s.scaleToColors("1, 2, 3")[2].color).toBe("hsl(60, 100%, 50%)")
      expect(s.scaleToColors([4])[4].color).toBe("hsl(0, 100%, 50%)")
      expect(s.scaleToColors([])).toEqual({})
      expect(s.scaleToColors(undefined)).toEqual({})
    })

    it("adds labels to colors only when label display is on and labels exist", () => {
      const colors = scorer({ scale_with_labels: { 0: "No", 1: "Yes" }, show_scale_labels: true }).getColors()
      expect(colors[1]).toEqual({ color: "hsl(120, 100%, 50%)", showScaleLabels: true, label: "Yes" })
      expect(scorer({ scale_with_labels: { 0: "No" }, show_scale_labels: false }).getColors()[0]).toEqual({
        color: "hsl(0, 100%, 50%)"
      })
    })

    it("only shows a label when display is on, labels exist and the value has one", () => {
      const labelled = { scale_with_labels: { 0: "No" }, show_scale_labels: true }
      expect(scorer(labelled).showScaleLabel(0)).toBe(true)
      expect(scorer(labelled).showScaleLabel(1)).toBe(false)
      expect(scorer({ ...labelled, show_scale_labels: false }).showScaleLabel(0)).toBe(false)
      expect(scorer({ show_scale_labels: true, scale_with_labels: null }).showScaleLabel(0)).toBe(false)
    })

    it("fills in blank labels for scale values that lack one", () => {
      const s = scorer()
      expect(s.scaleToScaleWithLabels("0, 1,2", null)).toEqual({ 0: "", 1: "", 2: "" })
      expect(s.scaleToScaleWithLabels("0,1", undefined)).toEqual({ 0: "", 1: "" })
      expect(s.scaleToScaleWithLabels(["0", "1"], { 1: "Good", 0: null })).toEqual({ 0: "", 1: "Good" })
      expect(s.scaleToScaleWithLabels("0,,", {})).toEqual({ 0: "" })
      expect(s.scaleToScaleWithLabels(undefined, null)).toEqual({})
    })
  })

  describe("rating math", () => {
    const s = createScorer({ scale: [0, 1, 2, 3] })
    const docs = [makeDoc(1), makeDoc(2), makeDoc(3)]

    it("averages only rated docs and returns null when none are rated", () => {
      expect(s.baseAvg([makeDoc(1), makeDoc(undefined), makeDoc(3)])).toBe(2)
      expect(s.baseAvg([makeDoc(undefined)])).toBeNull()
      expect(s.baseAvg([])).toBeNull()
      expect(s.baseAvg(docs, 2)).toBe(1.5)
    })

    it("computes edit distance between rating sequences", () => {
      expect(s.editDistance([1, 2, 3], [1, 2, 3])).toBe(0)
      expect(s.editDistance([1, 2, 3], [1, 3])).toBe(1)
      expect(s.editDistance([1, 2, 3], [4, 5, 6])).toBe(3)
      expect(s.editDistance([1, 2, 3], [1, 2, 3, 4])).toBe(1)
    })

    it("takes the top N best ratings", () => {
      const best = [{ rating: 3 }, { rating: 2 }, { rating: 1 }]
      expect(s.getBestRatings(2, best)).toEqual([3, 2])
    })

    it("limits both sides to the requested count when measuring distance from best", () => {
      const best = [{ rating: 3 }, { rating: 2 }, { rating: 1 }]
      // ratings [1,2] vs best [3,2]
      expect(s.distanceFromBest(docs, best, 2)).toBe(1)
      // more best docs than returned docs: pad/limit to the docs seen
      expect(s.distanceFromBest(docs.slice(0, 1), best, 5)).toBe(s.editDistance([1], [3, 2, 1].slice(0, 3)))
      expect(s.distanceFromBest(docs, best.slice(0, 1), 3)).toBe(s.editDistance([1, 2, 3], [3, null, null]))
    })
  })

  describe("scorer code helpers", () => {
    const run = (code, { docs = [], ratedDocs = [], best = [], options } = {}) =>
      createScorer({ scale: [0, 1, 2, 3], code }).runCode({ ratedDocs }, docs.length, docs, best, undefined, options)

    it("bounds doc and rated-doc lookups at the list length", async () => {
      const docs = [makeDoc(1), makeDoc(2)]
      const ratedDocs = [{ id: "a" }, { id: "b" }]
      const result = await run(
        `setScore([
          docAt(1).id, String(docAt(2).id), docExistsAt(1), docExistsAt(2),
          ratedDocAt(1).id, String(ratedDocAt(2).id), ratedDocExistsAt(1), ratedDocExistsAt(2)
        ].join("|"))`,
        { docs, ratedDocs }
      )
      expect(result).toBe("2|undefined|true|false|b|undefined|true|false")
    })

    it("iterates at most count docs and rated docs", async () => {
      const docs = [1, 2, 3, 4, 5].map(makeDoc)
      const ratedDocs = [1, 2, 3, 4, 5].map((id) => ({ id }))
      const result = await run(
        `const seen = []
         eachDoc(function (d, i) { seen.push("d" + i) }, 2)
         eachRatedDoc(function (d, i) { seen.push("r" + i) }, 2)
         setScore(seen.join(","))`,
        { docs, ratedDocs }
      )
      expect(result).toBe("d0,d1,r0,r1")
    })

    it("gives best docs a getRating without overwriting an existing one", async () => {
      const result = await run(
        `const r = []
         eachDocWithRating(function (d) { r.push(d.getRating()) })
         setScore(r.join(","))`,
        { best: [{ rating: 3 }, { rating: 1, getRating: () => 9 }] }
      )
      expect(result).toBe("3,9")
    })

    it("returns null for qOption when no options are supplied", async () => {
      expect(await run(`setScore(String(qOption("boost")))`)).toBe("null")
      expect(await run(`setScore(String(qOption("boost")))`, { options: { boost: 2 } })).toBe("2")
    })

    it("rejects loops of any spacing and accepts loop-free code", async () => {
      const check = (code) => createScorer({ scale: [0, 1], code }).checkCode()
      await expect(check("for(var i=0;i<1;i++){}")).rejects.toMatch(/Loops/)
      await expect(check("while (true) {}")).rejects.toMatch(/Loops/)
      await expect(check("setScore(1)")).resolves.toBe("Code passes.")
    })
  })
})

import { describe, expect, it, vi } from "vitest"
import { createQueryModel } from "utils/query_model"

function buildQuery() {
  return {
    queryId: 7,
    docs: [{ score: () => 4 }, { score: () => 2 }],
    ratings: { first: 2 },
    lastScoreVersion: -5,
    hasBeenScored: false,
    lastScore: 0,
    allRated: true
  }
}

function buildModel(query) {
  const ratingsStore = { version: vi.fn(() => 0) }
  const scoreQuery = vi.fn(() => Promise.resolve({ score: 0.75, allRated: false }))
  const publish = vi.fn()
  let defaultScorer = { name: "default" }
  const model = createQueryModel({
    query,
    ratingsStore,
    getDefaultScorer: () => defaultScorer,
    scoreQuery,
    promiseApi: {
      defer() {
        let resolve
        const promise = new Promise(done => {
          resolve = done
        })
        return { promise, resolve }
      }
    },
    getFieldSpec: () => ({ id: "id" }),
    getQueryState: () => ({ state: "loaded" }),
    buildRatingsFilter: filter => filter,
    ratedDocIds: () => ["first"],
    publish
  })
  return { model, scoreQuery, publish, setDefaultScorer: scorer => { defaultScorer = scorer } }
}

describe("query model", () => {
  it("tracks dirty state separately from rating-store versions", () => {
    const query = buildQuery()
    const { model } = buildModel(query)

    expect(model.version()).toBe(1)
    model.setDirty()

    expect(model.version()).toBe(2)
  })

  it("scores the query and publishes the updated score state", async () => {
    const query = buildQuery()
    const { model, scoreQuery, publish } = buildModel(query)

    await expect(model.score()).resolves.toEqual({ score: 0.75, allRated: false })

    expect(scoreQuery).toHaveBeenCalledWith(expect.objectContaining({ query, docs: query.docs }))
    expect(query).toMatchObject({
      currentScore: { score: 0.75, allRated: false },
      hasBeenScored: true,
      lastScore: 0.75,
      allRated: false
    })
    expect(publish).toHaveBeenCalledWith(query)
  })

  it("resolves the current default scorer when scoring", async () => {
    const query = buildQuery()
    const { model, scoreQuery, setDefaultScorer } = buildModel(query)
    const updatedScorer = { name: "updated" }

    setDefaultScorer(updatedScorer)
    await model.score()

    expect(scoreQuery).toHaveBeenCalledWith(expect.objectContaining({ scorer: updatedScorer }))
  })

  it("exposes the query-local filter contract", () => {
    const query = buildQuery()
    const { model } = buildModel(query)
    const settings = {
      searchEngine: "solr",
      numberOfRows: 10,
      createFieldSpec: () => ({ id: "doc_id" })
    }

    expect(model.persisted()).toBe(true)
    expect(model.maxDocScore()).toBe(4)
    expect(model.filterToRatings(settings)).toEqual({
      searchEngine: "solr",
      idField: "doc_id",
      ratedIds: ["first"]
    })
  })
})

import { describe, expect, it } from "vitest"
import { buildSnapshotPayload } from "utils/snapshot_payload"

function doc(id, fields = {}, titleField = "title", title = "Title") {
  return {
    id,
    titleField,
    title,
    subsList: Object.fromEntries(Object.entries(fields).map(([field, value]) => [field, { field, value }])),
    explain: () => ({ rawStr: () => `explain-${id}` })
  }
}

describe("buildSnapshotPayload", () => {
  it("preserves query scores, result counts, and both document groups", () => {
    const payload = buildSnapshotPayload("saved", false, [{
      queryId: 3,
      numFound: 12,
      currentScore: { score: "--", allRated: false },
      docs: [doc("normal")],
      ratedDocs: [doc("rated")]
    }])

    expect(payload).toEqual({
      snapshot: {
        name: "saved",
        queries: { 3: { score: null, all_rated: false, number_of_results: 12 } },
        docs: {
          3: [
            { id: "normal", explain: "explain-normal", rated_only: false },
            { id: "rated", explain: "explain-rated", rated_only: true }
          ]
        }
      }
    })
  })

  it("records source fields and the title only for normal results", () => {
    const payload = buildSnapshotPayload("with fields", true, [{
      queryId: 1,
      docs: [doc("normal", { category: "book" }, "title", "A book")],
      ratedDocs: [doc("rated", { category: "rated book" }, "title", "Rated book")]
    }])

    expect(payload.snapshot.docs[1][0].fields).toEqual({ category: "book", title: "A book" })
    expect(payload.snapshot.docs[1][1].fields).toEqual({ category: "rated book" })
  })
  it("keeps numeric scores, including zero, and the all-rated flag", () => {
    const payload = buildSnapshotPayload("saved", false, [
      { queryId: 1, numFound: 1, currentScore: { score: 0, allRated: true } },
      { queryId: 2, numFound: 1, currentScore: { score: 0.5 } },
      { queryId: 3, numFound: 0 },
      { queryId: 4, numFound: 0, currentScore: {} }
    ])
    expect(payload.snapshot.queries).toEqual({
      1: { score: 0, all_rated: true, number_of_results: 1 },
      2: { score: 0.5, all_rated: false, number_of_results: 1 },
      3: { score: null, all_rated: false, number_of_results: 0 },
      4: { score: null, all_rated: false, number_of_results: 0 }
    })
    expect(payload.snapshot.docs[3]).toEqual([])
  })
})

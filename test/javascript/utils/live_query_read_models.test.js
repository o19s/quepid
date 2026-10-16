import { describe, expect, it, vi } from "vitest"
import { buildDiffReadModel, createDocList, documentUrlFor } from "utils/live_query_read_models"

describe("createDocList", () => {
  function build(docs, { fieldSpecId = "id", explain } = {}) {
    const createNormalDoc = vi.fn((spec, doc, altExplain) => ({ id: doc.id, altExplain }))
    const ratingsStore = { createRateableDoc: vi.fn((normalDoc) => ({ ...normalDoc, rateable: true })) }
    const docList = createDocList({
      docs,
      fieldSpec: { id: fieldSpecId },
      ratingsStore,
      explain,
      createNormalDoc
    })
    return { docList, createNormalDoc, ratingsStore }
  }

  it("returns rateable docs without errors when ids are unique", () => {
    const { docList } = build([{ id: "a" }, { id: "b" }])

    expect(docList.list().map((doc) => doc.id)).toEqual(["a", "b"])
    expect(docList.list().every((doc) => doc.rateable && doc.error === undefined)).toBe(true)
    expect(docList.hasErrors()).toBe(false)
    expect(docList.errorMsg()).toBe("")
  })

  it("treats missing docs as an empty list", () => {
    const { docList } = build(undefined)

    expect(docList.list()).toEqual([])
    expect(docList.hasErrors()).toBe(false)
  })

  it("passes the alternate explain for each doc to the normalizer", () => {
    const fieldSpec = { id: "id" }
    const explain = vi.fn((doc) => `explain-${doc.id}`)
    const createNormalDoc = vi.fn((spec, doc) => ({ id: doc.id }))
    createDocList({
      docs: [{ id: "a" }],
      fieldSpec,
      ratingsStore: { createRateableDoc: (doc) => doc },
      explain,
      createNormalDoc
    })

    expect(createNormalDoc).toHaveBeenCalledWith(fieldSpec, { id: "a" }, "explain-a")
  })

  it("flags docs missing the id field with placeholder ids", () => {
    const { docList } = build([{ id: undefined }, { id: "undefined" }], { fieldSpecId: "sku" })

    const [first, second] = docList.list()
    expect(first.error).toBe("ID Field Missing")
    expect(first.id).toBe("ID Field Missing0")
    expect(second.id).toBe("ID Field Missing1")
    expect(docList.hasErrors()).toBe(true)
    expect(docList.errorMsg()).toBe(
      "Your selected id field <strong>sku</strong> is missing on one or more results." +
        " Quepid requires a unique identifier for each document to work correctly. Open the " +
        "<strong>Tune Relevance</strong> pane, and under <strong>Settings</strong> in the " +
        "<strong>Displayed Fields</strong> field change " +
        "<strong>id:sku</strong> to specify your unique ID field."
    )
  })

  it("flags duplicate ids after the first occurrence", () => {
    const { docList } = build([{ id: "a" }, { id: "a" }], { fieldSpecId: "sku" })

    const [first, second] = docList.list()
    expect(first.error).toBeUndefined()
    expect(first.id).toBe("a")
    expect(second.error).toBe("ID <strong>a</strong> Shared With Another Doc")
    expect(second.id).toBe("ID <strong>a</strong> Shared With Another Doc1")
    expect(docList.errorMsg()).toContain(
      "Your selected id field <strong>sku</strong> doesn't uniquely identify individual documents."
    )
  })

  it("escapes the id field and doc id in error HTML", () => {
    const { docList } = build([{ id: "<b>x</b>" }, { id: "<b>x</b>" }], { fieldSpecId: "<img src=x>" })

    expect(docList.errorMsg()).not.toContain("<img")
    expect(docList.errorMsg()).toContain("&lt;img src=x&gt;")
    expect(docList.list()[1].error).toBe("ID <strong>&lt;b&gt;x&lt;/b&gt;</strong> Shared With Another Doc")
  })
})

describe("documentUrlFor", () => {
  const doc = (url) => ({ _url: () => url })

  it("returns null for docs without a url function", () => {
    expect(documentUrlFor(null)).toBeNull()
    expect(documentUrlFor({})).toBeNull()
  })

  it("returns null when the url function throws", () => {
    expect(documentUrlFor({ _url: () => { throw new Error("no url") } })).toBeNull()
  })

  it("returns the doc url unchanged by default", () => {
    expect(documentUrlFor(doc("http://search.test/doc/1"))).toBe("http://search.test/doc/1")
  })

  it("injects basic auth credentials", () => {
    const url = documentUrlFor(doc("https://search.test/doc/1"), {
      settings: { basicAuthCredential: "user:pass" }
    })

    expect(url).toBe("https://user:pass@search.test/doc/1")
  })

  it("prefixes the proxy url only when proxyRequests is true", () => {
    const proxyUrlFor = vi.fn((id) => `/proxy/${id}?url=`)

    expect(
      documentUrlFor(doc("http://search.test/doc/1"), {
        settings: { proxyRequests: true, searchEndpointId: 7 },
        proxyUrlFor
      })
    ).toBe("/proxy/7?url=http://search.test/doc/1")
    expect(proxyUrlFor).toHaveBeenCalledWith(7)

    expect(
      documentUrlFor(doc("http://search.test/doc/1"), {
        settings: { proxyRequests: "true", searchEndpointId: 7 },
        proxyUrlFor
      })
    ).toBe("http://search.test/doc/1")
  })

  it("applies basic auth before the proxy prefix", () => {
    const url = documentUrlFor(doc("http://search.test/doc/1"), {
      settings: { basicAuthCredential: "u:p", proxyRequests: true, searchEndpointId: 1 },
      proxyUrlFor: () => "/proxy/1?url="
    })

    expect(url).toBe("/proxy/1?url=http://u:p@search.test/doc/1")
  })
})

describe("buildDiffReadModel", () => {
  function queryWith(searchers, docsByIndex) {
    return {
      diffs: {
        getSearchers: () => searchers,
        docs: (index, rated) => docsByIndex[index]?.[rated ? "rated" : "all"]
      }
    }
  }

  it("returns null without diff searchers", () => {
    expect(buildDiffReadModel(null)).toBeNull()
    expect(buildDiffReadModel({})).toBeNull()
    expect(buildDiffReadModel({ diffs: {} })).toBeNull()
  })

  it("builds a column per searcher with its docs and max doc score", () => {
    const docs = [{ score: () => 2 }, { score: () => 5 }, {}]
    const ratedDocs = [{ id: "r" }]
    const query = queryWith(
      [
        {
          name: () => "Snap A",
          version: () => 3,
          inError: false,
          searchError: "",
          diffScore: { score: 0.5, allRated: true }
        }
      ],
      [{ all: docs, rated: ratedDocs }]
    )

    expect(buildDiffReadModel(query)).toEqual({
      searchers: [
        {
          name: "Snap A",
          version: 3,
          inError: false,
          searchError: "",
          score: { score: 0.5, allRated: true },
          maxDocScore: 5,
          docs,
          ratedDocs
        }
      ]
    })
  })

  it("defaults name, version, score, and doc lists", () => {
    const query = queryWith([{}], [])
    const [column] = buildDiffReadModel(query).searchers

    expect(column.name).toBe("Snapshot")
    expect(column.version).toBeNull()
    expect(column.score).toEqual({ score: "?", allRated: false })
    expect(column.maxDocScore).toBe(0)
    expect(column.docs).toEqual([])
    expect(column.ratedDocs).toEqual([])
  })

  it("hides unfiltered docs under show-only-rated", () => {
    const ratedDocs = [{ id: "r" }]
    const query = queryWith([{}], [{ all: [{ score: () => 1 }], rated: ratedDocs }])
    const [column] = buildDiffReadModel(query, { showOnlyRated: true }).searchers

    expect(column.docs).toEqual([])
    expect(column.ratedDocs).toBe(ratedDocs)
    expect(column.maxDocScore).toBe(1)
  })
})

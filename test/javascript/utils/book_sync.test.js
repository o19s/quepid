import { afterEach, describe, expect, it, vi } from "vitest"
import { buildQueryDocPairsPayload, createBookSyncRuntime, populateBook } from "utils/book_sync"

describe("buildQueryDocPairsPayload", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("maps query documents and preserves mapped fields", () => {
    const doc = {
      id: "doc-1",
      title: "Document title",
      rawFields: { title: "Original title" },
      subsList: {
        category: { field: "category", value: "books" }
      },
      thumb: "thumb.jpg",
      thumb_options: { prefix: "https://img/" },
      image: "image.jpg",
      image_options: { prefix: "https://img/" },
      hasThumb: () => true,
      hasImage: () => true
    }

    expect(buildQueryDocPairsPayload([{ queryText: "search", docs: [doc] }])).toEqual([
      {
        query_text: "search",
        doc_id: "doc-1",
        position: 1,
        document_fields: {
          category: "books",
          title: "Document title",
          title_field: "Original title",
          thumb: "https://img/thumb.jpg",
          image: "https://img/image.jpg"
        }
      }
    ])
  })

  it("populates a book through the API", async () => {
    const fetcher = vi.fn().mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 204, json: vi.fn(async () => null) })
    vi.stubGlobal("fetch", fetcher)
    await populateBook({ bookId: 7, caseId: 42, queries: [{ queryText: "search", docs: [] }] })

    expect(fetcher).toHaveBeenCalledWith("api/books/7/populate", expect.objectContaining({ method: "PUT" }))
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ case_id: 42, query_doc_pairs: [] })
  })

  it("numbers documents per query and tolerates empty document lists", () => {
    const payload = buildQueryDocPairsPayload([
      { queryText: "first", docs: [{ id: "a", subsList: {}, title: "A" }, { id: "b", subsList: {}, title: "B" }] },
      { queryText: "empty", docs: [] }
    ])

    expect(payload.map(({ query_text, doc_id, position }) => ({ query_text, doc_id, position }))).toEqual([
      { query_text: "first", doc_id: "a", position: 1 },
      { query_text: "first", doc_id: "b", position: 2 }
    ])
  })

  it("preserves the raw title from live NormalDoc instances", () => {
    const liveDoc = {
      id: "doc-1",
      title: "Mapped title",
      doc: { title: "Original title" },
      subsList: {}
    }

    expect(buildQueryDocPairsPayload([{ queryText: "search", docs: [liveDoc] }])[0].document_fields)
      .toEqual({ title: "Mapped title", title_field: "Original title" })
  })

  it("only syncs when the case has a book with auto-populate on", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ text: async () => "", json: async () => null,  ok: true, status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime()
    const query = { queryText: "search", docs: [{ id: "doc-1" }] }

    await runtime.sync([query])
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: false })
    await runtime.sync([query])
    runtime.configure({ caseId: 42, bookId: null, autoPopulate: true })
    await runtime.sync([query])

    expect(fetcher).not.toHaveBeenCalled()
  })

  it("sends only unsynced documents, in batches of 100 queries", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ text: async () => "", json: async () => null,  ok: true, status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime()
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    const queries = Array.from({ length: 250 }, (_, i) => ({ queryText: `q${i}`, docs: [{ id: "d" }] }))

    await runtime.sync(queries)
    expect(fetcher).toHaveBeenCalledTimes(3)
    const batchSizes = fetcher.mock.calls.map(([, init]) => JSON.parse(init.body).query_doc_pairs.length)
    expect(batchSizes).toEqual([100, 100, 50])

    fetcher.mockClear()
    await runtime.sync([{ queryText: "q0", docs: [{ id: "d" }, { id: "new" }] }])
    expect(JSON.parse(fetcher.mock.calls[0][1].body).query_doc_pairs.map((pair) => pair.doc_id)).toEqual(["new"])
  })

  it("forgets synced pairs on reset or when the case's book changes, but not on a same-book reconfigure", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ text: async () => "", json: async () => null,  ok: true, status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime()
    const query = { queryText: "search", docs: [{ id: "doc-1" }] }
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    await runtime.sync([query])

    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(1)

    runtime.reset()
    expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(0)
    await runtime.sync([query])

    runtime.configure({ caseId: 42, bookId: 8, autoPopulate: true })
    await runtime.sync([query])
    expect(fetcher).toHaveBeenCalledTimes(3)
    expect(fetcher.mock.calls[2][0]).toBe("api/books/8/populate")
  })

  it("reads thumb and image flags whether they are methods or booleans", () => {
    const [pair] = buildQueryDocPairsPayload([{
      queryText: "q",
      docs: [{
        id: "d",
        title: "T",
        hasThumb: () => true,
        thumb: "t.png",
        thumb_options: { prefix: "https://img/" },
        hasImage: false,
        image: "i.png"
      }]
    }])

    expect(pair.document_fields.thumb).toBe("https://img/t.png")
    expect(pair.document_fields).not.toHaveProperty("image")
  })

  it("deduplicates automatic syncs and retries failed batches", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 500, json: async () => ({ error: "failed" }) })
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 204, json: vi.fn(async () => null) })
    const logger = { error: vi.fn() }
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime({ logger })
    const query = { queryText: "search", docs: [{ id: "doc-1", title: "Document" }] }
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })

    await runtime.sync([query])
    expect(runtime.getSyncCacheStats(7).syncedPairsCount).toBe(0)
    await runtime.sync([query])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(runtime.getSyncCacheStats(7).syncedPairsCount).toBe(1)
    expect(logger.error).toHaveBeenCalledOnce()
  })
})

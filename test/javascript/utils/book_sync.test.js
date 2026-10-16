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

  it("sends all unsynced documents in one queued payload", async () => {
    const fetcher = vi.fn(() => Promise.resolve({ text: async () => "", json: async () => null,  ok: true, status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime()
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    const queries = Array.from({ length: 250 }, (_, i) => ({ queryText: `q${i}`, docs: [{ id: "d" }] }))

    await runtime.sync(queries)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const batchSizes = fetcher.mock.calls.map(([, init]) => JSON.parse(init.body).query_doc_pairs.length)
    expect(batchSizes).toEqual([250])

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

  it("preserves result positions when previously synced documents are filtered out", async () => {
    const fetcher = vi.fn(async () => ({ text: async () => "", ok: true, status: 204 }))
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime()
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    const first = { id: "a", title: "A" }
    await runtime.sync([{ queryText: "search", docs: [first] }])
    await runtime.sync([{
      queryText: "search", docs: [first, { id: "b", title: "B" }, { id: "c", title: "C" }]
    }])

    const pairs = JSON.parse(fetcher.mock.calls[1][1].body).query_doc_pairs
    expect(pairs.map(({ doc_id, position }) => ({ doc_id, position }))).toEqual([
      { doc_id: "b", position: 2 }, { doc_id: "c", position: 3 }
    ])
    expect(first).not.toHaveProperty("position")
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

  it("deduplicates automatic syncs and retries failed submissions", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 500, json: async () => ({ error: "failed" }) })
      .mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, status: 204, json: vi.fn(async () => null) })
    const logger = { error: vi.fn() }
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime({ logger })
    const query = { queryText: "search", docs: [{ id: "doc-1", title: "Document" }] }
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })

    await expect(runtime.sync([query])).rejects.toThrow("Book auto-sync could not submit all new results")
    expect(runtime.getSyncCacheStats(7).syncedPairsCount).toBe(0)
    await runtime.sync([query])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(runtime.getSyncCacheStats(7).syncedPairsCount).toBe(1)
    expect(logger.error).toHaveBeenCalledOnce()
  })
  it("submits 101 queries once and retries every pair after a busy-book conflict", async () => {
    let busy = true
    const fetcher = vi.fn(async () => {
      if (busy) return { ok: false, status: 409, json: async () => null }
      busy = true // 204 queues work: subsequent requests would conflict.
      return { ok: true, status: 204 }
    })
    vi.stubGlobal("fetch", fetcher)
    const runtime = createBookSyncRuntime({ logger: { error: vi.fn() } })
    runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
    const queries = Array.from({ length: 101 }, (_, i) => ({
      queryText: `q${i}`, docs: [{ id: "d" }]
    }))

    await expect(runtime.sync(queries)).rejects.toThrow("Book auto-sync")
    expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(0)
    busy = false // The previous job finished; retry the same search.
    await runtime.sync(queries)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.map(([, init]) => JSON.parse(init.body).query_doc_pairs.length))
      .toEqual([101, 101])
    expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(101)
    await runtime.sync(queries)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  describe("payload and submission edges", () => {
    const okFetch = () =>
      vi.fn(() => Promise.resolve({ text: async () => "", json: async () => null, ok: true, status: 204 }))

    it("keeps raw document fields and only reports a title_field that differs", () => {
      const pair = (doc) => buildQueryDocPairsPayload([{ queryText: "q", docs: [doc] }])[0].document_fields
      expect(pair({ id: "a", title: "T", rawFields: { color: "red" } })).toMatchObject({ color: "red", title: "T" })
      expect(pair({ id: "a", title: "T", rawFields: { title: "T" } })).not.toHaveProperty("title_field")
      expect(pair({ id: "a", title: "T" })).not.toHaveProperty("title_field")
      expect(pair({ id: "a", title: "T", rawFields: { title: "Raw" } }).title_field).toBe("Raw")
    })

    it("forgets synced pairs when either the case or the book changes", async () => {
      vi.stubGlobal("fetch", okFetch())
      const runtime = createBookSyncRuntime()
      const query = { queryText: "search", docs: [{ id: "doc-1" }] }
      runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })
      await runtime.sync([query])
      expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(1)

      runtime.configure({ caseId: 43, bookId: 7, autoPopulate: true })
      expect(runtime.getSyncCacheStats().syncedPairsCount).toBe(0)
    })

    it("does not send empty batches or queries without new docs", async () => {
      const fetcher = okFetch()
      vi.stubGlobal("fetch", fetcher)
      const runtime = createBookSyncRuntime()
      runtime.configure({ caseId: 42, bookId: 7, autoPopulate: true })

      await runtime.sync([{ queryText: "none", docs: [] }, { queryText: "also none" }])
      expect(fetcher).not.toHaveBeenCalled()

      const exactly100 = Array.from({ length: 100 }, (_, i) => ({ queryText: `q${i}`, docs: [{ id: "d" }] }))
      await runtime.sync([...exactly100, { queryText: "empty", docs: [] }])
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(JSON.parse(fetcher.mock.calls[0][1].body).query_doc_pairs).toHaveLength(100)
    })
  })
})

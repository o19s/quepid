import { describe, expect, it, vi } from "vitest"
import { buildQueryDocPairsPayload, createBookSyncRuntime, populateBook } from "utils/book_sync"

describe("buildQueryDocPairsPayload", () => {
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
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 204, json: vi.fn() })
    await populateBook({ bookId: 7, caseId: 42, queries: [{ queryText: "search", docs: [] }], fetcher })

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

  it("deduplicates automatic syncs and retries failed batches", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: "failed" }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn() })
    const logger = { error: vi.fn() }
    const runtime = createBookSyncRuntime({ fetcher, logger })
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

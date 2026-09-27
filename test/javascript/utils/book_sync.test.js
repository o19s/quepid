import { describe, expect, it } from "vitest"
import { buildQueryDocPairsPayload } from "utils/book_sync"

describe("buildQueryDocPairsPayload", () => {
  it("maps query documents and preserves mapped fields", () => {
    const doc = {
      id: "doc-1",
      title: "Document title",
      doc: { title: "Original title" },
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
})

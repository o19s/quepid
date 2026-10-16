import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { buildQueryDocPairsPayload } from "utils/book_sync"

const fieldName = fc.stringMatching(/^f_[a-z]{1,6}$/)
const text = fc.string({ maxLength: 20 })

const doc = fc.record({
  id: fc.oneof(fc.string({ minLength: 1, maxLength: 12 }), fc.integer({ min: 0 })),
  title: text,
  subsList: fc.dictionary(
    fc.stringMatching(/^s[0-9]{1,3}$/),
    fc.record({ field: fieldName, value: text }),
    { maxKeys: 4 }
  )
})

const query = fc.record({
  queryText: text,
  docs: fc.array(doc, { maxLength: 6 })
})

const queries = fc.array(query, { maxLength: 5 })

describe("buildQueryDocPairsPayload properties", () => {
  it("emits one pair per doc, in order, keeping query text and doc ids", () => {
    fc.assert(
      fc.property(queries, (input) => {
        const payload = buildQueryDocPairsPayload(input)
        const expected = input.flatMap((q) =>
          q.docs.map((d) => ({ query_text: q.queryText, doc_id: d.id }))
        )

        expect(payload.map(({ query_text, doc_id }) => ({ query_text, doc_id }))).toEqual(expected)
      })
    )
  })

  it("defaults position to the 1-based index within the query", () => {
    fc.assert(
      fc.property(queries, (input) => {
        const positions = buildQueryDocPairsPayload(input).map((pair) => pair.position)
        const expected = input.flatMap((q) => q.docs.map((_, index) => index + 1))

        expect(positions).toEqual(expected)
      })
    )
  })

  it("always reports the doc title and carries each subsList value into document_fields", () => {
    fc.assert(
      fc.property(queries, (input) => {
        const payload = buildQueryDocPairsPayload(input)
        const docs = input.flatMap((q) => q.docs)

        payload.forEach((pair, index) => {
          // When two subsList entries share a field name the later one wins.
          const expected = {}
          Object.values(docs[index].subsList).forEach(({ field, value }) => {
            expected[field] = value
          })

          expect(pair.document_fields.title).toBe(docs[index].title)
          expect(pair.document_fields).toMatchObject(expected)
        })
      })
    )
  })

  it("uses docPositions when given, falling back to the 1-based index", () => {
    const positioned = fc.record({
      queryText: text,
      docs: fc.array(doc, { minLength: 1, maxLength: 6 }),
      docPositions: fc.array(fc.option(fc.integer({ min: 1, max: 500 }), { nil: undefined }), { maxLength: 6 })
    })

    fc.assert(
      fc.property(fc.array(positioned, { maxLength: 4 }), (input) => {
        const positions = buildQueryDocPairsPayload(input).map((pair) => pair.position)
        const expected = input.flatMap((q) => q.docs.map((_, index) => q.docPositions[index] ?? index + 1))

        expect(positions).toEqual(expected)
      })
    )
  })

  it("adds thumb and image only when the doc has them, applying the optional prefix", () => {
    // Live docs expose hasThumb/hasImage as methods; plain read models as booleans.
    const flag = fc.boolean().chain((value) => fc.constantFrom(value, () => value))
    const media = fc.record({
      id: fc.string({ minLength: 1, maxLength: 8 }),
      title: text,
      hasThumb: flag,
      thumb: text,
      thumb_options: fc.option(fc.record({ prefix: text }), { nil: undefined }),
      hasImage: flag,
      image: text,
      image_options: fc.option(fc.record({ prefix: text }), { nil: undefined })
    })
    const isSet = (flag) => (typeof flag === "function" ? flag() : flag)
    const expectedMedia = (has, value, options) =>
      isSet(has) ? (options?.prefix ? `${options.prefix}${value}` : value) : undefined

    fc.assert(
      fc.property(fc.array(media, { maxLength: 6 }), (docs) => {
        const payload = buildQueryDocPairsPayload([{ queryText: "q", docs }])

        payload.forEach((pair, index) => {
          const d = docs[index]
          expect(pair.document_fields.thumb).toBe(expectedMedia(d.hasThumb, d.thumb, d.thumb_options))
          expect(pair.document_fields.image).toBe(expectedMedia(d.hasImage, d.image, d.image_options))
        })
      })
    )
  })

  it("does not mutate its input", () => {
    fc.assert(
      fc.property(queries, (input) => {
        const snapshot = structuredClone(input)
        buildQueryDocPairsPayload(input)

        expect(input).toEqual(snapshot)
      })
    )
  })
})

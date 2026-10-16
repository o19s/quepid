import fc from "fast-check"
import { describe, expect, it } from "vitest"
import { csvField } from "utils/case_csv"
import { parseCsv } from "utils/csv"

// Property tests for the export -> import round trip: whatever csvField writes,
// parseCsv must read back (modulo the trimming both sides document).
const EOL = "\r\n"
const toCsv = (headers, rows) =>
  [headers, ...rows].map((fields) => fields.map(csvField).join(",")).join(EOL) + EOL

// For the main round trip, header names are plain identifiers (arbitrary header
// text has its own property below); values are arbitrary unicode, including
// commas, quotes, CR/LF, and formula-leading characters.
const header = fc.stringMatching(/^[a-z][a-z0-9_]{0,8}$/)
const headers = fc.uniqueArray(header, { minLength: 1, maxLength: 5 })
const value = fc.oneof(fc.string({ unit: "grapheme" }), fc.stringMatching(/^[ ,"\r\n=@+\-a-z]{0,12}$/))

const table = headers.chain((names) =>
  fc.record({
    names: fc.constant(names),
    rows: fc.array(fc.array(value, { minLength: names.length, maxLength: names.length }), { maxLength: 6 })
  })
)

// A row whose every field is blank is indistinguishable from a blank line.
const isBlankRow = (fields) => fields.every((field) => field.trim() === "") && fields.length === 1

describe("csv round trip", () => {
  it("parseCsv reads back what csvField writes", () => {
    fc.assert(
      fc.property(table, ({ names, rows }) => {
        fc.pre(!rows.some(isBlankRow))
        const parsed = parseCsv(toCsv(names, rows))

        expect(parsed.errors).toEqual([])
        expect(parsed.headers).toEqual(names)
        expect(parsed.rows).toEqual(
          rows.map((fields) => Object.fromEntries(names.map((name, i) => [name, fields[i].trim()])))
        )
      })
    )
  })

  it("is insensitive to the line ending between rows", () => {
    fc.assert(
      fc.property(table, fc.constantFrom("\n", "\r\n", "\r"), ({ names, rows }, eol) => {
        fc.pre(!rows.some(isBlankRow))
        // Only swap the row separators, not line breaks inside quoted values.
        const text = [names, ...rows].map((fields) => fields.map(csvField).join(",")).join(eol) + eol

        expect(parseCsv(text)).toEqual(parseCsv(toCsv(names, rows)))
      })
    )
  })

  it("never throws and always returns one entry per parsed data row", () => {
    fc.assert(
      fc.property(fc.string({ unit: "binary" }), (text) => {
        const { headers: parsedHeaders, rows } = parseCsv(text)

        expect(Array.isArray(parsedHeaders)).toBe(true)
        rows.forEach((row) => expect(Object.keys(row).sort()).toEqual([...new Set(parsedHeaders)].sort()))
      })
    )
  })

  it("round-trips arbitrary header text, not just identifiers", () => {
    const anyHeader = fc.string({ minLength: 1, maxLength: 10 }).filter((text) => text.trim() !== "")
    const names = fc.uniqueArray(anyHeader, { minLength: 1, maxLength: 4, selector: (text) => text.trim() })

    fc.assert(
      fc.property(names, (headerNames) => {
        const parsed = parseCsv(toCsv(headerNames, [headerNames.map(() => "x")]))

        expect(parsed.errors).toEqual([])
        expect(parsed.headers).toEqual(headerNames.map((name) => name.trim()))
      })
    )
  })

  it("round-trips numbers, nulls, and JSON objects the way the exporter stringifies them", () => {
    const cell = fc.oneof(
      fc.integer().map((n) => ({ written: n, read: String(n) })),
      fc.constant({ written: null, read: "" }),
      fc
        .oneof(fc.dictionary(fc.string({ maxLength: 6 }), fc.jsonValue({ maxDepth: 2 }), { maxKeys: 3 }), fc.array(fc.jsonValue({ maxDepth: 2 }), { maxLength: 3 }))
        .map((object) => ({ written: object, read: JSON.stringify(object) }))
    )

    fc.assert(
      fc.property(fc.array(cell, { minLength: 2, maxLength: 5 }), (cells) => {
        const names = cells.map((_, index) => `c${index}`)
        const parsed = parseCsv(toCsv(names, [cells.map((c) => c.written)]))

        expect(parsed.errors).toEqual([])
        expect(Object.values(parsed.rows[0])).toEqual(cells.map((c) => c.read))
      })
    )
  })
})

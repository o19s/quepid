import { describe, expect, it } from "vitest"
import { parseCsv } from "utils/csv"

describe("parseCsv", () => {
  it("maps rows to the header and trims values", () => {
    expect(parseCsv("query, docid ,rating\n star wars ,123, 3 \n")).toEqual({
      headers: ["query", "docid", "rating"],
      rows: [{ query: "star wars", docid: "123", rating: "3" }],
      errors: []
    })
  })

  it("keeps commas, newlines, and escaped quotes inside quoted fields", () => {
    const { rows, errors } = parseCsv('q,title\n"shoes, red","Line one\nLine ""two"""\n')

    expect(errors).toEqual([])
    expect(rows).toEqual([{ q: "shoes, red", title: 'Line one\nLine "two"' }])
  })

  it("accepts CRLF, LF, and lone CR line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r3,4\n5,6").rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
      { a: "5", b: "6" }
    ])
  })

  it("reports rows with the wrong column count by line, padding missing values", () => {
    const { rows, errors } = parseCsv("a,b,c\n1,2\n1,2,3,4\n")

    expect(errors).toEqual([
      "line 2: expected 3 columns but found 2.",
      "line 3: expected 3 columns but found 4."
    ])
    expect(rows[0]).toEqual({ a: "1", b: "2", c: "" })
  })

  it.each([
    ["LF", "\n"],
    ["CRLF", "\r\n"],
    ["CR", "\r"]
  ])("counts %s line breaks inside quoted values when reporting later rows", (_label, eol) => {
    const content = ["a,b", '"x', 'y",1', "2", ""].join(eol)
    expect(parseCsv(content).errors).toEqual(["line 4: expected 2 columns but found 1."])
  })

  it.each(["\n", "\r\n", "\r"])("ignores blank lines while keeping error line numbers with %j", (eol) => {
    const content = ["a,b", "1,2", "", "   ", "3,4", "", "bad", "", ""].join(eol)
    const { rows, errors } = parseCsv(content)
    expect(rows).toEqual([{ a: "1", b: "2" }, { a: "3", b: "4" }, { a: "bad", b: "" }])
    expect(errors).toEqual(["line 7: expected 2 columns but found 1."])
  })

  it("reports an unclosed quote", () => {
    expect(parseCsv('a,b\n"open,1\n').errors).toContain("line 2: unclosed quote.")
  })

  it("returns no headers or rows for empty input", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [], errors: [] })
  })

  // Exactly what the AngularJS exporter (caseCSVSvc.stringifyField, Quepid <= 8.6.0)
  // wrote: quotes doubled, but the field only wrapped when it held a comma or newline.
  it.each([
    ["a phrase query", '""star wars""', '"star wars"'],
    ["quotes mid-value", 'Episode ""IV""', 'Episode "IV"'],
    ["a quote followed by a space", '"" star""', '" star"'],
    ["quotes and a comma (wrapped, standard CSV)", '"""star wars"", 1977"', '"star wars", 1977'],
    ["a comma only", '"shoes, red"', "shoes, red"],
    ["the formula guard's leading space", ' "=SUM(1, 2)"', "=SUM(1, 2)"],
    ["a quote-free value", "plain", "plain"]
  ])("reads %s from a pre-8.7 export", (_label, cell, expected) => {
    const { rows, errors } = parseCsv(`Query Text,Doc ID\n${cell},a\n`)

    expect(errors).toEqual([])
    expect(rows).toEqual([{ "Query Text": expected, "Doc ID": "a" }])
  })

  it("still reads standard quoted fields, including empty and quote-only ones", () => {
    expect(parseCsv('a,b,c,d\n"",x,"""",""""""\n').rows).toEqual([{ a: "", b: "x", c: '"', d: '""' }])
  })

  it("reads an empty quoted field followed by spaces as empty, not as a pre-8.7 quote", () => {
    expect(parseCsv('a,b,c\n"" ,x,""\t\n').rows).toEqual([{ a: "", b: "x", c: "" }])
  })

  it("treats a stray quote inside an unquoted value as text, without swallowing later commas", () => {
    expect(parseCsv('a,b,c\n5" screen,x,y\n')).toEqual({
      headers: ["a", "b", "c"],
      rows: [{ a: '5" screen', b: "x", c: "y" }],
      errors: []
    })
  })
})

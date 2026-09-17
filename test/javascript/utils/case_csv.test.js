import { describe, expect, it } from "vitest"
import { buildGeneralCaseCsv, buildSnapshotCsv, csvField, formatDownloadFileName } from "utils/case_csv"

// Escaping edge cases below mirror spec/javascripts/angular/services/caseCSVSvc_spec.js's
// "stringify" examples (Karma baseline for the AngularJS service this ports).
describe("buildGeneralCaseCsv", () => {
  const baseCaseData = {
    case_name: "Test Case",
    case_id: 8,
    teams: [ { name: "Test Team" } ],
    last_score: {
      updated_at: "2015-07-14 16:08:55",
      queries: {
        1: { score: 30, text: "dog" },
        2: { score: 0, text: "cat" },
        3: { score: "", text: "foo" }
      }
    }
  }
  const queries = [
    { query_id: 1, notes: "This dog looks like a great dog.", information_need: "", options: {} },
    { query_id: 2, notes: 'Is this "really" a "cat"?', information_need: "", options: {} },
    { query_id: 3, notes: "chil'laxin", information_need: "", options: {} }
  ]

  it("returns a header row plus one row per scored query", () => {
    const result = buildGeneralCaseCsv(baseCaseData, queries)

    expect(result).toEqual(
      "Team Name,Case Name,Case ID,Query Text,Score,Date Last Scored,Count,Information Need,Notes,Options\r\n" +
      "Test Team,Test Case,8,dog,30,2015-07-14 16:08:55,,,This dog looks like a great dog.,\r\n" +
      'Test Team,Test Case,8,cat,0,2015-07-14 16:08:55,,,Is this ""really"" a ""cat""?,\r\n' +
      "Test Team,Test Case,8,foo,,2015-07-14 16:08:55,,,chil'laxin,\r\n"
    )
  })

  it("returns an empty string when the case has never been scored", () => {
    expect(buildGeneralCaseCsv({ ...baseCaseData, last_score: null }, queries)).toEqual(
      "Team Name,Case Name,Case ID,Query Text,Score,Date Last Scored,Count,Information Need,Notes,Options\r\n"
    )
  })

  it.each([
    [ 'a value with a " in it', 'Test "Case"', 'Test ""Case""' ],
    [ "a value with a \\n in it", "Test \n Case", '"Test \n Case"' ],
    [ "a value with a \\r in it", "Test \r Case", '"Test \r Case"' ],
    [ "a value with a \\n\\r in it", "Test \n\r Case", '"Test \n\r Case"' ],
    [ "a value with a , in it", "Test, Case", '"Test, Case"' ],
    [ "a value that starts with =", "=Test Case", " =Test Case" ],
    [ "a value that starts with @", "@Test Case", " @Test Case" ],
    [ "a value that starts with +", "+Test Case", " +Test Case" ],
    [ "a value that starts with -", "-Test Case", " -Test Case" ]
  ])("escapes %s", (_description, caseName, expectedCaseNameField) => {
    const result = buildGeneralCaseCsv({ ...baseCaseData, case_name: caseName }, queries)
    const firstDataRow = result.split("\r\n")[1]

    expect(firstDataRow).toEqual(`Test Team,${expectedCaseNameField},8,dog,30,2015-07-14 16:08:55,,,This dog looks like a great dog.,`)
  })
})

describe("buildSnapshotCsv", () => {
  const snapshotData = {
    name: "Weekly check",
    // Noon UTC keeps the local calendar date stable across any test-runner timezone.
    time: "2026-03-05T12:00:00Z",
    queries: [ { query_id: 1, query_text: "dog" } ],
    docs: {
      1: [
        { id: "doc-1", fields: { title: "Good dog" } },
        { id: "doc-2", fields: { title: "Great, dog" } }
      ]
    }
  }

  it("returns a header row plus one row per document, prefixing the snapshot name with its short date", () => {
    const result = buildSnapshotCsv(8, snapshotData)

    expect(result).toEqual(
      "Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position,title\r\n" +
      "(3/5/26) Weekly check,2026-03-05T12:00:00Z,8,dog,doc-1,1,Good dog\r\n" +
      '(3/5/26) Weekly check,2026-03-05T12:00:00Z,8,dog,doc-2,2,"Great, dog"\r\n'
    )
  })

  it("skips queries that were deleted since the snapshot was taken (no matching query_text)", () => {
    // The field-name header is still derived from the raw docs, matching the AngularJS
    // `stringifySnapshot` this ports — only the per-query data rows are skipped.
    const result = buildSnapshotCsv(8, { ...snapshotData, queries: [] })

    expect(result).toEqual("Snapshot Name,Snapshot Time,Case ID,Query Text,Doc ID,Doc Position,title\r\n")
  })
})

describe("csvField", () => {
  it("passes through numbers and undefined untouched", () => {
    expect(csvField(30)).toBe(30)
    expect(csvField(undefined)).toBe(undefined)
  })

  it("serializes non-null objects as escaped JSON", () => {
    expect(csvField({ foo: 'bar"baz' })).toBe('"{""foo"":""bar\\""baz""}"')
  })
})

describe("formatDownloadFileName", () => {
  it("replaces spaces and colons so the name is filesystem-safe", () => {
    expect(formatDownloadFileName("My Case: general.csv")).toBe("My_Case__general.csv")
  })
})

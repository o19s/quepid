import { describe, expect, it } from "vitest"
import { csvField } from "utils/case_csv"
import { parseCsv } from "utils/csv"
import cases from "../../fixtures/files/csv_round_trip_cases.json"

// Shared with test/services/csv_export_test.rb. `ruby_csv` is the output of
// CsvExport.line (app/services/csv_export.rb) for `values`; the Ruby test fails
// if the exporter's output drifts from it, and this test proves the JS importer
// reads what the Ruby exporter writes. Regenerate the fixture from CsvExport
// when the exporter's contract intentionally changes.
const headers = (values) => values.map((_, index) => `c${index}`)
const expectedRow = (values) =>
  Object.fromEntries(values.map((value, index) => [`c${index}`, value.trim()]))

describe("CSV contract between the Ruby exporter and the JS importer", () => {
  it.each(cases.map((c, index) => [index, c]))(
    "parseCsv reads Ruby CsvExport.line output (case %i)",
    (_index, { values, ruby_csv: rubyCsv }) => {
      const parsed = parseCsv(`${headers(values).join(",")}\n${rubyCsv}`)

      expect(parsed.errors).toEqual([])
      expect(parsed.rows).toEqual([expectedRow(values)])
    }
  )

  // Known divergence: csvField trims each value and writes a blank bare, while
  // CsvExport keeps surrounding whitespace and quotes a blank as "". Both parse
  // to the same row, so those cases are compared after parsing; every other
  // case must match byte for byte.
  const whitespaceSensitive = ({ values }) =>
    values.some((value) => value === "" || value !== value.trim())

  // parseCsv trims fields, so comparing parsed rows would let a leading-space
  // divergence such as " -1" vs "-1" through.
  it.each(cases.map((c, index) => [index, c]).filter(([, c]) => !whitespaceSensitive(c)))(
    "JS csvField writes the same bytes as Ruby CsvExport.line (case %i)",
    (_index, { values, ruby_csv: rubyCsv }) => {
      expect(values.map(csvField).join(",")).toBe(rubyCsv.replace(/\r?\n$/, ""))
    }
  )

  it.each(cases.map((c, index) => [index, c]).filter(([, c]) => whitespaceSensitive(c)))(
    "JS csvField output parses to the same row as the Ruby output (whitespace case %i)",
    (_index, { values, ruby_csv: rubyCsv }) => {
      const head = `${headers(values).join(",")}\n`

      expect(parseCsv(head + values.map(csvField).join(","))).toEqual(parseCsv(head + rubyCsv))
    }
  )
})

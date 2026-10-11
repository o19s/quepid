import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
// By file path: splainer-search's package exports don't expose services/ directly.
import { queryTemplateSvcConstructor } from "../../node_modules/splainer-search/services/queryTemplateSvc.js"

// The browser side of the cases in test/fixtures/files/query_template_cases.json; the
// Ruby port (QueryTemplate, used by background evaluation) runs the same cases in
// test/services/query_template_test.rb. A failure here means the fixture no longer
// describes what the browser does.
const fixture = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../fixtures/files/query_template_cases.json"), "utf8")
)

const svc = new queryTemplateSvcConstructor({ deepClone: (value) => structuredClone(value) })

describe("splainer-search query templates match test/fixtures/files/query_template_cases.json", () => {
  fixture.cases.forEach((testCase) => {
    it(testCase.name, () => {
      const hydrated = svc.hydrate(testCase.template, testCase.query_text, {
        encodeURI: false,
        qOption: testCase.q_option
      })

      expect(hydrated).toEqual(testCase.expected)
    })
  })
})

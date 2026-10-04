import { describe, expect, it } from "vitest"
import { Linter } from "eslint"
import rule from "../../../scripts/eslint/json_helpers.mjs"

function lint(code) {
  return new Linter().verify(code, [{
    languageOptions: { sourceType: "module" },
    plugins: { quepid: { rules: { "json-helpers": rule } } },
    rules: { "quepid/json-helpers": "error" }
  }])
}

describe("api/json verb-helper guard", () => {
  it("rejects a method passed in a verb helper's options", () => {
    expect(lint('postJson(url, body, { method: "PUT" })')).toHaveLength(1)
    expect(lint('getJson(url, { method: "DELETE" })')).toHaveLength(1)
    expect(lint('deleteJson(url, undefined, { "method": "POST" })')).toHaveLength(1)
  })

  it("allows ordinary options and bodies that happen to contain a method key", () => {
    expect(lint("getJson(url, { signal })")).toHaveLength(0)
    expect(lint('postJson(url, { method: "bm25" })')).toHaveLength(0)
    expect(lint('putJson(url, body, { headers: { "X-Test": "1" } })')).toHaveLength(0)
  })
})

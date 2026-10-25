import { describe, expect, it } from "vitest"
import { Linter } from "eslint"
import rule from "../../../scripts/eslint/stimulus_conventions.mjs"

const filename = "app/javascript/controllers/example_controller.js"

function lint(code, baseline = {}) {
  return new Linter().verify(code, [{
    plugins: { quepid: { rules: { conventions: rule } } },
    rules: { "quepid/conventions": ["error", baseline] }
  }], { filename })
}

describe("Stimulus convention guard", () => {
  it("rejects new document listeners and HTML assignments", () => {
    expect(lint('document.addEventListener("ready", handler); node.innerHTML = html')).toHaveLength(2)
  })

  it("permits the recorded count but rejects increases independently", () => {
    const baseline = { [filename]: { documentListener: 1, innerHTML: 1 } }
    expect(lint('document.addEventListener("ready", handler); node.innerHTML = html', baseline)).toHaveLength(0)
    expect(lint('document.addEventListener("ready", handler); document.addEventListener("next", handler)', baseline)).toHaveLength(1)
  })

  it("does not transfer allowances between controllers", () => {
    expect(lint("node.innerHTML = html", { other: { innerHTML: 10 } })).toHaveLength(1)
  })

  it("catches computed properties and compound assignments", () => {
    expect(lint('document["addEventListener"]("ready", handler); node["innerHTML"] += html')).toHaveLength(2)
  })

  it("permits HTML reads and scoped or relocated-node listeners", () => {
    expect(lint('const html = node.innerHTML; node.addEventListener("click", handler)')).toHaveLength(0)
  })

  it("ignores comments and strings", () => {
    expect(lint('// node.innerHTML = html\nconst text = "document.addEventListener()"')).toHaveLength(0)
  })
})

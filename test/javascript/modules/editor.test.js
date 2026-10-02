import { describe, expect, it } from "vitest"
import { fromTextArea, languageFor, linterFor } from "modules/editor"

describe("editor modes", () => {
  it("gives free-form text no language and no linter", () => {
    expect(languageFor("text")).toEqual([])
    expect(linterFor("text")).toEqual([])
  })

  it("keeps JSON and the JavaScript default linted", () => {
    expect(linterFor("json")).not.toEqual([])
    expect(linterFor("javascript")).not.toEqual([])
    expect(linterFor(undefined)).toBe(linterFor("javascript"))
  })

  it("switches a text editor to JSON and back", () => {
    const parent = document.createElement("div")
    const textarea = document.createElement("textarea")
    textarea.value = "q=#$query##&magicBoost=31"
    parent.appendChild(textarea)

    const editor = fromTextArea(textarea, { mode: "text" })
    editor.setMode("json")
    editor.setMode("text")

    expect(editor.getValue()).toBe("q=#$query##&magicBoost=31")
    editor.view.destroy()
  })
})

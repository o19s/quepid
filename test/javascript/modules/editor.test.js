import { describe, expect, it } from "vitest"
import { undo } from "@codemirror/commands"
import { runScopeHandlers } from "@codemirror/view"
import { fromTextArea, languageFor, linterFor } from "modules/editor"

function jsonEditor(value) {
  const parent = document.createElement("div")
  const textarea = document.createElement("textarea")
  parent.appendChild(textarea)
  const editor = fromTextArea(textarea, { mode: "json" })
  editor.setValue(value)
  return editor
}

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

  it("undoes user edits but not loaded content", () => {
    const editor = jsonEditor('{"size": 3}')
    editor.view.dispatch({ changes: { from: editor.view.state.doc.length, insert: " " } })

    undo(editor.view)
    expect(editor.getValue()).toBe('{"size": 3}')

    undo(editor.view)
    expect(editor.getValue()).toBe('{"size": 3}')
    editor.view.destroy()
  })

  it("indents with Tab instead of moving focus", () => {
    const editor = jsonEditor("{}")
    editor.view.dispatch({ selection: { anchor: 0 } })

    const handled = runScopeHandlers(editor.view, new KeyboardEvent("keydown", { key: "Tab" }), "editor")

    expect(handled).toBe(true)
    expect(editor.getValue()).toBe("  {}")
    editor.view.destroy()
  })
})

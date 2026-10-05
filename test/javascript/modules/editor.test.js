import { describe, expect, it, vi } from "vitest"
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

describe("fromTextArea", () => {
  it("attaches the editor to its textarea", () => {
    const textarea = document.createElement("textarea")
    document.createElement("div").appendChild(textarea)

    const editor = fromTextArea(textarea, { mode: "text" })

    expect(textarea.editor).toBe(editor)
  })
})

describe("JSON formatting", () => {
  it("formats content without adding an undo step", () => {
    const editor = jsonEditor('{"size":3}')
    try {
      expect(editor.formatJSON()).toBe(true)
      expect(editor.getValue()).toBe('{\n  "size": 3\n}')
      expect(undo(editor.view)).toBe(false)
      expect(editor.formatJSON()).toBe(true)
      expect(editor.getValue()).toBe('{\n  "size": 3\n}')
    } finally {
      editor.view.destroy()
    }
  })

  it("keeps blank content successful and invalid content logged and unchanged", () => {
    const editor = jsonEditor("  \n")
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      expect(editor.formatJSON()).toBe(true)
      expect(editor.getValue()).toBe("  \n")
      expect(log).not.toHaveBeenCalled()

      editor.setValue("{broken")
      expect(editor.formatJSON()).toBe(false)
      expect(editor.getValue()).toBe("{broken")
      expect(log).toHaveBeenCalledWith("JSON formatting failed:", expect.any(SyntaxError))
    } finally {
      log.mockRestore()
      editor.view.destroy()
    }
  })
})

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

describe("editor lifecycle", () => {
  it("synchronizes edits immediately and removes the widget, timer and form listener on teardown", () => {
    vi.useFakeTimers()
    const form = document.createElement("form")
    const textarea = document.createElement("textarea")
    textarea.value = '{"size":3}'
    form.append(textarea)
    const editor = fromTextArea(textarea, { mode: "json" })
    editor.setValue('{"size":4}')
    expect(textarea.value).toBe('{"size":4}')
    const getValue = vi.spyOn(editor, "getValue")
    editor.destroy()
    getValue.mockClear()
    form.dispatchEvent(new Event("submit"))
    vi.runAllTimers()
    expect(getValue).not.toHaveBeenCalled()
    expect(form.querySelector(".cm-editor")).toBeNull()
    expect(textarea.editor).toBeUndefined()
    expect(textarea.style.display).toBe("")
    expect(textarea.value).toBe('{"size":4}')
    vi.useRealTimers()
  })
})

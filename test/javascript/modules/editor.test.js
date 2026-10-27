import { describe, expect, it, vi } from "vitest"
import { undo } from "@codemirror/commands"
import { EditorState } from "@codemirror/state"
import { forEachDiagnostic, forceLinting } from "@codemirror/lint"
import { EditorView, runScopeHandlers } from "@codemirror/view"
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

    const handled = runScopeHandlers(
      editor.view,
      new KeyboardEvent("keydown", { key: "Tab" }),
      "editor"
    )

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

async function diagnosticsFor(mode, code) {
  const parent = document.createElement("div")
  document.body.appendChild(parent)
  const view = new EditorView({
    parent,
    state: EditorState.create({ doc: code, extensions: [linterFor(mode)] })
  })
  try {
    forceLinting(view)
    await new Promise((resolve) => setTimeout(resolve, 0))
    const found = []
    forEachDiagnostic(view.state, (d, from, to) => found.push({ ...d, from, to }))
    return found.map(({ severity, message, from, to }) => ({ severity, message, from, to }))
  } finally {
    view.destroy()
    parent.remove()
  }
}

describe("JavaScript linter", () => {
  it("reports nothing for valid, fully terminated code", async () => {
    expect(await diagnosticsFor("javascript", "var a = 1;\nvar b = { c: 2 };\n")).toEqual([])
  })

  it("reports a syntax error as an error on the document", async () => {
    const found = await diagnosticsFor("javascript", "var a = ;")
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ severity: "error", from: 0 })
    expect(found[0].message).toMatch(/unexpected token/i)
  })

  it("warns about console.log at its position", async () => {
    const found = await diagnosticsFor("javascript", "var a = 1;\nconsole.log(a);")
    expect(found).toEqual([
      {
        severity: "warning",
        message: "Consider removing console.log before production",
        from: 11,
        to: 22
      }
    ])
  })

  it("warns about a missing semicolon on the last character of the line", async () => {
    const found = await diagnosticsFor("javascript", "var a = 1\nvar b = 2;")
    expect(found).toEqual([{ severity: "warning", message: "Missing semicolon", from: 8, to: 9 }])
  })

  it.each([
    ["a terminated statement", "var a = 1;"],
    ["an opening brace", "var a = {"],
    ["a closing brace", "}"],
    ["a line comment", "// note"],
    ["a block-comment continuation", "* note"],
    ["a conditional header", "if (x)"],
    ["a loop header", "for (;;)"],
    ["a while header", "while (x)"],
    ["a function header", "function f()"],
    ["a blank line", "   "]
  ])("does not warn about a missing semicolon on %s", async (_label, line) => {
    const found = await diagnosticsFor("javascript", line)
    expect(found.filter((d) => d.message === "Missing semicolon")).toEqual([])
  })
})

describe("JSON linter", () => {
  it("accepts blank and valid JSON", async () => {
    expect(await diagnosticsFor("json", "  \n")).toEqual([])
    expect(await diagnosticsFor("json", '{"a": 1}')).toEqual([])
  })

  it("marks invalid JSON as an error", async () => {
    const found = await diagnosticsFor("json", '{"a": }')
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ severity: "error" })
  })

  it("places the error at the position the engine reports, clamped to the document", async () => {
    const parse = vi.spyOn(JSON, "parse")
    try {
      parse.mockImplementation(() => {
        throw new SyntaxError("Unexpected token at position 5")
      })
      expect(await diagnosticsFor("json", '{"a": }')).toEqual([
        { severity: "error", message: "Unexpected token at position 5", from: 5, to: 6 }
      ])

      parse.mockImplementation(() => {
        throw new SyntaxError("Unexpected end at position 99")
      })
      expect(await diagnosticsFor("json", '{"a": }')).toEqual([
        { severity: "error", message: "Unexpected end at position 99", from: 7, to: 7 }
      ])

      parse.mockImplementation(() => {
        throw new SyntaxError("No position here")
      })
      expect(await diagnosticsFor("json", '{"a": }')).toEqual([
        { severity: "error", message: "No position here", from: 0, to: 1 }
      ])
    } finally {
      parse.mockRestore()
    }
  })
})

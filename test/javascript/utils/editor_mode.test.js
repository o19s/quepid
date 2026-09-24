import { describe, expect, it } from "vitest"
import { isJsonEditorMode } from "utils/editor_mode"

describe("editor mode", () => {
  it("recognizes JSON modes and treats other modes as text", () => {
    expect(isJsonEditorMode("json")).toBe(true)
    expect(isJsonEditorMode("application/json")).toBe(true)
    expect(isJsonEditorMode("text")).toBe(false)
    expect(isJsonEditorMode("javascript")).toBe(false)
  })
})

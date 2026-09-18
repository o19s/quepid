import { afterEach, describe, expect, it, vi } from "vitest"
import { copyText } from "utils/clipboard"

/**
 * Stub the legacy copy path without referencing Document.execCommand
 * (deprecated in lib.dom types).
 *
 * @param {boolean} ok
 * @returns {import("vitest").Mock}
 */
function stubLegacyCopy(ok) {
  const execCommand = vi.fn().mockReturnValue(ok)
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommand
  })
  return execCommand
}

describe("clipboard", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
  })

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    await copyText("hello")

    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back to execCommand('copy') when clipboard API is missing (HTTP case page)", async () => {
    vi.stubGlobal("navigator", {})
    const execCommand = stubLegacyCopy(true)

    await copyText("plain-http")

    expect(execCommand).toHaveBeenCalledWith("copy")
    const textarea = document.querySelector("textarea")
    expect(textarea).toBeNull()
  })

  it("rejects when the legacy copy command returns false", async () => {
    vi.stubGlobal("navigator", {})
    stubLegacyCopy(false)

    await expect(copyText("nope")).rejects.toThrow("Copy command was rejected")
    expect(document.querySelector("textarea")).toBeNull()
  })
})

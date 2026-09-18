import { afterEach, describe, expect, it, vi } from "vitest"
import { copyText } from "utils/clipboard"

describe("clipboard", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.unstubAllGlobals()
    // Instance stubs must not leak across tests (vi.unstubAllGlobals won't clear them).
    Reflect.deleteProperty(document, "execCommand")
  })

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal("navigator", { clipboard: { writeText } })

    await copyText("hello")

    expect(writeText).toHaveBeenCalledWith("hello")
  })

  it("falls back to execCommand('copy') when clipboard API is missing (HTTP case page)", async () => {
    vi.stubGlobal("navigator", {})
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    await copyText("plain-http")

    expect(execCommand).toHaveBeenCalledWith("copy")
    const textarea = document.querySelector("textarea")
    expect(textarea).toBeNull()
  })

  it("rejects when the legacy copy command returns false", async () => {
    vi.stubGlobal("navigator", {})
    document.execCommand = vi.fn().mockReturnValue(false)

    await expect(copyText("nope")).rejects.toThrow("Copy command was rejected")
    expect(document.querySelector("textarea")).toBeNull()
  })
})

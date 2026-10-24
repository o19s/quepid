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

  it.each([true, false])("keeps the fallback selection inside a supplied modal and cleans up (accepted=%s)", async accepted => {
    vi.stubGlobal("navigator", {})
    const modal = document.createElement("div")
    modal.className = "modal"
    document.body.appendChild(modal)
    document.execCommand = vi.fn(() => {
      const textarea = modal.querySelector("textarea")
      expect(textarea.value).toBe("modal text")
      expect(textarea.selectionStart).toBe(0)
      expect(textarea.selectionEnd).toBe(textarea.value.length)
      return accepted
    })

    const copy = copyText("modal text", modal)
    if (accepted) await copy
    else await expect(copy).rejects.toThrow("Copy command was rejected")

    expect(modal.querySelector("textarea")).toBeNull()
  })

  it("removes a modal fallback textarea when the copy command throws", async () => {
    vi.stubGlobal("navigator", {})
    const modal = document.createElement("div")
    document.body.appendChild(modal)
    document.execCommand = vi.fn(() => { throw new Error("denied") })

    await expect(copyText("modal text", modal)).rejects.toThrow("denied")

    expect(modal.querySelector("textarea")).toBeNull()
  })
})

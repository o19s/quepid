import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { attachTextPaste } from "./text_paste"

describe("text_paste", () => {
  let input

  beforeEach(() => {
    input = document.createElement("input")
    document.body.appendChild(input)
  })

  afterEach(() => {
    input.remove()
  })

  it("invokes onPaste with plain text from clipboardData", () => {
    const onPaste = vi.fn()
    attachTextPaste(input, onPaste)

    const event = new Event("paste", { bubbles: true })
    event.clipboardData = { getData: () => "line one\nline two" }
    input.dispatchEvent(event)

    expect(onPaste).toHaveBeenCalledWith("line one\nline two")
  })

  it("detach stops further paste callbacks", () => {
    const onPaste = vi.fn()
    const detach = attachTextPaste(input, onPaste)
    detach()

    const event = new Event("paste", { bubbles: true })
    event.clipboardData = { getData: () => "nope" }
    input.dispatchEvent(event)

    expect(onPaste).not.toHaveBeenCalled()
  })

  it("falls back to window.clipboardData when event.clipboardData is missing", () => {
    const onPaste = vi.fn()
    attachTextPaste(input, onPaste)

    window.clipboardData = { getData: () => "legacy paste" }
    const event = new Event("paste", { bubbles: true })
    input.dispatchEvent(event)
    delete window.clipboardData

    expect(onPaste).toHaveBeenCalledWith("legacy paste")
  })
})

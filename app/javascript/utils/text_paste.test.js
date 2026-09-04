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
    const getData = vi.fn(() => "line one\nline two")
    attachTextPaste(input, onPaste)

    const event = new Event("paste", { bubbles: true })
    event.clipboardData = { getData }
    input.dispatchEvent(event)

    expect(getData).toHaveBeenCalledWith("text/plain")
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

  it("does not invoke onPaste when clipboardData is unavailable", () => {
    const onPaste = vi.fn()
    attachTextPaste(input, onPaste)

    const event = new Event("paste", { bubbles: true })
    input.dispatchEvent(event)

    expect(onPaste).not.toHaveBeenCalled()
  })

  it("does not invoke onPaste when the pasted text is empty", () => {
    const onPaste = vi.fn()
    attachTextPaste(input, onPaste)

    const event = new Event("paste", { bubbles: true })
    event.clipboardData = { getData: () => "" }
    input.dispatchEvent(event)

    expect(onPaste).not.toHaveBeenCalled()
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TextPasteController from "./text_paste_controller"

const detach = vi.fn()

vi.mock("utils/text_paste", () => ({
  attachTextPaste: vi.fn(() => detach)
}))

import { attachTextPaste } from "utils/text_paste"

function buildController(element) {
  const controller = Object.create(TextPasteController.prototype)
  controller.element = element
  controller.dispatch = vi.fn()
  return controller
}

describe("TextPasteController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("input")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("attaches a paste listener that dispatches a Stimulus event", () => {
    const controller = buildController(element)
    TextPasteController.prototype.connect.call(controller)

    expect(attachTextPaste).toHaveBeenCalledWith(element, expect.any(Function))

    const onPaste = attachTextPaste.mock.calls[0][1]
    onPaste("line one\nline two")

    expect(controller.dispatch).toHaveBeenCalledWith("paste", {
      detail: { pastedText: "line one\nline two" }
    })
  })

  it("detaches the paste listener on disconnect", () => {
    const controller = buildController(element)
    TextPasteController.prototype.connect.call(controller)
    TextPasteController.prototype.disconnect.call(controller)

    expect(detach).toHaveBeenCalledOnce()
    expect(controller.detach).toBeNull()
  })
})

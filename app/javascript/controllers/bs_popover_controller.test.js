import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import BsPopoverController from "./bs_popover_controller"

const handle = {
  setTitle: vi.fn(),
  setBody: vi.fn(),
  dispose: vi.fn()
}

vi.mock("utils/bs_popover", () => ({
  createBsPopover: vi.fn(() => handle)
}))

import { createBsPopover } from "utils/bs_popover"

function buildController(element) {
  const controller = Object.create(BsPopoverController.prototype)
  controller.element = element
  controller.titleValue = ""
  controller.contentValue = "Close the results pane"
  controller.triggerValue = "click"
  controller.placementValue = "top"
  controller.htmlValue = false
  controller.delayValue = undefined
  return controller
}

describe("BsPopoverController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("i")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("creates a popover on connect with value options", () => {
    const controller = buildController(element)
    BsPopoverController.prototype.connect.call(controller)

    expect(createBsPopover).toHaveBeenCalledWith(element, {
      mode: "text",
      trigger: "click",
      placement: "top",
      delayMs: undefined,
      title: "",
      body: "Close the results pane",
      html: false
    })
    expect(controller.handle).toBe(handle)
  })

  it("updates popover body when the content value changes", () => {
    const controller = buildController(element)
    BsPopoverController.prototype.connect.call(controller)

    BsPopoverController.prototype.contentValueChanged.call(controller, "Updated")

    expect(handle.setBody).toHaveBeenCalledWith("Updated")
  })

  it("updates popover title when the title value changes", () => {
    const controller = buildController(element)
    BsPopoverController.prototype.connect.call(controller)

    BsPopoverController.prototype.titleValueChanged.call(controller, "Updated title")

    expect(handle.setTitle).toHaveBeenCalledWith("Updated title")
  })

  it("disposes the popover on disconnect", () => {
    const controller = buildController(element)
    BsPopoverController.prototype.connect.call(controller)
    BsPopoverController.prototype.disconnect.call(controller)

    expect(handle.dispose).toHaveBeenCalled()
    expect(controller.handle).toBeNull()
  })
})

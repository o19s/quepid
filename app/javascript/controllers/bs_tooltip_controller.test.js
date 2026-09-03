import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import BsTooltipController from "./bs_tooltip_controller"

vi.mock("utils/bs_tooltip", () => ({
  createBsTooltip: vi.fn(() => ({ id: "tooltip-instance" })),
  updateBsTooltipContent: vi.fn(),
  disposeBsTooltip: vi.fn()
}))

import {
  createBsTooltip,
  disposeBsTooltip,
  updateBsTooltipContent
} from "utils/bs_tooltip"

function buildController(element) {
  const controller = Object.create(BsTooltipController.prototype)
  controller.element = element
  controller.titleValue = "Help"
  controller.placementValue = "right"
  controller.htmlValue = true
  controller.delayValue = 500
  return controller
}

describe("BsTooltipController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("span")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("creates a tooltip on connect with value options", () => {
    const controller = buildController(element)
    BsTooltipController.prototype.connect.call(controller)

    expect(createBsTooltip).toHaveBeenCalledWith(element, {
      title: "Help",
      placement: "right",
      html: true,
      delayMs: 500
    })
    expect(controller.instance).toEqual({ id: "tooltip-instance" })
  })

  it("updates tooltip content when the title value changes", () => {
    const controller = buildController(element)
    BsTooltipController.prototype.connect.call(controller)

    BsTooltipController.prototype.titleValueChanged.call(controller, "Updated")

    expect(updateBsTooltipContent).toHaveBeenCalledWith(
      { id: "tooltip-instance" },
      "Updated"
    )
  })

  it("disposes the tooltip on disconnect", () => {
    const controller = buildController(element)
    BsTooltipController.prototype.connect.call(controller)
    BsTooltipController.prototype.disconnect.call(controller)

    expect(disposeBsTooltip).toHaveBeenCalledWith({ id: "tooltip-instance" })
    expect(controller.instance).toBeNull()
  })
})

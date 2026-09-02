import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CountUpController from "./count_up_controller"

vi.mock("utils/count_up", () => ({
  animateCountUp: vi.fn(),
  stopCountUp: vi.fn()
}))

import { animateCountUp, stopCountUp } from "utils/count_up"

function buildController(element, numberValue) {
  const controller = Object.create(CountUpController.prototype)
  controller.element = element
  controller.numberValue = numberValue
  return controller
}

describe("CountUpController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("span")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("paints the initial value directly without animating on connect", () => {
    const controller = buildController(element, 23)
    CountUpController.prototype.connect.call(controller)

    expect(element.textContent).toBe("23")
    expect(animateCountUp).not.toHaveBeenCalled()
  })

  it("animates from the previously displayed value when numberValue changes", () => {
    const controller = buildController(element, 23)
    CountUpController.prototype.connect.call(controller)

    CountUpController.prototype.numberValueChanged.call(controller, 42, 23)

    expect(animateCountUp).toHaveBeenCalledWith(element, 23, 42)
    expect(controller.displayedValue).toBe(42)
  })

  it("stops any running animation on disconnect", () => {
    const controller = buildController(element, 23)
    CountUpController.prototype.connect.call(controller)
    CountUpController.prototype.disconnect.call(controller)

    expect(stopCountUp).toHaveBeenCalledWith(element)
  })
})

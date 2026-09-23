import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import RatingPopoverController from "controllers/rating_popover_controller"

const handle = {
  setBody: vi.fn(),
  dispose: vi.fn(),
  instance: { hide: vi.fn() }
}

vi.mock("utils/bs_popover", () => ({
  createBsPopover: vi.fn(() => handle)
}))

import { createBsPopover } from "utils/bs_popover"

const SCALE = {
  1: { color: "hsl(0, 100%, 50%)" },
  2: { color: "hsl(60, 100%, 50%)", showScaleLabels: true, label: "Relevant" }
}

function buildController(element) {
  const controller = Object.create(RatingPopoverController.prototype)
  controller.element = element
  controller.scaleValue = SCALE
  controller.placementValue = "auto right"
  return controller
}

describe("RatingPopoverController", () => {
  let element

  beforeEach(() => {
    element = document.createElement("div")
    document.body.appendChild(element)
    vi.clearAllMocks()
  })

  afterEach(() => {
    element.remove()
  })

  it("creates a popover on connect with a rendered scale body", () => {
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)

    expect(createBsPopover).toHaveBeenCalledTimes(1)
    const [calledElement, options] = createBsPopover.mock.calls[0]
    expect(calledElement).toBe(element)
    expect(options.mode).toBe("text")
    expect(options.trigger).toBe("outsideClick")
    expect(options.placement).toBe("auto right")
    expect(options.html).toBe(true)

    const items = options.body.querySelectorAll(".ratingNum")
    expect(items).toHaveLength(2)
    expect(items[0].textContent).toContain("1")
    expect(items[1].querySelector("div").textContent).toBe("Relevant")
    expect(options.body.querySelector(".reset")).not.toBeNull()
  })

  it("dispatches rating-popover:rate with the clicked rating and hides", () => {
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)

    const listener = vi.fn()
    element.addEventListener("rating-popover:rate", listener)

    const body = createBsPopover.mock.calls[0][1].body
    body.querySelectorAll(".ratingNum")[1].click()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0][0].detail).toEqual({ rating: "2" })
    expect(handle.instance.hide).toHaveBeenCalledTimes(1)
  })

  it("dispatches rating-popover:reset and hides", () => {
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)

    const listener = vi.fn()
    element.addEventListener("rating-popover:reset", listener)

    const body = createBsPopover.mock.calls[0][1].body
    body.querySelector(".reset").click()

    expect(listener).toHaveBeenCalledTimes(1)
    expect(handle.instance.hide).toHaveBeenCalledTimes(1)
  })

  it("marks a result rating so the surrounding Score All handler ignores it", () => {
    const result = document.createElement("search-result")
    result.appendChild(element)
    document.body.appendChild(result)
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)

    const listener = vi.fn()
    element.addEventListener("rating-popover:rate", listener)
    createBsPopover.mock.calls.at(-1)[1].body.querySelector(".ratingNum").click()

    expect(listener.mock.calls[0][0].detail).toEqual({ rating: "1", source: "single-result" })
    result.remove()
  })

  it("re-renders and updates the popover body when the scale value changes", () => {
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)

    RatingPopoverController.prototype.scaleValueChanged.call(controller)

    expect(handle.setBody).toHaveBeenCalledTimes(1)
    const newBody = handle.setBody.mock.calls[0][0]
    expect(newBody.querySelectorAll(".ratingNum")).toHaveLength(2)
  })

  it("disposes the popover on disconnect", () => {
    const controller = buildController(element)
    RatingPopoverController.prototype.connect.call(controller)
    RatingPopoverController.prototype.disconnect.call(controller)

    expect(handle.dispose).toHaveBeenCalledTimes(1)
    expect(controller.handle).toBeNull()
  })
})

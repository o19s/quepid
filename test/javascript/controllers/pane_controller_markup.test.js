import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import PaneController from "controllers/pane_controller"

// Override the unit-test alias for this file, including the controller's import.
vi.mock(
  "@hotwired/stimulus",
  () => import("../../../node_modules/@hotwired/stimulus/dist/stimulus.js")
)

// Matches the opening tag's line; action descriptors contain ">" so a [^>] match would stop early.
function actionFor(source, tagPattern) {
  const tag = source.match(tagPattern)?.[0]
  expect(tag).toBeDefined()
  const action = tag.match(/data-action="([^"]*)"/)?.[1]
  expect(action).toBeDefined()
  return action
}

describe("pane ERB action wiring with real Stimulus", () => {
  let application
  let container
  let main
  let slider

  beforeEach(async () => {
    window.sessionStorage.clear()
    const source = readFileSync("app/views/core/index.html.erb", "utf8")
    const containerAction = actionFor(source, /<div class="pane_container"[^\n]*/)
    const sliderAction = actionFor(source, /<div class="east-slider"[^\n]*/)

    document.body.innerHTML = `
      <div class="pane_container" data-controller="pane" data-action="${containerAction}">
        <div data-pane-target="main"></div>
        <div data-pane-target="slider" data-action="${sliderAction}"></div>
        <div data-pane-target="east" style="min-width: 300px"></div>
      </div>`
    container = document.querySelector(".pane_container")
    main = container.querySelector('[data-pane-target="main"]')
    slider = container.querySelector('[data-pane-target="slider"]')
    Object.defineProperty(container, "offsetWidth", { configurable: true, value: 1000 })

    application = Application.start()
    application.register("pane", PaneController)
    await vi.waitFor(() => expect(main.style.width).toBe("1000px"))
    application.getControllerForElementAndIdentifier(container, "pane").toggle()
    expect(main.style.width).toBe("550px")
  })

  afterEach(() => {
    application?.stop()
    document.body.replaceChildren()
  })

  it("drags the divider only while the slider holds the pointer", () => {
    const pointer = (type, init = {}) =>
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, ...init })

    slider.dispatchEvent(pointer("pointermove", { clientX: 300 }))
    expect(main.style.width).toBe("550px")

    const down = pointer("pointerdown")
    slider.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(slider.hasPointerCapture(1)).toBe(true)
    // Captured, the browser targets every move at the slider wherever the pointer is.
    slider.dispatchEvent(pointer("pointermove", { clientX: 300 }))
    expect(main.style.width).toBe("300px")

    slider.dispatchEvent(pointer("pointerup"))
    slider.dispatchEvent(pointer("pointermove", { clientX: 400 }))
    expect(main.style.width).toBe("300px")
  })

  it("ends the drag when the slider loses the pointer", () => {
    slider.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerId: 1 })
    )
    slider.dispatchEvent(new PointerEvent("lostpointercapture", { bubbles: true, pointerId: 1 }))
    slider.dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true, clientX: 300, pointerId: 1 })
    )
    expect(main.style.width).toBe("550px")
  })
})

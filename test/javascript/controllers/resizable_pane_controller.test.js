import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import ResizablePaneController from "../../../app/javascript/controllers/resizable_pane_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("ResizablePaneController", () => {
  let application

  beforeEach(async () => {
    // Stub jQuery's $().on since resizable_pane_controller uses it
    globalThis.$ = (selector) => {
      if (selector === document) {
        return {
          on: vi.fn(),
          off: vi.fn(),
        }
      }
      return { on: vi.fn(), off: vi.fn() }
    }

    document.body.innerHTML = `
      <div data-controller="resizable-pane" style="width: 1000px; position: relative;">
        <div data-resizable-pane-target="main" style="width: 100%;"></div>
        <div data-resizable-pane-target="slider" style="display: none; width: 6px;"></div>
        <div data-resizable-pane-target="east" style="display: none;"></div>
      </div>
    `

    application = Application.start()
    application.register("resizable-pane", ResizablePaneController)
    await waitForController(application, '[data-controller="resizable-pane"]', "resizable-pane")
  })

  afterEach(() => {
    application.stop()
  })

  it("starts with pane closed", () => {
    const slider = document.querySelector('[data-resizable-pane-target="slider"]')
    const east = document.querySelector('[data-resizable-pane-target="east"]')

    expect(slider.style.display).toBe("none")
    expect(east.style.display).toBe("none")
  })

  it("opens pane on toggleEast event", () => {
    const slider = document.querySelector('[data-resizable-pane-target="slider"]')
    const east = document.querySelector('[data-resizable-pane-target="east"]')

    // Simulate jQuery toggleEast event via the controller's _onToggle
    const controller = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="resizable-pane"]'),
      "resizable-pane",
    )
    controller._onToggle()

    expect(slider.style.display).toBe("block")
    expect(east.style.display).toBe("block")
  })

  it("closes pane on second toggle", () => {
    const slider = document.querySelector('[data-resizable-pane-target="slider"]')
    const east = document.querySelector('[data-resizable-pane-target="east"]')

    const controller = application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="resizable-pane"]'),
      "resizable-pane",
    )

    controller._onToggle() // open
    controller._onToggle() // close

    expect(slider.style.display).toBe("none")
    expect(east.style.display).toBe("none")
  })
})

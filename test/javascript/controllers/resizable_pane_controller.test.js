import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { Application } from "@hotwired/stimulus"
import ResizablePaneController from "../../../app/javascript/controllers/resizable_pane_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("ResizablePaneController", () => {
  let application

  beforeEach(async () => {
    document.body.innerHTML = `
      <div data-controller="resizable-pane" style="width: 1000px; position: relative;">
        <div data-resizable-pane-target="main" style="width: 100%;"></div>
        <div data-resizable-pane-target="slider" class="d-none" style="width: 6px;"></div>
        <div data-resizable-pane-target="east" class="d-none"></div>
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

    expect(slider.classList.contains("d-none")).toBe(true)
    expect(east.classList.contains("d-none")).toBe(true)
  })

  it("opens pane on toggleEast event", () => {
    const slider = document.querySelector('[data-resizable-pane-target="slider"]')
    const east = document.querySelector('[data-resizable-pane-target="east"]')

    document.dispatchEvent(new CustomEvent("toggleEast"))

    expect(slider.classList.contains("d-none")).toBe(false)
    expect(east.classList.contains("d-none")).toBe(false)
  })

  it("closes pane on second toggleEast", () => {
    const slider = document.querySelector('[data-resizable-pane-target="slider"]')
    const east = document.querySelector('[data-resizable-pane-target="east"]')

    document.dispatchEvent(new CustomEvent("toggleEast"))
    document.dispatchEvent(new CustomEvent("toggleEast"))

    expect(slider.classList.contains("d-none")).toBe(true)
    expect(east.classList.contains("d-none")).toBe(true)
  })
})

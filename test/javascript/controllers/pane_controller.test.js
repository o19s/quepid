import { beforeEach, describe, expect, it, vi } from "vitest"
import PaneController from "controllers/pane_controller"

function buildController() {
  const element = document.createElement("div")
  element.className = "pane_container"
  Object.defineProperty(element, "offsetWidth", { configurable: true, value: 1000 })

  const main = document.createElement("div")
  main.className = "pane_main"
  const slider = document.createElement("div")
  slider.className = "east-slider"
  const east = document.createElement("div")
  east.className = "pane_east"
  element.append(main, slider, east)
  document.body.append(element)

  const controller = Object.create(PaneController.prototype)
  controller.element = element
  for (const [name, target] of Object.entries({ main, slider, east })) {
    controller[`${name}Target`] = target
    controller[`has${name[0].toUpperCase()}${name.slice(1)}Target`] = true
  }
  return { controller, element, main, slider, east }
}

describe("PaneController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
  })

  it("starts collapsed and toggles the east pane through the document event", () => {
    const { controller, main, slider, east } = buildController()
    controller.connect()

    expect(east.style.display).toBe("none")
    expect(slider.style.display).toBe("none")
    expect(main.style.width).toBe("1000px")

    document.dispatchEvent(new CustomEvent("toggleEast"))

    expect(east.style.display).toBe("block")
    expect(slider.style.display).toBe("block")
    expect(main.style.width).toBe("550px")
    expect(east.style.width).toBe("450px")
  })

  it("uses declared pane targets rather than similarly classed descendants", () => {
    const { controller, element, main } = buildController()
    const decoy = document.createElement("div")
    decoy.className = "pane_main"
    element.prepend(decoy)
    controller.connect()
    expect(main.style.width).toBe("1000px")
    expect(decoy.style.width).toBe("")
    controller.disconnect()
  })

  it("removes listeners when disconnected", () => {
    const { controller, east } = buildController()
    controller.connect()
    controller.disconnect()

    document.dispatchEvent(new CustomEvent("toggleEast"))

    expect(east.style.display).toBe("none")
  })
})

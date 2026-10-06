import { beforeEach, describe, expect, it, vi } from "vitest"
import PaneController from "controllers/pane_controller"
import { buildControllerFixture } from "../support/controller_fixture"

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

  const controller = buildControllerFixture(PaneController, {
    element,
    targets: { main, slider, east }
  })
  return { controller, element, main, slider, east }
}

describe("PaneController", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    window.sessionStorage.clear()
  })

  it("clamps dragging to both edges and reclamps on resize", () => {
    const { controller, element, main, east } = buildController()
    controller.connect()
    controller.toggle()
    controller.drag({ clientX: -300 })
    expect(main.style.width).toBe("230px")
    expect(east.style.width).toBe("764px")
    controller.drag({ clientX: 2000 })
    expect(main.style.width).toBe("750px")
    Object.defineProperty(element, "offsetWidth", { configurable: true, value: 400 })
    controller.resize()
    expect(main.style.width).toBe("200px")
    expect(east.style.width).toBe("194px")
    controller.disconnect()
  })

  it("starts collapsed and opens the east pane when toggled", () => {
    const { controller, main, slider, east } = buildController()
    controller.connect()

    expect(east.style.display).toBe("none")
    expect(slider.style.display).toBe("none")
    expect(main.style.width).toBe("1000px")

    controller.toggle()

    expect(east.style.display).toBe("block")
    expect(slider.style.display).toBe("block")
    expect(main.style.width).toBe("550px")
    expect(east.style.width).toBe("444px")
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

  it("removes active drag listeners when disconnected", () => {
    const { controller, main } = buildController()
    controller.connect()
    controller.toggle()
    controller.grabSlider()
    controller.disconnect()
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 }))
    expect(main.style.width).toBe("550px")
  })

  it("places the slider relative to the container when it is scrolled sideways", () => {
    const { controller, element, main, slider, east } = buildController()
    element.getBoundingClientRect = () => ({ left: -150 })
    controller.connect()
    controller.toggle()
    controller.grabSlider()
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 300 }))
    expect(slider.style.left).toBe("450px")
    expect(east.style.left).toBe("456px")
    expect(main.style.width).toBe("450px")
    controller.disconnect()
  })

  it("stops retrying a hidden pane's layout once disconnected", () => {
    vi.useFakeTimers()
    try {
      const { controller, element, main } = buildController()
      Object.defineProperty(element, "offsetWidth", { configurable: true, value: 0 })
      const addListener = vi.spyOn(document, "addEventListener")
      controller.connect()
      vi.advanceTimersByTime(400)
      expect(vi.getTimerCount()).toBe(1)

      controller.disconnect()
      addListener.mockClear()
      Object.defineProperty(element, "offsetWidth", { configurable: true, value: 1000 })
      vi.advanceTimersByTime(1000)

      expect(vi.getTimerCount()).toBe(0)
      expect(addListener).not.toHaveBeenCalledWith("mouseup", expect.anything())
      expect(main.style.width).toBe("")
    } finally {
      vi.useRealTimers()
      vi.restoreAllMocks()
    }
  })

  it("lays out a hidden pane once it becomes visible", () => {
    vi.useFakeTimers()
    try {
      const { controller, element, main } = buildController()
      Object.defineProperty(element, "offsetWidth", { configurable: true, value: 0 })
      controller.connect()
      Object.defineProperty(element, "offsetWidth", { configurable: true, value: 1000 })
      vi.advanceTimersByTime(200)

      expect(main.style.width).toBe("1000px")
      expect(vi.getTimerCount()).toBe(0)
      controller.disconnect()
    } finally {
      vi.useRealTimers()
    }
  })

  it("reopens at the kept width after navigating to another try, then forgets it", () => {
    const first = buildController()
    first.controller.connect()
    first.controller.toggle()
    first.controller.eastPaneWidth = 600
    first.controller.keepOpenAcrossNavigation({ tab: "history" })

    document.body.innerHTML = ""
    const next = buildController()
    next.controller.connect()

    expect(next.controller.handoff.tab).toBe("history")
    expect(next.east.style.display).toBe("block")
    expect(next.main.style.width).toBe("400px")

    document.body.innerHTML = ""
    const reloaded = buildController()
    reloaded.controller.connect()
    expect(reloaded.east.style.display).toBe("none")
  })

  it("keeps nothing when the pane is collapsed", () => {
    const { controller } = buildController()
    controller.connect()
    controller.keepOpenAcrossNavigation()
    expect(window.sessionStorage.length).toBe(0)
  })

  it("caps a kept width wider than the container", () => {
    window.sessionStorage.setItem("quepid.paneEast.keepOpen", JSON.stringify({ width: 1500 }))
    const { controller, main, east } = buildController()
    controller.connect()

    expect(main.style.width).toBe("230px")
    expect(east.style.width).toBe("764px")
  })
})

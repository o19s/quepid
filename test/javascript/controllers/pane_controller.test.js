import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
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
  // jsdom does not load panes.css; provide its minimum for computed styles.
  east.style.minWidth = "300px"
  element.append(main, slider, east)
  document.body.append(element)

  const controller = buildControllerFixture(PaneController, {
    element,
    targets: { main, slider, east }
  })
  return { controller, element, main, slider, east }
}

function pointerDownOn(slider, button = 0) {
  return { pointerId: 1, button, currentTarget: slider, preventDefault: vi.fn() }
}

describe("PaneController", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("keeps drawer actions above stacked flashes and releases the offset on disconnect", () => {
    const flashes = document.createElement("div")
    flashes.id = "flash-messages"
    document.body.append(flashes)
    let height = 51
    Object.defineProperty(flashes, "offsetHeight", { get: () => height })
    let resize
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback) { resize = callback }
      observe = observe
      disconnect = disconnect
    })
    const { controller, element } = buildController()
    controller.connect()
    expect(observe).toHaveBeenCalledWith(flashes)
    resize()
    expect(element.style.getPropertyValue("--core-flash-height")).toBe("51px")
    height = 102
    resize()
    expect(element.style.getPropertyValue("--core-flash-height")).toBe("102px")
    height = 0
    resize()
    expect(element.style.getPropertyValue("--core-flash-height")).toBe("0px")
    controller.disconnect()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(element.style.getPropertyValue("--core-flash-height")).toBe("")
    expect(flashes.style.bottom).toBe("")
  })

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
    expect(main.style.width).toBe("694px")
    expect(east.style.width).toBe("300px")
    Object.defineProperty(element, "offsetWidth", { configurable: true, value: 400 })
    controller.resize()
    expect(main.style.width).toBe("94px")
    expect(east.style.width).toBe("300px")
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

  it("reserves the computed pane minimum and divider at the drag limit", () => {
    const { controller, element, main, east } = buildController()
    east.style.minWidth = "360px"
    controller.connect()
    controller.toggle()
    controller.drag({ clientX: 2000 })

    expect(east.style.width).toBe("360px")
    expect(parseFloat(east.style.left) + parseFloat(east.style.width)).toBe(element.offsetWidth)
    expect(parseFloat(main.style.width) + 6).toBe(parseFloat(east.style.left))
    controller.disconnect()
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

  it("only follows the pointer between grabbing and releasing the slider", () => {
    const { controller, main, slider } = buildController()
    controller.connect()
    controller.toggle()
    controller.dragSlider({ clientX: 300 })
    expect(main.style.width).toBe("550px")

    const event = pointerDownOn(slider)
    controller.grabSlider(event)
    expect(event.preventDefault).toHaveBeenCalled()
    expect(slider.hasPointerCapture(1)).toBe(true)
    controller.dragSlider({ clientX: 300 })
    expect(main.style.width).toBe("300px")

    controller.releaseSlider()
    controller.dragSlider({ clientX: 400 })
    expect(main.style.width).toBe("300px")
  })

  it("ignores the slider while collapsed", () => {
    const { controller, main, slider } = buildController()
    controller.connect()
    controller.grabSlider(pointerDownOn(slider))
    controller.dragSlider({ clientX: 300 })
    expect(main.style.width).toBe("1000px")
    expect(slider.hasPointerCapture(1)).toBe(false)
  })

  it("only starts a drag from the primary button", () => {
    const { controller, main, slider } = buildController()
    controller.connect()
    controller.toggle()
    controller.grabSlider(pointerDownOn(slider, 2))
    controller.dragSlider({ clientX: 300 })
    expect(main.style.width).toBe("550px")
    expect(slider.hasPointerCapture(1)).toBe(false)
  })

  it("stops dragging when collapsed or disconnected mid-drag", () => {
    const { controller, main, slider } = buildController()
    controller.connect()
    controller.toggle()
    controller.grabSlider(pointerDownOn(slider))
    controller.toggle()
    expect(controller.dragging).toBe(false)

    controller.toggle()
    controller.grabSlider(pointerDownOn(slider))
    controller.disconnect()
    controller.dragSlider({ clientX: 300 })
    expect(main.style.width).toBe("550px")
  })

  it("places the slider relative to the container when it is scrolled sideways", () => {
    const { controller, element, main, slider, east } = buildController()
    element.getBoundingClientRect = () => ({ left: -150 })
    controller.connect()
    controller.toggle()
    controller.grabSlider(pointerDownOn(slider))
    controller.dragSlider({ clientX: 300 })
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
      controller.connect()
      vi.advanceTimersByTime(400)
      expect(vi.getTimerCount()).toBe(1)

      controller.disconnect()
      Object.defineProperty(element, "offsetWidth", { configurable: true, value: 1000 })
      vi.advanceTimersByTime(1000)

      expect(vi.getTimerCount()).toBe(0)
      expect(main.style.width).toBe("")
    } finally {
      vi.useRealTimers()
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

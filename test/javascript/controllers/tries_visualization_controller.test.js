import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("api/json", () => ({ getJson: vi.fn() }))

import { getJson } from "api/json"
import TriesVisualizationController from "controllers/tries_visualization_controller"

function buildController() {
  const controller = Object.create(TriesVisualizationController.prototype)
  controller.element = document.createElement("div")
  controller.specUrlValue = "analytics/tries_visualization/7/vega_specification"
  return controller
}

describe("TriesVisualizationController", () => {
  let view

  beforeEach(() => {
    view = { runAsync: vi.fn().mockResolvedValue(undefined), finalize: vi.fn() }
    global.vega = {
      View: vi.fn(function () { return view }),
      parse: vi.fn((spec) => ({ parsed: spec })),
      loader: vi.fn((options) => ({ loader: options }))
    }
    getJson.mockResolvedValue({ marks: [] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    delete global.vega
  })

  it("fetches the server spec and renders it into its element on a canvas", async () => {
    const controller = buildController()

    await controller.render()

    expect(getJson).toHaveBeenCalledWith("analytics/tries_visualization/7/vega_specification")
    expect(global.vega.parse).toHaveBeenCalledWith({ marks: [] })
    const [ runtime, options ] = global.vega.View.mock.calls[0]
    expect(runtime).toEqual({ parsed: { marks: [] } })
    expect(options).toMatchObject({ renderer: "canvas", container: controller.element, hover: true })
    expect(global.vega.loader).toHaveBeenCalledWith({ target: "_self" })
    expect(view.runAsync).toHaveBeenCalledOnce()
  })

  it("finalizes the view on disconnect", async () => {
    const controller = buildController()
    await controller.render()

    controller.disconnect()

    expect(view.finalize).toHaveBeenCalledOnce()
  })

  it("does not render when disconnected before the spec arrives", async () => {
    let resolveSpec
    getJson.mockReturnValue(new Promise((resolve) => { resolveSpec = resolve }))
    const controller = buildController()

    controller.connect()
    controller.disconnect()
    resolveSpec({ marks: [] })
    await vi.waitFor(() => expect(getJson).toHaveBeenCalled())
    await Promise.resolve()

    expect(global.vega.View).not.toHaveBeenCalled()
  })

  it("logs a failed spec fetch instead of throwing", async () => {
    const error = new Error("boom")
    getJson.mockRejectedValue(error)
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const controller = buildController()

    controller.connect()

    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith(error))
    expect(global.vega.View).not.toHaveBeenCalled()
  })
})

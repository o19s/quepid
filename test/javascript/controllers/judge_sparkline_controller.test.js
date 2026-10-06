import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import JudgeSparklineController from "controllers/judge_sparkline_controller"

function buildController(values) {
  const controller = Object.create(JudgeSparklineController.prototype)
  controller.element = document.createElement("div")
  controller.colorValue = "#0d6efd"
  controller.valuesValue = values
  return controller
}

describe("JudgeSparklineController", () => {
  let view

  beforeEach(() => {
    view = { data: vi.fn(), resize: vi.fn().mockReturnThis(), run: vi.fn(), finalize: vi.fn() }
    global.vegaEmbed = vi.fn().mockResolvedValue({ view })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("embeds once on connect with the initial values, named so later updates can target it", async () => {
    const controller = buildController([ { date: "Sep 1", count: 2 } ])

    controller.connect()
    await Promise.resolve()

    expect(global.vegaEmbed).toHaveBeenCalledTimes(1)
    const [ element, spec, options ] = global.vegaEmbed.mock.calls[0]
    expect(element).toBe(controller.element)
    expect(spec.data).toEqual({ name: "source", values: [ { date: "Sep 1", count: 2 } ] })
    expect(options).toEqual({ actions: false, renderer: "svg" })
  })

  it("pushes new data into the existing view rather than re-embedding", async () => {
    const controller = buildController([])
    controller.connect()
    await Promise.resolve()

    controller.updateValues([ { date: "Sep 2", count: 5 } ])

    expect(global.vegaEmbed).toHaveBeenCalledTimes(1)
    expect(view.data).toHaveBeenCalledWith("source", [ { date: "Sep 2", count: 5 } ])
    expect(view.resize).toHaveBeenCalledOnce()
    expect(view.run).toHaveBeenCalledOnce()
  })

  it("does nothing when asked to update before the chart has finished embedding", () => {
    const controller = buildController([])

    expect(() => controller.updateValues([ { date: "Sep 2", count: 5 } ])).not.toThrow()
    expect(view.data).not.toHaveBeenCalled()
  })

  it("finalizes the view on disconnect so a removed row doesn't leak its Vega listeners", async () => {
    const controller = buildController([])
    controller.connect()
    await Promise.resolve()

    controller.disconnect()

    expect(view.finalize).toHaveBeenCalledOnce()
  })

  it("does nothing on disconnect before the chart has finished embedding", () => {
    const controller = buildController([])

    expect(() => controller.disconnect()).not.toThrow()
  })
})

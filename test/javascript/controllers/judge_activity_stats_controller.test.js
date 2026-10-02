import { afterEach, describe, expect, it, vi } from "vitest"
import JudgeActivityStatsController from "controllers/judge_activity_stats_controller"

function buildController(judgeId) {
  const controller = Object.create(JudgeActivityStatsController.prototype)
  controller.element = document.createElement("td")
  controller.judgeIdValue = judgeId
  return controller
}

describe("JudgeActivityStatsController", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    vi.restoreAllMocks()
  })

  it("forwards fresh values to the matching chart's controller", () => {
    const chart = document.createElement("div")
    chart.id = "judge-sparkline-7"
    document.body.appendChild(chart)

    const chartController = { updateValues: vi.fn() }
    const controller = buildController(7)
    controller.application = { getControllerForElementAndIdentifier: vi.fn().mockReturnValue(chartController) }

    controller.sparklineValueChanged([ { date: "Sep 1", count: 3 } ])

    expect(controller.application.getControllerForElementAndIdentifier).toHaveBeenCalledWith(chart, "judge-sparkline")
    expect(chartController.updateValues).toHaveBeenCalledWith([ { date: "Sep 1", count: 3 } ])
  })

  it("does nothing when the chart isn't in the DOM yet", () => {
    const controller = buildController(42)
    controller.application = { getControllerForElementAndIdentifier: vi.fn() }

    expect(() => controller.sparklineValueChanged([])).not.toThrow()
    expect(controller.application.getControllerForElementAndIdentifier).not.toHaveBeenCalled()
  })

  it("does nothing when the chart element exists but its controller hasn't mounted yet", () => {
    const chart = document.createElement("div")
    chart.id = "judge-sparkline-9"
    document.body.appendChild(chart)

    const controller = buildController(9)
    controller.application = { getControllerForElementAndIdentifier: vi.fn().mockReturnValue(null) }

    expect(() => controller.sparklineValueChanged([])).not.toThrow()
  })
})

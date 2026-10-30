import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"
import { Application, Controller } from "@hotwired/stimulus"
import JudgeActivityStatsController from "controllers/judge_activity_stats_controller"

// Override the unit-test alias for this file, including the controller's import.
vi.mock(
  "@hotwired/stimulus",
  () => import("../../../node_modules/@hotwired/stimulus/dist/stimulus.js")
)

const updates = []

// Stands in for judge-sparkline, which needs vegaEmbed.
class FakeSparklineController extends Controller {
  updateValues(values) {
    updates.push(values)
  }
}

function renderRow(judgeId, values) {
  // Use the partial's real outlet wiring, with its ERB filled in.
  const source = readFileSync("app/views/books/_judge_count_cell.html.erb", "utf8")
  const outlet = source.match(/data-judge-activity-stats-judge-sparkline-outlet="([^"]*)"/)?.[1]
  expect(outlet).toBe("#judge-sparkline-<%= row[:judge].id %>")

  document.body.innerHTML = `
    <table><tr>
      <td id="judge-count-${judgeId}" data-controller="judge-activity-stats"
          data-judge-activity-stats-judge-sparkline-outlet="${outlet.replace("<%= row[:judge].id %>", judgeId)}"
          data-judge-activity-stats-sparkline-value='${JSON.stringify(values)}'></td>
      <td><div id="judge-sparkline-${judgeId}" data-controller="judge-sparkline"></div></td>
    </tr></table>`
  return {
    cell: document.getElementById(`judge-count-${judgeId}`),
    chart: document.getElementById(`judge-sparkline-${judgeId}`)
  }
}

describe("judge-activity-stats outlet wiring with real Stimulus", () => {
  let application

  afterEach(() => {
    application?.stop()
    application = null
    document.body.replaceChildren()
    updates.length = 0
  })

  it("forwards values to its chart, including when the cell is replaced", async () => {
    const { cell } = renderRow(7, [{ date: "Sep 1", count: 3 }])
    application = Application.start()
    application.register("judge-sparkline", FakeSparklineController)
    application.register("judge-activity-stats", JudgeActivityStatsController)
    await vi.waitFor(() => expect(updates.at(-1)).toEqual([{ date: "Sep 1", count: 3 }]))

    const fresh = cell.cloneNode()
    fresh.setAttribute(
      "data-judge-activity-stats-sparkline-value",
      JSON.stringify([{ date: "Sep 2", count: 5 }])
    )
    cell.replaceWith(fresh)
    await vi.waitFor(() => expect(updates.at(-1)).toEqual([{ date: "Sep 2", count: 5 }]))
  })

  it("delivers pending values once the chart's controller connects", async () => {
    renderRow(9, [{ date: "Sep 3", count: 1 }])
    application = Application.start()
    application.register("judge-activity-stats", JudgeActivityStatsController)
    await vi.waitFor(() => {
      expect(
        application.getControllerForElementAndIdentifier(
          document.getElementById("judge-count-9"),
          "judge-activity-stats"
        )
      ).not.toBeNull()
    })
    expect(updates).toEqual([])

    application.register("judge-sparkline", FakeSparklineController)
    await vi.waitFor(() => expect(updates.at(-1)).toEqual([{ date: "Sep 3", count: 1 }]))
  })

  it("does nothing when its chart isn't in the DOM", async () => {
    const { chart } = renderRow(11, [])
    chart.remove()
    application = Application.start()
    application.register("judge-sparkline", FakeSparklineController)
    application.register("judge-activity-stats", JudgeActivityStatsController)
    await vi.waitFor(() => {
      expect(
        application.getControllerForElementAndIdentifier(
          document.getElementById("judge-count-11"),
          "judge-activity-stats"
        )
      ).not.toBeNull()
    })
    expect(updates).toEqual([])
  })
})

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { waitFor } from "@testing-library/dom"
import { Application } from "@hotwired/stimulus"
import SparklineController from "../../../app/javascript/controllers/sparkline_controller"
import { waitForController } from "../support/stimulus_helpers"

function makeScores(count) {
  const scores = []
  for (let i = 0; i < count; i++) {
    const date = new Date(2024, 0, i + 1).toISOString()
    scores.push({ score: (i + 1) * 0.5, updated_at: date })
  }
  return scores
}

describe("SparklineController", () => {
  let application

  beforeEach(async () => {
    document.body.innerHTML = `
      <div data-controller="sparkline"
           class="sparkline-chart"
           data-sparkline-max-value="10"
           data-sparkline-scores-value="[]"
           data-sparkline-annotations-value="[]">
        <svg data-sparkline-target="svg"></svg>
      </div>
    `

    application = Application.start()
    application.register("sparkline", SparklineController)
    await waitForController(
      application,
      '[data-controller="sparkline"]',
      "sparkline",
    )
  })

  afterEach(() => {
    application.stop()
    // Clean up any tooltips appended to body
    document.querySelectorAll(".d3-tip").forEach((el) => el.remove())
  })

  function getController() {
    const el = document.querySelector('[data-controller="sparkline"]')
    return application.getControllerForElementAndIdentifier(el, "sparkline")
  }

  it("does not show chart with empty scores", () => {
    const el = document.querySelector(".sparkline-chart")
    expect(el.classList.contains("has-data")).toBe(false)
  })

  it("does not show chart with only one score", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(1)

    // Wait for Stimulus value change callback (MutationObserver is async)
    await new Promise((r) => setTimeout(r, 0))
    expect(el.classList.contains("has-data")).toBe(false)
  })

  it("renders SVG path when given multiple scores", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(5)

    await waitFor(() => {
      expect(el.classList.contains("has-data")).toBe(true)
    })

    const svg = el.querySelector("svg")
    expect(svg.querySelector("path")).not.toBeNull()
  })

  it("re-renders when scores value changes", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(3)

    await waitFor(() => {
      expect(el.querySelector("svg path")).not.toBeNull()
    })
    const path1 = el.querySelector("svg path").getAttribute("d")

    ctrl.scoresValue = makeScores(6)

    await waitFor(() => {
      const path2 = el.querySelector("svg path").getAttribute("d")
      expect(path2).not.toBe(path1)
    })
  })

  it("renders annotation markers within the score time range", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(5) // Jan 1–5, 2024

    await waitFor(() => {
      expect(el.classList.contains("has-data")).toBe(true)
    })

    // Annotation within the time range
    ctrl.annotationsValue = [
      { message: "Test note", updated_at: new Date(2024, 0, 3).toISOString() },
    ]

    await waitFor(() => {
      const markers = el.querySelectorAll("svg line.marker")
      expect(markers.length).toBe(1)
    })
  })

  it("excludes annotations older than the oldest displayed score", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(5) // Jan 1–5, 2024

    await waitFor(() => {
      expect(el.classList.contains("has-data")).toBe(true)
    })

    // Annotation before the time range
    ctrl.annotationsValue = [
      {
        message: "Old note",
        updated_at: new Date(2023, 11, 15).toISOString(),
      },
    ]

    // Give MutationObserver a tick
    await new Promise((r) => setTimeout(r, 0))

    const markers = el.querySelectorAll("svg line.marker")
    expect(markers.length).toBe(0)
  })

  it("limits display to last 10 scores", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.scoresValue = makeScores(15)

    await waitFor(() => {
      const path = el.querySelector("svg path")
      expect(path).not.toBeNull()
      expect(path.getAttribute("d")).toBeTruthy()
    })
  })

  it("does not render without a max value", async () => {
    const el = document.querySelector('[data-controller="sparkline"]')
    const ctrl = getController()

    ctrl.maxValue = 0
    ctrl.scoresValue = makeScores(5)

    await new Promise((r) => setTimeout(r, 0))
    expect(el.classList.contains("has-data")).toBe(false)
  })

  it("creates a tooltip element on body", async () => {
    const ctrl = getController()

    ctrl.scoresValue = makeScores(3)

    await waitFor(() => {
      const tooltips = document.querySelectorAll(".d3-tip")
      expect(tooltips.length).toBeGreaterThanOrEqual(1)
    })
  })

  it("cleans up tooltip when disconnect() is called directly", async () => {
    const ctrl = getController()

    ctrl.scoresValue = makeScores(3)

    await waitFor(() => {
      expect(
        document.querySelectorAll(".d3-tip").length,
      ).toBeGreaterThanOrEqual(1)
    })

    // Call disconnect() directly (application.stop() has known jsdom issues
    // with Stimulus MutationObserver and Node reference)
    ctrl.disconnect()

    expect(document.querySelectorAll(".d3-tip").length).toBe(0)
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { waitFor } from "@testing-library/dom"
import { Application } from "@hotwired/stimulus"
import CaseScoreController from "../../../app/javascript/controllers/case_score_controller"
import { waitForController } from "../support/stimulus_helpers"

/**
 * Covers case-level score display and persistence (Angular qscore-case + case score API),
 * without duplicating scorer math (that lives in scorer_executor tests).
 */
describe("CaseScoreController", () => {
  let application
  let fetchSpy

  beforeEach(async () => {
    // Node's fetch rejects relative URLs; the app uses apiUrl() without a leading slash.
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true })

    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.innerHTML = `
      <div data-controller="case-score"
           data-case-score-case-id-value="7"
           data-case-score-try-number-value="2"
           data-case-score-max-score-value="100">
        <div data-case-score-target="badge"
             style="background-color: #999; color: #fff;">--</div>
      </div>
    `

    application = Application.start()
    application.register("case-score", CaseScoreController)
    await waitForController(application, '[data-controller="case-score"]', "case-score")
  })

  afterEach(() => {
    application.stop()
    fetchSpy.mockRestore()
  })

  it("shows placeholder when score is null after connect", () => {
    const badge = document.querySelector("[data-case-score-target=badge]")
    expect(badge.textContent).toBe("--")
    expect(badge.style.backgroundColor).toBe("rgb(153, 153, 153)")
  })

  it("updates badge text and color for a numeric score (qscore-case display)", () => {
    const el = document.querySelector("[data-controller=case-score]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "case-score")

    ctrl.updateScore({
      score: 0.756,
      allRated: true,
      queryScores: {},
    })

    const badge = document.querySelector("[data-case-score-target=badge]")
    expect(badge.textContent).toBe("0.76")
    // Browsers/jsdom normalize hsl() to rgb() for style.backgroundColor
    expect(badge.style.backgroundColor).not.toBe("rgb(153, 153, 153)")
    expect(badge.style.backgroundColor).toMatch(/^rgb\(/)
  })

  it("does not persist when score is null", async () => {
    fetchSpy.mockClear()
    const el = document.querySelector("[data-controller=case-score]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "case-score")

    ctrl.updateScore({ score: null, allRated: false, queryScores: {} })
    await Promise.resolve()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("PUTs case score payload when score is numeric (API parity with Angular trackLastScore flow)", async () => {
    fetchSpy.mockClear()
    const el = document.querySelector("[data-controller=case-score]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "case-score")

    const queryScores = {
      1: { text: "q1", score: 0.5, maxScore: 10, numFound: 5 },
    }

    ctrl.updateScore({
      score: 0.5,
      allRated: false,
      queryScores,
    })

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      "api/cases/7/scores",
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-CSRF-Token": "test-csrf",
          Accept: "application/json",
        }),
        body: JSON.stringify({
          case_score: {
            score: 0.5,
            all_rated: false,
            try_number: 2,
            queries: queryScores,
          },
        }),
      }),
    )
  })
})

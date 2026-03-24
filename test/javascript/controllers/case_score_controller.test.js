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

  function mockFetchResponses(overrides = {}) {
    const defaults = {
      scores: { scores: [] },
      annotations: { annotations: [] },
      put: { score: 0.5, updated_at: new Date().toISOString() },
    }
    const responses = { ...defaults, ...overrides }

    fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((url, opts) => {
      // Score history GET (scores/all)
      if (typeof url === "string" && url.includes("/scores/all")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responses.scores),
        })
      }
      // Annotations GET
      if (typeof url === "string" && url.includes("/annotations")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responses.annotations),
        })
      }
      // Score PUT
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(responses.put),
      })
    })
  }

  beforeEach(async () => {
    mockFetchResponses()

    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.innerHTML = `
      <div data-controller="case-score"
           data-case-score-case-id-value="7"
           data-case-score-try-number-value="2"
           data-case-score-max-score-value="100">
        <div data-case-score-target="badge"
             class="case-score-badge">--</div>
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
    expect(badge.classList.contains("score-badge-unscored")).toBe(true)
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
    expect(badge.classList.contains("score-badge-unscored")).toBe(false)
    // Dynamic score color is set via inline style (Angular qscoreSvc decile palette)
    expect(badge.style.backgroundColor).toMatch(/^(rgb|hsl)\(/)
  })

  it("does not persist when score is null", async () => {
    // Wait for the connect fetch calls to complete
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
    fetchSpy.mockClear()

    const el = document.querySelector("[data-controller=case-score]")
    const ctrl = application.getControllerForElementAndIdentifier(el, "case-score")

    ctrl.updateScore({ score: null, allRated: false, queryScores: {} })
    await Promise.resolve()

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("PUTs case score payload when score is numeric (API parity with Angular trackLastScore flow)", async () => {
    // Wait for the connect fetch calls to complete
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })
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

  it("fetches score history and annotations on connect", async () => {
    await waitFor(() => {
      const scoreCalls = fetchSpy.mock.calls.filter(
        ([url]) => typeof url === "string" && url.includes("scores/all"),
      )
      expect(scoreCalls.length).toBeGreaterThanOrEqual(1)
    })

    const annotationCalls = fetchSpy.mock.calls.filter(
      ([url]) => typeof url === "string" && url.includes("annotations"),
    )
    expect(annotationCalls.length).toBeGreaterThanOrEqual(1)
  })
})

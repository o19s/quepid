import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import QscoreCaseController from "controllers/qscore_case_controller"
import { CaseScoreStore } from "stores/case_score_store"
import { diffStateStore } from "stores/diff_state_store"
import { buildCaseDiffScores } from "utils/diff_scores"

vi.mock("utils/diff_scores", () => ({ buildCaseDiffScores: vi.fn() }))

/**
 * Store-driven Stimulus controller for the legacy <qscore-case> component's
 * primary "current case score" usage (§ Re-render mechanism, step 4) — same pattern as
 * qscore_query_controller.test.js.
 */
function buildController(element, { caseId = 1, scoreLabel = "AP@10" } = {}) {
  const controller = Object.create(QscoreCaseController.prototype)
  controller.element = element
  controller.valueTarget = element.querySelector('[data-qscore-case-target="value"]')
  controller.labelTarget = element.querySelector('[data-qscore-case-target="label"]')
  controller.hasLabelTarget = !!controller.labelTarget
  controller.caseIdValue = caseId
  controller.scoreLabelValue = scoreLabel
  controller.scoreUrlValue = ""
  controller.tryNumberValue = 1
  controller.hasScoreUrlValue = false
  return controller
}

describe("QscoreCaseController", () => {
  let element
  let valueEl
  let labelEl
  let store

  beforeEach(() => {
    buildCaseDiffScores.mockReset()
    element = document.createElement("div")
    valueEl = document.createElement("span")
    valueEl.dataset.qscoreCaseTarget = "value"
    labelEl = document.createElement("span")
    labelEl.dataset.qscoreCaseTarget = "label"
    element.appendChild(valueEl)
    element.appendChild(labelEl)
    document.body.appendChild(element)

    store = new CaseScoreStore()
    window.quepidStore = { scoring: store }
  })

  afterEach(() => {
    element.remove()
    delete window.quepidStore
    delete window.quepidSearch
    diffStateStore.reset()
    vi.unstubAllGlobals()
  })

  it("renders '?' with the unscored color and the server-rendered label before the store has any data", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")
    expect(element.style.backgroundColor).toBe("hsl(0, 0%, 0%, 0.5)")
    QscoreCaseController.prototype.disconnect.call(controller)
    expect(labelEl.textContent).toBe("AP@10")
  })

  it("renders the formatted score and color once the store has a case score", () => {
    store.setLatestScoreInfo({
      allRated: true,
      score:    0.9,
      queries:  { 1: { score: 0.9, maxScore: 1, text: "q1", numFound: 10 } }
    })

    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("0.90")
    // hsl(90, 85%, 40%) is the top-of-scale-adjacent green step for a 1.0-scale
    // scorer's caseScore.maxScore, not a fixed 100-point default.
    expect(element.style.backgroundColor).toBe("hsl(90, 85%, 40%)")
    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("re-renders when the store emits 'change' after connect", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    expect(valueEl.textContent).toBe("?")

    store.setLatestScoreInfo({
      allRated: true,
      score:    0.5,
      queries:  { 1: { score: 0.5, maxScore: 1, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("0.50")
    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("stops reacting to store changes after disconnect", () => {
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)
    QscoreCaseController.prototype.disconnect.call(controller)

    store.setLatestScoreInfo({
      allRated: true,
      score:    0.5,
      queries:  { 1: { score: 0.5, maxScore: 1, text: "q1", numFound: 3 } }
    })

    expect(valueEl.textContent).toBe("?")
  })

  it("updates the label when pick-scorer:selected fires for this case", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    controller.handleScorerSelected(
      new CustomEvent("pick-scorer:selected", {
        detail: { caseId: 7, scorer: { name: "NDCG@10" } }
      })
    )

    expect(labelEl.textContent).toBe("NDCG@10")
    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("ignores pick-scorer:selected for a different case", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)

    controller.handleScorerSelected(
      new CustomEvent("pick-scorer:selected", {
        detail: { caseId: 99, scorer: { name: "NDCG@10" } }
      })
    )

    expect(labelEl.textContent).toBe("AP@10")
    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("ignores scorer events with no scorer payload", () => {
    const controller = buildController(element, { caseId: 7, scoreLabel: "AP@10" })
    controller.handleScorerSelected({ detail: { caseId: 7 } })
    expect(labelEl.textContent).not.toBe("NDCG@10")
  })

  it("does not persist the unrated '--' sentinel as a case score", () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const controller = buildController(element)
    controller.persistScore({
      caseScore: { score: "--", allRated: false },
      queryScores: { 1: { score: "--" } }
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it("persists a scored case through the server-owned score URL", async () => {
    const fetch = vi.fn().mockResolvedValue({ text: async () => "", json: async () => null,  ok: true })
    vi.stubGlobal("fetch", fetch)
    const controller = buildController(element, { caseId: 7 })
    controller.scoreUrlValue = "api/cases/1/scores"
    controller.hasScoreUrlValue = true

    await controller.persistScore({
      caseScore: { score: 0.8, allRated: true },
      queryScores: { 1: { score: 0.8 }, 2: { score: null } }
    })
    expect(fetch).toHaveBeenCalledWith("api/cases/1/scores", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        case_score: {
          score: 0.8,
          all_rated: true,
          try_number: 1,
          queries: { 1: { score: 0.8 }, 2: { score: null } }
        }
      })
    }))
  })

  it("does not persist a score without a valid try number", () => {
    const fetch = vi.fn()
    vi.stubGlobal("fetch", fetch)
    const controller = buildController(element)
    controller.scoreUrlValue = "api/cases/1/scores"
    controller.hasScoreUrlValue = true
    controller.tryNumberValue = 0

    controller.persistScore({
      caseScore: { score: 0.8, allRated: true },
      queryScores: { 1: { score: 0.8 } }
    })

    expect(fetch).not.toHaveBeenCalled()
  })

  it("recalculates and publishes case-level diff scores", async () => {
    const setCaseDiffs = vi.fn()
    const query = { diffs: { fetch: vi.fn().mockResolvedValue(undefined) } }
    const documentsStore = { setCaseDiffs, clearCaseDiffs: vi.fn() }
    buildCaseDiffScores.mockReturnValue([
      { name: "Snapshot", version: 1, score: { score: 0.75, maxScore: 1 } }
    ])

    window.quepidStore.documents = documentsStore
    diffStateStore.enable(["1"])
    window.quepidSearch = {
      queryCapabilities: {
        getQueries: () => ({ 1: query }),
        refreshAllDiffs: vi.fn(() => query.diffs.fetch())
      }
    }
    const controller = buildController(element)
    controller.store = store
    await controller.refreshCaseDiffScores({ refreshQueries: true })

    expect(query.diffs.fetch).toHaveBeenCalledOnce()
    expect(buildCaseDiffScores).toHaveBeenCalledWith([query], 1)
    expect(setCaseDiffs).toHaveBeenCalledWith([
      { name: "Snapshot", version: 1, score: { score: 0.75, maxScore: 1 } }
    ])
  })

  it("refreshes case diff scores when comparison diffs are rebuilt", async () => {
    const setCaseDiffs = vi.fn()
    const documentsStore = { setCaseDiffs, clearCaseDiffs: vi.fn() }
    const query = { diffs: { getSearchers: () => [] } }
    buildCaseDiffScores.mockReturnValue([])

    window.quepidStore.documents = documentsStore
    diffStateStore.enable(["1"])
    window.quepidSearch = {
      queryCapabilities: {
        getQueries: () => ({ 1: query }),
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      }
    }
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)
    await controller.handleDiffsRefreshed(new CustomEvent("query-diffs:refreshed"))
    await vi.waitFor(() => expect(buildCaseDiffScores).toHaveBeenCalled())

    expect(buildCaseDiffScores).toHaveBeenCalledWith([query], 1)
    expect(setCaseDiffs).toHaveBeenCalledWith([])

    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("clears stale case diff scores when a diff refresh fails", async () => {
    const clearCaseDiffs = vi.fn()
    const documentsStore = { setCaseDiffs: vi.fn(), clearCaseDiffs }
    const query = { diffs: { fetch: vi.fn().mockRejectedValue(new Error("diff failed")) } }

    window.quepidStore.documents = documentsStore
    diffStateStore.enable(["1"])
    window.quepidSearch = {
      queryCapabilities: {
        getQueries: () => ({ 1: query }),
        refreshAllDiffs: vi.fn(() => query.diffs.fetch())
      }
    }
    const controller = buildController(element)
    await expect(controller.refreshCaseDiffScores({ refreshQueries: true })).resolves.toBeUndefined()

    expect(clearCaseDiffs).toHaveBeenCalledOnce()
  })

  it("clears case diff scores when comparison rebuilding reports failure", async () => {
    const clearCaseDiffs = vi.fn()
    const documentsStore = { setCaseDiffs: vi.fn(), clearCaseDiffs }

    window.quepidStore.documents = documentsStore
    diffStateStore.enable(["1"])
    window.quepidSearch = {
      queryCapabilities: {
        getQueries: () => ({}),
        refreshAllDiffs: vi.fn().mockResolvedValue(undefined)
      }
    }
    const controller = buildController(element)
    QscoreCaseController.prototype.initialize.call(controller)
    QscoreCaseController.prototype.connect.call(controller)
    await controller.handleDiffsRefreshed(new CustomEvent("query-diffs:refreshed", {
      detail: { success: false }
    }))
    await vi.waitFor(() => expect(clearCaseDiffs).toHaveBeenCalled())

    expect(clearCaseDiffs).toHaveBeenCalledOnce()

    QscoreCaseController.prototype.disconnect.call(controller)
  })

  it("ignores a late rating refresh after a newer diff refresh", async () => {
    let resolveFetch
    const fetch = vi.fn(() => new Promise(resolve => { resolveFetch = resolve }))
    const setCaseDiffs = vi.fn()
    const clearCaseDiffs = vi.fn()
    const query = { diffs: { fetch } }
    buildCaseDiffScores.mockReturnValue([{ name: "New", score: {} }])
    const documentsStore = { setCaseDiffs, clearCaseDiffs }

    window.quepidStore.documents = documentsStore
    diffStateStore.enable(["1"])
    window.quepidSearch = {
      queryCapabilities: {
        getQueries: () => ({ 1: query }),
        refreshAllDiffs: vi.fn(() => query.diffs.fetch())
      }
    }
    const controller = buildController(element)
    controller.store = store
    const oldRefresh = controller.refreshCaseDiffScores({ refreshQueries: true })
    const newRefresh = controller.refreshCaseDiffScores()
    await newRefresh
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    resolveFetch()
    await oldRefresh

    expect(setCaseDiffs).toHaveBeenCalledTimes(1)
  })
})

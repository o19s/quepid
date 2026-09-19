import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import JudgementsCoreController from "controllers/judgements_core_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn(), show: vi.fn() })),
  hideBsModal: vi.fn()
}))

vi.mock("utils/flash", () => ({
  showFlash: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = Object.create(JudgementsCoreController.prototype)
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.caseUrlTemplateValue = "/api/cases/__CASE_ID__"
  controller.teamBooksUrlTemplateValue = "/api/teams/__TEAM_ID__/books"
  controller.refreshUrlTemplateValue =
    "/api/books/__BOOK_ID__/cases/__CASE_ID__/refresh?create_missing_queries=__CREATE_MISSING__&process_in_background=__BACKGROUND__"
  controller.newBookUrlTemplateValue = "books/new?scorer_id=__SCORER_ID__&origin_case_id=__CASE_ID__"
  controller.judgeUrlTemplateValue = "books/__BOOK_ID__/judge"

  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasLoadingTarget = true
  controller.loadingTarget = document.createElement("div")
  controller.hasNoTeamsTarget = true
  controller.noTeamsTarget = document.createElement("div")
  controller.hasNoBooksTarget = true
  controller.noBooksTarget = document.createElement("div")
  controller.hasBookPickerTarget = true
  controller.bookPickerTarget = document.createElement("div")
  controller.hasBookListTarget = true
  controller.bookListTarget = document.createElement("ul")
  controller.hasSelectHintTarget = true
  controller.selectHintTarget = document.createElement("div")
  controller.hasIntegrationTarget = true
  controller.integrationTarget = document.createElement("div")
  controller.hasAutoPopulateBookPairsTarget = true
  controller.autoPopulateBookPairsTarget = document.createElement("input")
  controller.autoPopulateBookPairsTarget.type = "checkbox"
  controller.hasAutoPopulateCaseJudgementsTarget = true
  controller.autoPopulateCaseJudgementsTarget = document.createElement("input")
  controller.autoPopulateCaseJudgementsTarget.type = "checkbox"
  controller.hasCreateBookLinkTarget = true
  controller.createBookLinkTarget = document.createElement("a")
  controller.hasCreateBookEmptyLinkTarget = true
  controller.createBookEmptyLinkTarget = document.createElement("a")
  controller.hasJudgeLinkTarget = true
  controller.judgeLinkTarget = document.createElement("a")
  controller.hasSaveButtonTarget = true
  controller.saveButtonTarget = document.createElement("button")
  controller.hasErrorTarget = true
  controller.errorTarget = document.createElement("div")
  controller.hasProgressTarget = true
  controller.progressTarget = document.createElement("div")
  controller.actionButtonTargets = []
  controller.hasCancelButtonTarget = true
  controller.cancelButtonTarget = document.createElement("button")
  controller.element = document.createElement("div")

  Object.assign(controller, overrides)
  return controller
}

describe("JudgementsCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the no-teams empty state when the case has no teams", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ teams: [], book_id: null, scorer_id: 7, queries_count: 0 })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreNameValue = "My Case"
    trigger.dataset.judgementsCoreScorerIdValue = "7"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.noTeamsTarget.classList.contains("d-none")).toBe(false)
    expect(controller.createBookLinkTarget.href).toContain("books/new?scorer_id=7&origin_case_id=42")
  })

  it("lists books with the active book first and tracks unsaved changes", async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            teams: [{ id: 1, name: "Team" }],
            book_id: 2,
            scorer_id: 7,
            queries_count: 3,
            auto_populate_book_pairs: false,
            auto_populate_case_judgements: true
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            books: [
              { id: 1, name: "Alpha" },
              { id: 2, name: "Beta" }
            ]
          })
      })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreBookIdValue = "2"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.books[0].id).toBe(2)
    expect(controller.hasUnsavedChanges()).toBe(false)

    controller.selectBook({ params: { bookId: 1 } })
    expect(controller.hasUnsavedChanges()).toBe(true)
    expect(controller.saveButtonTarget.classList.contains("d-none")).toBe(false)
  })

  it("prefers the API book_id over a stale trigger attribute", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          teams: [],
          book_id: 7,
          scorer_id: 1,
          queries_count: 0
        })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreBookIdValue = "2"

    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    expect(controller.savedBookId).toBe(7)
    expect(controller.activeBookId).toBe(7)
  })

  it("dispatches judgements:populate-book for Populate Now", async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            teams: [{ id: 1, name: "Team" }],
            book_id: 2,
            scorer_id: 7,
            queries_count: 3
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ books: [{ id: 2, name: "Beta" }] })
      })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreBookIdValue = "2"
    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    const events = []
    document.addEventListener("judgements:populate-book", (e) => events.push(e))

    await controller.manualPopulateBook({ preventDefault() {} })

    expect(events).toHaveLength(1)
    expect(events[0].detail).toMatchObject({ caseId: 42, bookId: 2 })
    expect(typeof events[0].detail.done).toBe("function")
  })

  it("disables Cancel while a save is in flight, re-enables on completion", async () => {
    apiFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            teams: [{ id: 1, name: "Team" }],
            book_id: null,
            scorer_id: 7,
            queries_count: 0
          })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ books: [{ id: 2, name: "Beta" }] })
      })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    await controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

    controller.selectBook({ params: { bookId: 2 } })

    let resolveSave
    apiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )

    const savePromise = controller.save({ preventDefault() {} })
    expect(controller.cancelButtonTarget.disabled).toBe(true)

    resolveSave({ ok: true, json: () => Promise.resolve({}) })
    await savePromise

    expect(controller.cancelButtonTarget.disabled).toBe(false)
  })
})

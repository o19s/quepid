import { buildControllerFixture } from "../support/controller_fixture"
import { viewTemplateTargets } from "../support/view_template"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import JudgementsCoreController from "controllers/judgements_core_controller"
import { showFlash } from "utils/flash"

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
  const controller = buildControllerFixture(JudgementsCoreController, {
    overrides: { identifier: "judgements-core" },
    targets: {
      ...viewTemplateTargets("app/views/core/_judgement_book_templates.html.erb", "judgements-core"),
      title: document.createElement("h5"),
      loading: document.createElement("div"),
      noTeams: document.createElement("div"),
      noBooks: document.createElement("div"),
      bookPicker: document.createElement("div"),
      bookList: document.createElement("ul"),
      selectHint: document.createElement("div"),
      integration: document.createElement("div"),
      autoPopulateBookPairs: document.createElement("input"),
      autoPopulateCaseJudgements: document.createElement("input"),
      createBookLink: document.createElement("a"),
      createBookEmptyLink: document.createElement("a"),
      judgeLink: document.createElement("a"),
      saveButton: document.createElement("button"),
      error: document.createElement("div"),
      progress: document.createElement("div"),
      actionButton: [],
      cancelButton: document.createElement("button")
    },
    values: {
      caseUrlTemplate: "/api/cases/__CASE_ID__",
      teamBooksUrlTemplate: "/api/teams/__TEAM_ID__/books",
      newBookUrlTemplate: "books/new?scorer_id=__SCORER_ID__&origin_case_id=__CASE_ID__",
      bookUrlTemplate: "books/__BOOK_ID__",
      judgeUrlTemplate: "books/__BOOK_ID__/judge"
    }
  })
  controller.refreshUrlTemplateValue =
    "/api/books/__BOOK_ID__/cases/__CASE_ID__/refresh?create_missing_queries=__CREATE_MISSING__&process_in_background=__BACKGROUND__"

  controller.autoPopulateBookPairsTarget.type = "checkbox"
  controller.autoPopulateCaseJudgementsTarget.type = "checkbox"
  controller.element.appendChild(controller.bookListTarget)

  Object.assign(controller, overrides)
  Object.defineProperty(controller, "itemTargets", {
    get: () => [...controller.element.querySelectorAll('[data-judgements-core-target~="item"]')]
  })
  return controller
}

describe("JudgementsCoreController", () => {
  it("renders names safely and replaces rows without losing the current selection", () => {
    const name = '<img src=x onerror="alert(1)">'
    const controller = buildModalController({ books: [{ id: 2, name }], activeBookId: 2 })
    controller.bookUrlTemplateValue = "/quepid/books/__BOOK_ID__"
    controller._renderBooks()
    controller._renderBooks()

    expect(controller.itemTargets).toHaveLength(2)
    const row = controller.itemTargets[1]
    expect(row.querySelector('[data-slot="name"]').textContent).toBe(name)
    expect(row.querySelector("img")).toBeNull()
    expect(row.dataset.action).toBe("click->judgements-core#selectBook")
    expect(row.querySelector("a").getAttribute("href")).toBe("/quepid/books/2")
    expect(row.classList.contains("active")).toBe(true)
    expect(controller.itemTargets[0].querySelector("em").textContent).toBe("None (disconnect from any book)")
  })

  it("shows the selection hint only with available books and no active book", () => {
    const controller = buildModalController({ books: [], activeBookId: null })
    controller._refreshIntegrationVisibility()
    expect(controller.selectHintTarget.classList.contains("d-none")).toBe(true)
    expect(controller.integrationTarget.classList.contains("d-none")).toBe(true)

    controller.books = [{ id: 2, name: "Catalog" }]
    controller._refreshIntegrationVisibility()
    expect(controller.selectHintTarget.classList.contains("d-none")).toBe(false)

    controller.activeBookId = 2
    controller._refreshIntegrationVisibility()
    expect(controller.selectHintTarget.classList.contains("d-none")).toBe(true)
    expect(controller.integrationTarget.classList.contains("d-none")).toBe(false)
  })

  it("opens Share through the share-case-core outlet once the modal has hidden, once per hide", () => {
    const shareCaseCore = { openFromExternal: vi.fn() }
    const controller = buildModalController({ currentCaseId: "7", hide: vi.fn() })
    controller.shareCaseCoreOutlet = shareCaseCore
    const event = { preventDefault: vi.fn() }

    controller.openShareCase(event)
    controller.openShareCase(event)
    expect(shareCaseCore.openFromExternal).not.toHaveBeenCalled()

    controller.element.dispatchEvent(new Event("hidden.bs.modal"))
    expect(shareCaseCore.openFromExternal).toHaveBeenCalledOnce()
    expect(shareCaseCore.openFromExternal).toHaveBeenCalledWith(7)
  })

  it("keeps View navigation independent of book selection", () => {
    const controller = buildModalController({ books: [{ id: 2, name: "Catalog" }] })
    controller._renderBooks()
    const link = controller.bookListTarget.querySelector("a")
    expect(link.getAttribute("href")).toBe("books/2")
    expect(link.dataset.action).toBe("click->judgements-core#viewBook")
    const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() }
    controller.viewBook(event)
    expect(event.stopPropagation).toHaveBeenCalledOnce()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it("highlights only the selected book target, including None", () => {
    const controller = buildModalController()
    controller.books = [{ id: 8, name: "Book" }]
    controller.activeBookId = 8
    controller._renderBooks()
    expect(controller.itemTargets.map(item => item.classList.contains("active"))).toEqual([false, true])
    controller.activeBookId = null
    controller._refreshBookSelection()
    expect(controller.itemTargets.map(item => item.classList.contains("active"))).toEqual([true, false])
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("shows the no-teams empty state when the case has no teams", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({ teams: [], book_id: null, scorer_id: 7, queries_count: 0 })
    })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreScorerIdValue = "7"

    await controller.openFor(trigger)

    expect(controller.noTeamsTarget.classList.contains("d-none")).toBe(false)
    expect(controller.createBookLinkTarget.href).toContain("books/new?scorer_id=7&origin_case_id=42")
  })

  it("lists books with the active book first and tracks unsaved changes", async () => {
    apiFetch
      .mockResolvedValueOnce({
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
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
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
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

    await controller.openFor(trigger)

    expect(controller.books[0].id).toBe(2)
    expect(controller.hasUnsavedChanges()).toBe(false)

    controller.selectBook({ params: { bookId: 1 } })
    expect(controller.hasUnsavedChanges()).toBe(true)
    expect(controller.saveButtonTarget.classList.contains("d-none")).toBe(false)
    // Regression: selectBook() must re-enable Save, not just unhide it —
    // setBusy(false) at load time disables it while there are no unsaved
    // changes yet, and nothing else re-enabled it afterward.
    expect(controller.saveButtonTarget.disabled).toBe(false)
  })

  it("prefers the API book_id over a stale trigger attribute", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
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

    await controller.openFor(trigger)

    expect(controller.savedBookId).toBe(7)
    expect(controller.activeBookId).toBe(7)
  })

  it("populates the book from the document store for Populate Now", async () => {
    apiFetch
      .mockResolvedValueOnce({
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
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
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
        ok: true,
        json: () => Promise.resolve({ books: [{ id: 2, name: "Beta" }] })
      })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    trigger.dataset.judgementsCoreBookIdValue = "2"
    await controller.openFor(trigger)

    const documentsStore = window.quepidStore?.documents
      || (await import("stores/query_documents_store")).queryDocumentsStore
    documentsStore.replaceQuery(1, {
      queryText: "search",
      docs: [{ id: "doc-1", title: "Document" }]
    })

    await controller.manualPopulateBook({ preventDefault() {} })

    expect(apiFetch).toHaveBeenLastCalledWith("api/books/2/populate", expect.objectContaining({ method: "PUT" }))
  })

  it("disables Cancel while a save is in flight, re-enables on completion", async () => {
    apiFetch
      .mockResolvedValueOnce({
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
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
        async text() {
          return JSON.stringify(await this.json()) || ""
        },
        ok: true,
        json: () => Promise.resolve({ books: [{ id: 2, name: "Beta" }] })
      })

    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.judgementsCoreIdValue = "42"
    await controller.openFor(trigger)

    controller.selectBook({ params: { bookId: 2 } })

    let resolveSave
    apiFetch.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSave = resolve
      })
    )

    const savePromise = controller.save({ preventDefault() {} })
    expect(controller.cancelButtonTarget.disabled).toBe(true)

    resolveSave({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: () => Promise.resolve({}) })
    await savePromise

    expect(controller.cancelButtonTarget.disabled).toBe(false)
  })

  describe("saving and refreshing against a book", () => {
    const ok = (data = {}) => ({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: () => Promise.resolve(data) })

    function linkedController(state = {}) {
      return Object.assign(buildModalController(), {
        currentCaseId: "42",
        activeBookId: 2,
        savedBookId: 2,
        autoPopulateBookPairs: true,
        savedAutoPopulateBookPairs: true,
        autoPopulateCaseJudgements: false,
        savedAutoPopulateCaseJudgements: false,
        queriesCount: 3
      }, state)
    }

    it("does nothing when there are no unsaved changes", async () => {
      await linkedController().save({ preventDefault() {} })

      expect(apiFetch).not.toHaveBeenCalled()
    })

    it("saves the book link and sync flags, then announces the new settings", async () => {
      apiFetch.mockResolvedValueOnce(ok({ book_name: "Catalog" }))
      const saved = vi.fn()
      document.addEventListener("quepid:case-book-updated", saved)
      const controller = linkedController({ autoPopulateCaseJudgements: true, savedBookId: 2 })

      await controller.save({ preventDefault() {} })

      const [url, init] = apiFetch.mock.calls[0]
      expect(url).toBe("/api/cases/42")
      expect(init.method).toBe("PUT")
      expect(JSON.parse(init.body)).toEqual({ book_id: 2, auto_populate_book_pairs: true, auto_populate_case_judgements: true })
      expect(saved.mock.calls[0][0].detail).toEqual({
        caseId: 42, bookId: 2, bookName: "Catalog", autoPopulateBookPairs: true, autoPopulateCaseJudgements: true
      })
      expect(controller.hasUnsavedChanges()).toBe(false)
      expect(showFlash).toHaveBeenCalledWith("success", "Settings saved.")
      document.removeEventListener("quepid:case-book-updated", saved)
    })

    it("turns both sync flags off when the book is unlinked", async () => {
      apiFetch.mockResolvedValueOnce(ok())
      const controller = linkedController({ activeBookId: null, autoPopulateCaseJudgements: true })

      await controller.save({ preventDefault() {} })

      expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
        book_id: null, auto_populate_book_pairs: false, auto_populate_case_judgements: false
      })
    })

    it("refreshes ratings straight after linking a new book with case judgements on", async () => {
      apiFetch.mockResolvedValueOnce(ok()).mockResolvedValueOnce(ok())
      const reload = vi.fn()
      document.addEventListener("judgements:queries-need-reload", reload)
      const controller = linkedController({ activeBookId: 5, savedBookId: 2, autoPopulateCaseJudgements: true })

      await controller.save({ preventDefault() {} })

      expect(apiFetch.mock.calls[1][0]).toBe("/api/books/5/cases/42/refresh?create_missing_queries=false&process_in_background=false")
      expect(showFlash).toHaveBeenCalledWith("success", "Settings saved. Ratings have been refreshed.")
      expect(reload).toHaveBeenCalledOnce()
      document.removeEventListener("judgements:queries-need-reload", reload)
    })

    it("shows the server's message when saving fails", async () => {
      apiFetch.mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 422, json: () => Promise.resolve({ error: "Book not found" }) })
      vi.spyOn(console, "error").mockImplementation(() => {})
      const controller = linkedController({ activeBookId: 9 })

      await controller.save({ preventDefault() {} })

      expect(controller.errorTarget.textContent).toContain("An error (Book not found) occurred")
      expect(controller.savedBookId).toBe(2)
      expect(controller.cancelButtonTarget.disabled).toBe(false)
    })

    it.each([
      ["manualRefreshRatings", "false", "Case ratings refreshed from book."],
      ["manualSyncQueries", "true", "Missing queries synced from book."]
    ])("%s refreshes from the book (create missing queries: %s) and reloads the queries", async (action, createMissing, message) => {
      apiFetch.mockResolvedValueOnce(ok())
      const reload = vi.fn()
      document.addEventListener("judgements:queries-need-reload", reload)

      await linkedController()[action]({ preventDefault() {} })

      expect(apiFetch.mock.calls[0][0]).toBe(`/api/books/2/cases/42/refresh?create_missing_queries=${createMissing}&process_in_background=false`)
      expect(showFlash).toHaveBeenCalledWith("success", message)
      expect(reload.mock.calls[0][0].detail).toEqual({ caseId: 42 })
      document.removeEventListener("judgements:queries-need-reload", reload)
    })

    it("refreshes a case with 50+ queries in the background and sends the user home with a notice", async () => {
      const originalHref = window.location.href
      vi.useFakeTimers()
      try {
        apiFetch.mockResolvedValueOnce(ok())
        const reload = vi.fn()
        document.addEventListener("judgements:queries-need-reload", reload)
        document.body.dataset.quepidRootUrl = "https://quepid.test"
        const controller = linkedController({ queriesCount: 50 })

        await controller.manualSyncQueries({ preventDefault() {} })

        const background = "Missing queries are being synced from book in the background."
        expect(apiFetch.mock.calls[0][0]).toContain("process_in_background=true")
        expect(showFlash).toHaveBeenCalledWith("success", background)
        expect(reload).not.toHaveBeenCalled()
        vi.advanceTimersByTime(500)
        expect(window.location.href).toBe(`https://quepid.test/?notice=${encodeURIComponent(background)}`)
        document.removeEventListener("judgements:queries-need-reload", reload)
      } finally {
        vi.useRealTimers()
        delete document.body.dataset.quepidRootUrl
        window.location.href = originalHref
      }
    })

    it("ignores a refresh result once the modal has moved on to another case", async () => {
      let resolveRefresh
      apiFetch.mockReturnValueOnce(new Promise((resolve) => { resolveRefresh = resolve }))
      const controller = linkedController()

      const pending = controller.manualRefreshRatings({ preventDefault() {} })
      controller.currentCaseId = "43"
      resolveRefresh({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 500, json: () => Promise.resolve({ error: "stale" }) })
      await pending

      expect(showFlash).not.toHaveBeenCalled()
      expect(controller.errorTarget.textContent).not.toContain("stale")
    })

    it("reports a failed refresh and skips the action without a book", async () => {
      apiFetch.mockResolvedValueOnce({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, status: 500, json: () => Promise.resolve({}) })
      vi.spyOn(console, "error").mockImplementation(() => {})
      const controller = linkedController()

      await controller.manualRefreshRatings({ preventDefault() {} })
      expect(controller.errorTarget.textContent).toContain("An error (Refresh failed (500)) occurred")

      apiFetch.mockClear()
      await linkedController({ activeBookId: null }).manualSyncQueries({ preventDefault() {} })
      expect(apiFetch).not.toHaveBeenCalled()
    })
  })
})

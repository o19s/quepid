import { CORE_EVENTS } from "utils/core_events"
import { serverMessage } from "utils/error_message"
import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { putJson, readJson } from "api/json"
import { apiFetch } from "api/fetch"
import { HttpError } from "api/http_error"
import { getQuepidRootUrl } from "utils/quepid_root"
import coreFlash from "utils/core_flash"
import { getCoreStores } from "utils/core_store_access"
import { populateBook } from "utils/book_sync"
import { caseRuntime } from "utils/case_runtime"
import { isSameId } from "utils/record_identity"

const CASE_ID_PLACEHOLDER = "__CASE_ID__"
const BOOK_ID_PLACEHOLDER = "__BOOK_ID__"
const BACKGROUND_QUERY_THRESHOLD = 50
const REDIRECT_DELAY_MS = 500

/**
 * Judgements / book-link modal for the core case toolbar. Loads books from the
 * case's teams, saves
 * book + sync settings via `PUT api/cases/:id`, and runs refresh/sync via
 * the books refresh API. "Populate Now" reads the document
 * store, while live search continues publishing the store from the live-query runtime. After ratings refresh that
 * should re-bootstrap queries, dispatches `judgements:queries-need-reload`.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "item",
    "title",
    "loading",
    "noTeams",
    "noBooks",
    "bookPicker",
    "bookList",
    "selectHint",
    "integration",
    "autoPopulateBookPairs",
    "autoPopulateCaseJudgements",
    "createBookLink",
    "createBookEmptyLink",
    "judgeLink",
    "saveButton",
    "error",
    "progress",
    "actionButton",
    "cancelButton"
  ]

  static outlets = ["share-case-core"]
  static values = {
    caseUrlTemplate: String,
    catalogUrlTemplate: String,
    refreshUrlTemplate: String,
    newBookUrlTemplate: String,
    judgeUrlTemplate: String
  }

  openFor(btn) {
    this.openGeneration = (this.openGeneration || 0) + 1
    const caseId = this.triggerValue(btn, "id")
    const scorerId = this.triggerValue(btn, "scorerId")
    const bookId = this.triggerValue(btn, "bookId")
    const queriesCount = this.triggerValue(btn, "queriesCount")
    const autoPairs = this.triggerValue(btn, "autoPopulateBookPairs")
    const autoJudgements = this.triggerValue(btn, "autoPopulateCaseJudgements")

    this.currentCaseId = caseId || ""
    this.scorerId = scorerId || ""
    this.queriesCount = Number(queriesCount || 0)
    this.savedBookId = bookId ? Number(bookId) : null
    this.activeBookId = this.savedBookId
    this.autoPopulateBookPairs = autoPairs === "true"
    this.autoPopulateCaseJudgements = autoJudgements !== "false"
    this.savedAutoPopulateBookPairs = this.autoPopulateBookPairs
    this.savedAutoPopulateCaseJudgements = this.autoPopulateCaseJudgements
    this.teams = []
    this.books = []

    if (this.hasTitleTarget) this.titleTarget.textContent = "Judgements"
    if (this.hasAutoPopulateBookPairsTarget) {
      this.autoPopulateBookPairsTarget.checked = this.autoPopulateBookPairs
    }
    if (this.hasAutoPopulateCaseJudgementsTarget) {
      this.autoPopulateCaseJudgementsTarget.checked = this.autoPopulateCaseJudgements
    }

    this._updateCreateBookLinks()
    this.clearError()
    this.setProgress(false)
    this.setBusy(false)
    return this._load()
  }

  selectBook(event) {
    const raw = event.params.bookId
    this.activeBookId = raw === "" || raw == null ? null : Number(raw)
    this._refreshBookSelection()
    this._refreshIntegrationVisibility()
    this._refreshSaveVisibility()
  }

  toggleAutoPopulateBookPairs(event) {
    this.autoPopulateBookPairs = event.target.checked
    this._refreshSaveVisibility()
  }

  toggleAutoPopulateCaseJudgements(event) {
    this.autoPopulateCaseJudgements = event.target.checked
    this._refreshSaveVisibility()
  }

  goToTeamsPage(event) {
    event?.preventDefault?.()
    this.hide()
    window.location.href = `${getQuepidRootUrl()}/teams`
  }

  openShareCase(event) {
    event?.preventDefault?.()
    const caseNo = this.currentCaseId
    // No case name: share-case-core reads the live name off the case header itself.
    const openShare = () => this.shareCaseCoreOutlet.openFromExternal(Number(caseNo))

    // A second call before the modal finishes hiding must replace, not add
    // to, the pending listener — otherwise both fire on the one hide event
    // and the share modal opens twice.
    if (this._pendingOpenShare) {
      this.element.removeEventListener("hidden.bs.modal", this._pendingOpenShare)
    }
    this._pendingOpenShare = openShare
    this.element.addEventListener("hidden.bs.modal", openShare, { once: true })
    this.hide()
  }

  async save(event) {
    event?.preventDefault?.()
    if (!this.hasUnsavedChanges()) return

    this.setBusy(true)
    this.clearError()

    const bookChanged = this.activeBookId !== this.savedBookId
    const shouldRefresh =
      this.autoPopulateCaseJudgements && bookChanged && this.activeBookId != null

    try {
      await this._saveBookSettings()

      if (shouldRefresh) {
        await this._refreshRatings({
          createMissingQueries: false,
          closeWithReload: true,
          successMessage: "Settings saved. Ratings have been refreshed.",
          backgroundMessage: "Settings saved. Ratings are being refreshed in the background."
        })
        return
      }

      coreFlash.show("success", "Settings saved.")
      this.hide()
      this.setBusy(false)
    } catch (error) {
      this._handleActionError(error)
    }
  }

  async manualPopulateBook(event) {
    event?.preventDefault?.()
    if (!this.activeBookId) return

    this.setBusy(true)
    this.clearError()
    this.setProgress(true)

    const caseId = this.currentCaseId
    const bookId = this.activeBookId

    try {
      const queries = Object.values(getCoreStores().documents.snapshot().queries || {})
      await populateBook({ bookId, caseId: Number(caseId), queries })
      if (!isSameId(this.currentCaseId, caseId)) return
      this.setProgress(false)
      coreFlash.show("success", "Updating Book with Query Doc Pairs.")
      this.hide()
      this.setBusy(false)
    } catch (error) {
      if (!isSameId(this.currentCaseId, caseId)) return
      this.setProgress(false)
      this._handleActionError(error)
    }
  }

  async manualRefreshRatings(event) {
    event?.preventDefault?.()
    if (!this.activeBookId) return

    this.setBusy(true)
    this.clearError()
    try {
      await this._refreshRatings({
        createMissingQueries: false,
        closeWithReload: true,
        successMessage: "Case ratings refreshed from book.",
        backgroundMessage: "Case ratings are being refreshed from book in the background."
      })
    } catch (error) {
      this._handleActionError(error)
    }
  }

  async manualSyncQueries(event) {
    event?.preventDefault?.()
    if (!this.activeBookId) return

    this.setBusy(true)
    this.clearError()
    try {
      await this._refreshRatings({
        createMissingQueries: true,
        closeWithReload: true,
        successMessage: "Missing queries synced from book.",
        backgroundMessage: "Missing queries are being synced from book in the background."
      })
    } catch (error) {
      this._handleActionError(error)
    }
  }

  hasUnsavedChanges() {
    const bookChanged = this.activeBookId !== this.savedBookId
    const syncChanged =
      this.autoPopulateBookPairs !== this.savedAutoPopulateBookPairs ||
      this.autoPopulateCaseJudgements !== this.savedAutoPopulateCaseJudgements
    return bookChanged || syncChanged
  }

  async _load() {
    const generation = this.openGeneration
    this.setLoading(true)
    this._setSectionsVisible({ books: false, noTeams: false, noBooks: false })

    try {
      const caseUrl = this.caseUrlTemplateValue.replaceAll(CASE_ID_PLACEHOLDER, this.currentCaseId)
      const caseId = this.currentCaseId
      const caseData = await caseRuntime.read(caseId, { url: caseUrl })
      if (this.openGeneration !== generation || !isSameId(this.currentCaseId, caseId)) return

      this.teams = Array.isArray(caseData.teams) ? caseData.teams : []
      // Prefer the live API book_id over the trigger attribute — the toolbar
      // dataset can lag after a prior save in this session.
      if (Object.prototype.hasOwnProperty.call(caseData, "book_id")) {
        this.savedBookId = caseData.book_id != null ? Number(caseData.book_id) : null
        this.activeBookId = this.savedBookId
      }
      if (caseData.scorer_id != null) this.scorerId = String(caseData.scorer_id)
      if (caseData.queries_count != null) this.queriesCount = Number(caseData.queries_count)
      if (caseData.auto_populate_book_pairs != null) {
        this.autoPopulateBookPairs = !!caseData.auto_populate_book_pairs
        this.savedAutoPopulateBookPairs = this.autoPopulateBookPairs
        if (this.hasAutoPopulateBookPairsTarget) {
          this.autoPopulateBookPairsTarget.checked = this.autoPopulateBookPairs
        }
      }
      if (caseData.auto_populate_case_judgements != null) {
        this.autoPopulateCaseJudgements = caseData.auto_populate_case_judgements !== false
        this.savedAutoPopulateCaseJudgements = this.autoPopulateCaseJudgements
        if (this.hasAutoPopulateCaseJudgementsTarget) {
          this.autoPopulateCaseJudgementsTarget.checked = this.autoPopulateCaseJudgements
        }
      }

      this._updateCreateBookLinks()

      const url = this.catalogUrlTemplateValue.replaceAll(CASE_ID_PLACEHOLDER, caseId)
      const response = await apiFetch(url, { headers: { Accept: "text/html" } })
      if (!response.ok) {
        throw new HttpError({ status: response.status, statusText: response.statusText, data: await readJson(response) })
      }
      if (response.redirected) throw new Error("Unable to load judgements settings.")
      const html = new DOMParser().parseFromString(await response.text(), "text/html")
      const catalog = html.querySelector("[data-book-catalog]")
      if (!catalog) throw new Error("Unable to load judgements settings.")
      if (this.openGeneration !== generation) return
      this._renderBooks([...catalog.children])
      this.setLoading(false)

      if (this.books.length === 0) {
        this._setSectionsVisible({ noBooks: true, noTeams: this.teams.length === 0 })
      } else {
        this._setSectionsVisible({ books: true })
      }

      this._refreshIntegrationVisibility()
      this._refreshSaveVisibility()
    } catch (error) {
      if (this.openGeneration !== generation) return
      console.error("judgements-core: load failed", error)
      this.setLoading(false)
      this.showError(error.message || "Unable to load judgements settings.")
    }
  }

  _renderBooks(rows) {
    if (!this.hasBookListTarget) return
    const [none, ...books] = rows
    // Preserve the browser's locale ordering and saved-book-first contract.
    books.sort((a, b) => {
      if (Number(a.dataset.judgementsCoreBookIdParam) === this.activeBookId) return -1
      if (Number(b.dataset.judgementsCoreBookIdParam) === this.activeBookId) return 1
      return a.querySelector('[data-slot="name"]').textContent.localeCompare(
        b.querySelector('[data-slot="name"]').textContent
      )
    })
    this.books = books.map((row) => ({
      id: Number(row.dataset.judgementsCoreBookIdParam),
      name: row.querySelector('[data-slot="name"]').textContent
    }))
    this.bookListTarget.replaceChildren(none, ...books)
    this._refreshBookSelection()
  }

  viewBook(event) {
    event.stopPropagation()
  }

  _refreshBookSelection() {
    if (!this.hasBookListTarget) return
    this.itemTargets.forEach((li) => {
      const raw = li.dataset.judgementsCoreBookIdParam
      const id = raw === "" ? null : Number(raw)
      li.classList.toggle("active", id === this.activeBookId)
    })

    if (this.hasJudgeLinkTarget) {
      const show = this.activeBookId != null
      this.toggleVisible(this.judgeLinkTarget, show)
      if (show) {
        this.judgeLinkTarget.href = this.judgeUrlTemplateValue.replaceAll(
          BOOK_ID_PLACEHOLDER,
          String(this.activeBookId)
        )
      }
    }
  }

  _refreshIntegrationVisibility() {
    const hasBooks = this.books.length > 0
    this.toggleVisible("selectHint", hasBooks && this.activeBookId == null)
    this.toggleVisible("integration", this.activeBookId)
  }

  _refreshSaveVisibility() {
    if (!this.hasSaveButtonTarget) return
    const hasChanges = this.hasUnsavedChanges()
    this.toggleVisible(this.saveButtonTarget, hasChanges)
    this.saveButtonTarget.disabled = this._busy || !hasChanges
  }

  _updateCreateBookLinks() {
    const href = this.newBookUrlTemplateValue
      .replaceAll("__SCORER_ID__", this.scorerId || "")
      .replaceAll(CASE_ID_PLACEHOLDER, this.currentCaseId || "")
    if (this.hasCreateBookLinkTarget) this.createBookLinkTarget.href = href
    if (this.hasCreateBookEmptyLinkTarget) this.createBookEmptyLinkTarget.href = href
  }

  async _saveBookSettings() {
    const url = this.caseUrlTemplateValue.replaceAll(CASE_ID_PLACEHOLDER, this.currentCaseId)
    const bookId = this.activeBookId
    const payload = {
      book_id: bookId,
      auto_populate_book_pairs: bookId ? this.autoPopulateBookPairs : false,
      auto_populate_case_judgements: bookId ? this.autoPopulateCaseJudgements : false
    }

    const caseId = this.currentCaseId
    const generation = this.openGeneration
    await caseRuntime.saveBookSettings(caseId, payload, { url })
    if (this.openGeneration !== generation || !isSameId(this.currentCaseId, caseId)) return

    this.savedBookId = bookId
    this.savedAutoPopulateBookPairs = payload.auto_populate_book_pairs
    this.savedAutoPopulateCaseJudgements = payload.auto_populate_case_judgements

  }

  async _refreshRatings({
    createMissingQueries,
    closeWithReload,
    successMessage,
    backgroundMessage
  }) {
    const processInBackground = this.queriesCount >= BACKGROUND_QUERY_THRESHOLD
    const caseId = this.currentCaseId
    const url = this.refreshUrlTemplateValue
      .replaceAll(BOOK_ID_PLACEHOLDER, String(this.activeBookId))
      .replaceAll(CASE_ID_PLACEHOLDER, caseId)
      .replaceAll("__CREATE_MISSING__", String(!!createMissingQueries))
      .replaceAll("__BACKGROUND__", String(processInBackground))

    this.setProgress(true)
    try {
      await putJson(url, {})
    } catch (error) {
      if (!isSameId(this.currentCaseId, caseId)) return
      if (error instanceof HttpError) {
        error.message = error.data?.statusText || serverMessage(error, `Refresh failed (${error.status})`)
      }
      throw error
    }

    // The modal may have been closed and reopened for a different case
    // while this request was in flight — its result no longer applies here.
    if (!isSameId(this.currentCaseId, caseId)) return

    this.setProgress(false)

    const message = processInBackground ? backgroundMessage : successMessage
    if (message) coreFlash.show("success", message)

    if (closeWithReload && !processInBackground) {
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.JUDGEMENTS_QUERIES_NEED_RELOAD, {
          detail: { caseId: Number(this.currentCaseId) }
        })
      )
    }

    this.hide()
    this.setBusy(false)

    if (processInBackground && backgroundMessage) {
      window.setTimeout(() => {
        window.location.href = `${getQuepidRootUrl()}?notice=${encodeURIComponent(backgroundMessage)}`
      }, REDIRECT_DELAY_MS)
    }
  }

  _setSectionsVisible({ books = false, noTeams = false, noBooks = false } = {}) {
    this.toggleVisible("noTeams", noTeams)
    this.toggleVisible("noBooks", noBooks)
    this.toggleVisible("bookPicker", books)
  }

  setBusy(busy) {
    this._busy = busy
    this.actionButtonTargets.forEach((btn) => {
      btn.disabled = busy
    })
    // Picking a book (or toggling a sync checkbox) after this initial call
    // must re-enable Save without another setBusy() — recompute from _busy
    // rather than assuming "not busy".
    this._refreshSaveVisibility()
    // Preserve the existing behavior: Cancel is disabled while a save/refresh/sync request is
    // in flight, so a stale request's completion handler can't fire against a
    // modal the user has since dismissed and possibly reopened.
    this.setButtonsDisabled(busy, ["cancelButton"])
  }

  _handleActionError(error) {
    console.error("judgements-core: action failed", error)
    this.setProgress(false)
    this.setBusy(false)
    this.showError(error.message || error)
  }
}

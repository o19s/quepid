import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal, hideBsModal } from "utils/bs_modal"
import { getQuepidRootUrl } from "utils/quepid_root"
import { showFlash } from "utils/flash"
import { showStatusMessage } from "utils/status_message"

const CASE_ID_PLACEHOLDER = "__CASE_ID__"
const TEAM_ID_PLACEHOLDER = "__TEAM_ID__"
const BOOK_ID_PLACEHOLDER = "__BOOK_ID__"
const BACKGROUND_QUERY_THRESHOLD = 50
const REDIRECT_DELAY_MS = 500

/**
 * Judgements / book-link modal for the core case toolbar — mirrors AngularJS
 * `<judgements>` / `_modal.html`. Loads books from the case's teams, saves
 * book + sync settings via `PUT api/cases/:id`, and runs refresh/sync via
 * the books refresh API. "Populate Now" still needs live search docs in
 * Angular `queriesSvc`, so it dispatches `judgements:populate-book` until
 * the live-query-state migration owns that path. After ratings refresh that
 * should re-bootstrap queries, dispatches `judgements:queries-need-reload`.
 *
 * Dual-role trigger/modal-root pattern via ModalTriggerControllerBase.
 */
export default class extends ModalTriggerControllerBase {
  static targets = [
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

  static values = {
    caseUrlTemplate: String,
    teamBooksUrlTemplate: String,
    refreshUrlTemplate: String,
    newBookUrlTemplate: String,
    judgeUrlTemplate: String
  }

  get modalElementId() {
    return "judgementsModal"
  }

  openAsRoot(event) {
    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.judgementsCoreIdValue
    const caseName = btn?.dataset?.judgementsCoreNameValue
    const scorerId = btn?.dataset?.judgementsCoreScorerIdValue
    const bookId = btn?.dataset?.judgementsCoreBookIdValue
    const queriesCount = btn?.dataset?.judgementsCoreQueriesCountValue
    const autoPairs = btn?.dataset?.judgementsCoreAutoPopulateBookPairsValue
    const autoJudgements = btn?.dataset?.judgementsCoreAutoPopulateCaseJudgementsValue

    this.currentCaseId = caseId || ""
    this.currentCaseName = caseName || ""
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
    hideBsModal(getOrCreateBsModal(this.element))
    window.location.href = `${getQuepidRootUrl()}/teams`
  }

  openShareCase(event) {
    event?.preventDefault?.()
    const caseNo = this.currentCaseId
    const caseName = this.currentCaseName
    const openShare = () => {
      document.dispatchEvent(
        new CustomEvent("quepid:open-share-case-core", {
          detail: { caseNo: Number(caseNo), caseName }
        })
      )
    }

    // A second call before the modal finishes hiding must replace, not add
    // to, the pending listener — otherwise both fire on the one hide event
    // and quepid:open-share-case-core double-dispatches.
    if (this._pendingOpenShare) {
      this.element.removeEventListener("hidden.bs.modal", this._pendingOpenShare)
    }
    this._pendingOpenShare = openShare
    this.element.addEventListener("hidden.bs.modal", openShare, { once: true })
    hideBsModal(getOrCreateBsModal(this.element))
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

      showFlash("success", "Settings saved.")
      hideBsModal(getOrCreateBsModal(this.element))
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

    document.dispatchEvent(
      new CustomEvent("judgements:populate-book", {
        detail: {
          caseId: Number(caseId),
          bookId: Number(bookId),
          done: (error) => {
            if (String(this.currentCaseId) !== String(caseId)) return
            this.setProgress(false)
            if (error) {
              this._handleActionError(error)
              return
            }
            showFlash("success", "Updating Book with Query Doc Pairs.")
            hideBsModal(getOrCreateBsModal(this.element))
            this.setBusy(false)
          }
        }
      })
    )
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
    this._setLoading(true)
    this._setSectionsVisible({ books: false, noTeams: false, noBooks: false })

    try {
      const caseUrl = this.caseUrlTemplateValue.replaceAll(CASE_ID_PLACEHOLDER, this.currentCaseId)
      const caseResponse = await apiFetch(caseUrl, { headers: { Accept: "application/json" } })
      if (!caseResponse.ok) throw new Error(`Failed to load case (${caseResponse.status})`)

      const caseData = await caseResponse.json()
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

      if (this.teams.length === 0) {
        this._setLoading(false)
        this._setSectionsVisible({ noTeams: true })
        this._refreshIntegrationVisibility()
        this._refreshSaveVisibility()
        return
      }

      const bookLists = await Promise.all(
        this.teams.map(async (team) => {
          const url = this.teamBooksUrlTemplateValue.replaceAll(TEAM_ID_PLACEHOLDER, String(team.id))
          const response = await apiFetch(url, { headers: { Accept: "application/json" } })
          if (!response.ok) throw new Error(`Failed to load books (${response.status})`)
          const data = await response.json()
          return Array.isArray(data.books) ? data.books : []
        })
      )

      this.books = this._dedupeAndSortBooks(bookLists.flat())
      this._setLoading(false)

      if (this.books.length === 0) {
        this._setSectionsVisible({ noBooks: true })
      } else {
        this._setSectionsVisible({ books: true })
        this._renderBooks()
      }

      this._refreshIntegrationVisibility()
      this._refreshSaveVisibility()
    } catch (error) {
      console.error("judgements-core: load failed", error)
      this._setLoading(false)
      this.showError(error.message || "Unable to load judgements settings.")
    }
  }

  _dedupeAndSortBooks(books) {
    const seen = new Set()
    const unique = []
    books.forEach((book) => {
      const id = Number(book.id)
      if (seen.has(id)) return
      seen.add(id)
      unique.push({ id, name: book.name })
    })

    unique.sort((a, b) => {
      if (a.id === this.activeBookId) return -1
      if (b.id === this.activeBookId) return 1
      return String(a.name).localeCompare(String(b.name))
    })
    return unique
  }

  _renderBooks() {
    if (!this.hasBookListTarget) return
    this.bookListTarget.innerHTML = ""

    const none = document.createElement("li")
    none.className = "list-group-item"
    none.innerHTML = "<em>None (disconnect from any book)</em>"
    none.dataset.judgementsCoreBookIdParam = ""
    none.dataset.action = "click->judgements-core#selectBook"
    this.bookListTarget.appendChild(none)

    this.books.forEach((book) => {
      const li = document.createElement("li")
      li.className = "list-group-item"
      li.dataset.judgementsCoreBookIdParam = String(book.id)
      li.dataset.action = "click->judgements-core#selectBook"

      const name = document.createElement("span")
      name.textContent = book.name
      li.appendChild(name)

      const view = document.createElement("a")
      view.href = `books/${book.id}`
      view.target = "_self"
      view.className = "btn btn-outline-secondary btn-sm float-end"
      view.title = "Open this book in a new page"
      view.innerHTML = '<i class="bi bi-eye-fill"></i> View'
      view.addEventListener("click", (e) => e.stopPropagation())
      li.appendChild(view)

      this.bookListTarget.appendChild(li)
    })

    this._refreshBookSelection()
  }

  _refreshBookSelection() {
    if (!this.hasBookListTarget) return
    this.bookListTarget.querySelectorAll(".list-group-item").forEach((li) => {
      const raw = li.dataset.judgementsCoreBookIdParam
      const id = raw === "" ? null : Number(raw)
      li.classList.toggle("active", id === this.activeBookId)
    })

    if (this.hasJudgeLinkTarget) {
      const show = this.activeBookId != null
      this.judgeLinkTarget.classList.toggle("d-none", !show)
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
    if (this.hasSelectHintTarget) {
      this.selectHintTarget.classList.toggle("d-none", !hasBooks || this.activeBookId != null)
    }
    if (this.hasIntegrationTarget) {
      this.integrationTarget.classList.toggle("d-none", !this.activeBookId)
    }
  }

  _refreshSaveVisibility() {
    if (!this.hasSaveButtonTarget) return
    const hasChanges = this.hasUnsavedChanges()
    this.saveButtonTarget.classList.toggle("d-none", !hasChanges)
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

    const response = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.statusText || data.error || data.message || `Save failed (${response.status})`)
    }

    const data = await response.json().catch(() => ({}))
    this.savedBookId = bookId
    this.savedAutoPopulateBookPairs = payload.auto_populate_book_pairs
    this.savedAutoPopulateCaseJudgements = payload.auto_populate_case_judgements

    document.dispatchEvent(
      new CustomEvent("judgements:book-settings-saved", {
        detail: {
          caseId: Number(this.currentCaseId),
          bookId,
          bookName: data.book_name || null,
          autoPopulateBookPairs: payload.auto_populate_book_pairs,
          autoPopulateCaseJudgements: payload.auto_populate_case_judgements
        }
      })
    )
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
    const response = await apiFetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({})
    })

    // The modal may have been closed and reopened for a different case
    // while this request was in flight — its result no longer applies here.
    if (String(this.currentCaseId) !== String(caseId)) return

    this.setProgress(false)

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.statusText || data.error || data.message || `Refresh failed (${response.status})`)
    }

    const message = processInBackground ? backgroundMessage : successMessage
    if (message) showFlash("success", message)

    if (closeWithReload && !processInBackground) {
      document.dispatchEvent(
        new CustomEvent("judgements:queries-need-reload", {
          detail: { caseId: Number(this.currentCaseId) }
        })
      )
    }

    hideBsModal(getOrCreateBsModal(this.element))
    this.setBusy(false)

    if (processInBackground && backgroundMessage) {
      window.setTimeout(() => {
        window.location.href = `${getQuepidRootUrl()}?notice=${encodeURIComponent(backgroundMessage)}`
      }, REDIRECT_DELAY_MS)
    }
  }

  _setLoading(loading) {
    if (this.hasLoadingTarget) this.loadingTarget.classList.toggle("d-none", !loading)
  }

  _setSectionsVisible({ books = false, noTeams = false, noBooks = false } = {}) {
    if (this.hasNoTeamsTarget) this.noTeamsTarget.classList.toggle("d-none", !noTeams)
    if (this.hasNoBooksTarget) this.noBooksTarget.classList.toggle("d-none", !noBooks)
    if (this.hasBookPickerTarget) this.bookPickerTarget.classList.toggle("d-none", !books)
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
    // Angular parity: Cancel is disabled while a save/refresh/sync request is
    // in flight, so a stale request's completion handler can't fire against a
    // modal the user has since dismissed and possibly reopened.
    if (this.hasCancelButtonTarget) {
      this.cancelButtonTarget.disabled = busy
    }
  }

  setProgress(visible) {
    if (!this.hasProgressTarget) return
    this.progressTarget.classList.toggle("d-none", !visible)
  }

  showError(message) {
    if (!this.hasErrorTarget) return
    showStatusMessage(this.errorTarget, {
      message: `An error (${message}) occurred, please try again.\nIf the error persist, contact adminstrator for further assistance.`,
      className: "text-danger"
    })
    this.errorTarget.style.whiteSpace = "pre-line"
  }

  clearError() {
    if (!this.hasErrorTarget) return
    showStatusMessage(this.errorTarget, { message: "", className: "text-danger d-none" })
  }

  _handleActionError(error) {
    console.error("judgements-core: action failed", error)
    this.setProgress(false)
    this.setBusy(false)
    this.showError(error.message || error)
  }
}

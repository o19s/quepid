import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static values = {
    caseId: Number,
    bookId: Number,       // currently associated book, 0 if none
    books: Array,         // [{id, name}, ...] available books from teams
    teams: Array,         // [{id, name}, ...] teams this case belongs to
    autoPopulateBookPairs: Boolean,
    autoPopulateCaseJudgements: Boolean,
    scorerId: Number,
    queriesCount: Number
  }

  static outlets = ["query-row"]

  static targets = [
    "modal",
    "bookList",
    "integrationPanel",
    "noBookHint",
    "noTeamsMessage",
    "noBooksMessage",
    "autoPopulateBookPairsCheckbox",
    "autoPopulateCaseJudgementsCheckbox",
    "saveButton",
    "createBookLink",
    "judgeLink",
    "errorMessage",
    "processingMessage",
    "populateButton",
    "refreshButton",
    "syncQueriesButton"
  ]

  connect() {
    // bookIdValue is 0 when no book is associated; treat as null internally
    this._selectedBookId = this.bookIdValue > 0 ? this.bookIdValue : null
    this._originalBookId = this._selectedBookId
    this._originalAutoPopulateBookPairs = this.autoPopulateBookPairsValue
    this._originalAutoPopulateCaseJudgements = this.autoPopulateCaseJudgementsValue
  }

  async open() {
    this._selectedBookId = this.bookIdValue > 0 ? this.bookIdValue : null
    this._originalBookId = this._selectedBookId
    this._hideError()
    this._hideProcessing()

    // Fetch fresh books from each team on open, matching Angular's behavior
    // (bookSvc.list(team) per team on modal init)
    await this._refreshBooks()

    this._renderBookList()
    this._updateIntegrationPanel()
    this._updateSaveButton()
    this._updateCreateBookLink()
    this._modal().show()
  }

  selectBook(event) {
    this._selectedBookId = event.currentTarget.dataset.bookId
      ? parseInt(event.currentTarget.dataset.bookId)
      : null
    this._renderBookList()
    this._updateIntegrationPanel()
    this._updateSaveButton()
  }

  toggleSetting() {
    this._updateSaveButton()
  }

  async save() {
    this._showProcessing("Saving settings...")
    this._disableActions(true)

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const bookId = this._selectedBookId
    const autoPopulateBookPairs = bookId
      ? this.autoPopulateBookPairsCheckboxTarget.checked
      : false
    const autoPopulateCaseJudgements = bookId
      ? this.autoPopulateCaseJudgementsCheckboxTarget.checked
      : false

    try {
      // Save book settings
      const url = apiUrl(`api/cases/${this.caseIdValue}`)
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({
          book_id: bookId,
          auto_populate_book_pairs: autoPopulateBookPairs,
          auto_populate_case_judgements: autoPopulateCaseJudgements
        })
      })

      if (!response.ok) throw new Error("Failed to save settings")

      // If book changed and auto-populate is on, refresh ratings
      const bookChanged = this._selectedBookId !== this._originalBookId
      if (autoPopulateCaseJudgements && bookChanged && bookId) {
        const processInBackground = this.queriesCountValue >= 50
        await this._refreshRatings(false, processInBackground)
        this._modal().hide()
        if (processInBackground) {
          window.location.href = `${document.body.dataset.quepidRootUrl || "/"}?notice=${encodeURIComponent("Settings saved. Ratings are being refreshed in the background.")}`
        } else {
          // Foreground sync completed — reload so the UI reflects updated ratings
          window.location.reload()
        }
        return
      }

      // No sync needed — just update stored values and close
      this.bookIdValue = bookId
      this.autoPopulateBookPairsValue = autoPopulateBookPairs
      this.autoPopulateCaseJudgementsValue = autoPopulateCaseJudgements
      this._originalBookId = bookId
      this._originalAutoPopulateBookPairs = autoPopulateBookPairs
      this._originalAutoPopulateCaseJudgements = autoPopulateCaseJudgements

      this._hideProcessing()
      this._disableActions(false)
      this._updateSaveButton()
      this._modal().hide()
    } catch (error) {
      console.error("Save error:", error)
      this._showError(error.message || "An error occurred. Please try again.")
      this._hideProcessing()
      this._disableActions(false)
    }
  }

  async manualPopulate() {
    this._showProcessing("Populating book with query/doc pairs...")
    this._disableActions(true)

    try {
      // Gather query/doc pairs from all query-row outlets that have search results
      const queryDocPairs = []
      if (this.hasQueryRowOutlet) {
        this.queryRowOutlets.forEach(row => {
          const docs = row.lastSearchDocs || []
          docs.forEach((doc, idx) => {
            const fields = {}
            // Capture sub-fields (displayed document fields)
            if (doc.subs) {
              Object.entries(doc.subs).forEach(([key, value]) => {
                fields[key] = String(value ?? "")
              })
            }
            if (doc.title) fields["title"] = String(doc.title)
            if (doc.thumb) fields["thumb"] = String(doc.thumb)

            queryDocPairs.push({
              query_text: row.queryTextValue,
              doc_id: String(doc.id),
              position: idx + 1,
              document_fields: fields,
            })
          })
        })
      }

      if (queryDocPairs.length === 0) {
        this._showError("No search results loaded. Run searches first, then populate.")
        this._hideProcessing()
        this._disableActions(false)
        return
      }

      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
      const url = apiUrl(`api/books/${this._selectedBookId}/populate?case_id=${this.caseIdValue}`)
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
        body: JSON.stringify({ case_id: this.caseIdValue, query_doc_pairs: queryDocPairs })
      })

      if (!response.ok) throw new Error("Failed to populate book")

      this._hideProcessing()
      this._disableActions(false)
      this._modal().hide()
    } catch (error) {
      this._showError(error.message)
      this._hideProcessing()
      this._disableActions(false)
    }
  }

  async manualRefresh() {
    this._showProcessing("Refreshing ratings from book (this can take a minute)...")
    this._disableActions(true)

    try {
      const processInBackground = this.queriesCountValue >= 50
      await this._refreshRatings(false, processInBackground)

      if (processInBackground) {
        this._modal().hide()
        window.location.href = `${document.body.dataset.quepidRootUrl || "/"}?notice=${encodeURIComponent("Case ratings are being refreshed from book in the background.")}`
        return
      }

      this._hideProcessing()
      this._disableActions(false)
      this._modal().hide()
      window.location.reload()
    } catch (error) {
      this._showError(error.message)
      this._hideProcessing()
      this._disableActions(false)
    }
  }

  async manualSyncQueries() {
    this._showProcessing("Syncing missing queries from book (this can take a minute)...")
    this._disableActions(true)

    try {
      const processInBackground = this.queriesCountValue >= 50
      await this._refreshRatings(true, processInBackground)

      if (processInBackground) {
        this._modal().hide()
        window.location.href = `${document.body.dataset.quepidRootUrl || "/"}?notice=${encodeURIComponent("Missing queries are being synced from book in the background.")}`
        return
      }

      this._hideProcessing()
      this._disableActions(false)
      this._modal().hide()
      window.location.reload()
    } catch (error) {
      this._showError(error.message)
      this._hideProcessing()
      this._disableActions(false)
    }
  }

  async _refreshRatings(createMissingQueries, processInBackground) {
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const url = apiUrl(
      `api/books/${this._selectedBookId}/cases/${this.caseIdValue}/refresh?create_missing_queries=${createMissingQueries}&process_in_background=${processInBackground}`
    )
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.statusText || "Failed to refresh ratings")
    }
    return response.json()
  }

  async _refreshBooks() {
    if (this.teamsValue.length === 0) return

    const seen = new Set()
    const freshBooks = []

    for (const team of this.teamsValue) {
      try {
        const response = await fetch(apiUrl(`api/teams/${team.id}/books`), {
          headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
        })
        if (!response.ok) continue

        const data = await response.json()
        const books = data.books || data || []
        for (const book of books) {
          if (!seen.has(book.id)) {
            seen.add(book.id)
            freshBooks.push({ id: book.id, name: book.name })
          }
        }
      } catch (e) {
        console.warn(`Failed to fetch books for team ${team.id}:`, e)
      }
    }

    this.booksValue = freshBooks
  }

  _renderBookList() {
    if (this.teamsValue.length === 0) {
      this.noTeamsMessageTarget.classList.remove("d-none")
      this.noBooksMessageTarget.classList.add("d-none")
      this.bookListTarget.classList.add("d-none")
      return
    }

    this.noTeamsMessageTarget.classList.add("d-none")

    if (this.booksValue.length === 0) {
      this.noBooksMessageTarget.classList.remove("d-none")
      this.bookListTarget.classList.add("d-none")
      return
    }

    this.noBooksMessageTarget.classList.add("d-none")
    this.bookListTarget.classList.remove("d-none")

    // Sort books: active book first, then alphabetical
    const sorted = [...this.booksValue].sort((a, b) => {
      if (a.id === this._selectedBookId) return -1
      if (b.id === this._selectedBookId) return 1
      return a.name.localeCompare(b.name)
    })

    const rootUrl = document.body.dataset.quepidRootUrl || ""

    let html = `<ul class="list-group">
      <li class="list-group-item cursor-pointer ${this._selectedBookId === null ? "active" : ""}"
          data-action="click->judgements#selectBook" data-book-id="">
        <em>None (disconnect from any book)</em>
      </li>`

    for (const book of sorted) {
      const isActive = book.id === this._selectedBookId
      html += `<li class="list-group-item d-flex justify-content-between align-items-center cursor-pointer ${isActive ? "active" : ""}"
                   data-action="click->judgements#selectBook" data-book-id="${book.id}">
                 ${this._escapeHtml(book.name)}
                 <a href="${rootUrl}/books/${book.id}" target="_self" class="btn btn-sm btn-outline-secondary"
                    title="Open this book" onclick="event.stopPropagation()">
                   <i class="bi bi-eye"></i> View
                 </a>
               </li>`
    }

    html += `</ul>`
    this.bookListTarget.innerHTML = html
  }

  _updateIntegrationPanel() {
    const hasBook = this._selectedBookId !== null
    this.integrationPanelTarget.classList.toggle("d-none", !hasBook)

    if (this.hasNoBookHintTarget) {
      this.noBookHintTarget.classList.toggle("d-none", hasBook || this.booksValue.length === 0)
    }

    if (hasBook) {
      this.autoPopulateBookPairsCheckboxTarget.checked = this._selectedBookId === this._originalBookId
        ? this.autoPopulateBookPairsValue
        : false
      this.autoPopulateCaseJudgementsCheckboxTarget.checked = this._selectedBookId === this._originalBookId
        ? this.autoPopulateCaseJudgementsValue
        : true

      // Update judge link
      const rootUrl = document.body.dataset.quepidRootUrl || ""
      if (this.hasJudgeLinkTarget) {
        this.judgeLinkTarget.href = `${rootUrl}/books/${this._selectedBookId}/judge`
        this.judgeLinkTarget.classList.remove("d-none")
      }
    } else {
      if (this.hasJudgeLinkTarget) this.judgeLinkTarget.classList.add("d-none")
    }

    // Enable/disable manual buttons
    const canSync = hasBook
    if (this.hasPopulateButtonTarget) this.populateButtonTarget.disabled = !canSync
    if (this.hasRefreshButtonTarget) this.refreshButtonTarget.disabled = !canSync
    if (this.hasSyncQueriesButtonTarget) this.syncQueriesButtonTarget.disabled = !canSync
  }

  _updateSaveButton() {
    const bookChanged = this._selectedBookId !== this._originalBookId
    const settingsChanged = this._selectedBookId
      ? (this.autoPopulateBookPairsCheckboxTarget.checked !== this._originalAutoPopulateBookPairs ||
         this.autoPopulateCaseJudgementsCheckboxTarget.checked !== this._originalAutoPopulateCaseJudgements)
      : false
    const hasChanges = bookChanged || settingsChanged
    this.saveButtonTarget.classList.toggle("d-none", !hasChanges)
  }

  _updateCreateBookLink() {
    const rootUrl = document.body.dataset.quepidRootUrl || ""
    const href = `${rootUrl}/books/new?scorer_id=${this.scorerIdValue}&origin_case_id=${this.caseIdValue}`
    this.createBookLinkTargets.forEach(link => { link.href = href })
  }

  _disableActions(disabled) {
    if (this.hasPopulateButtonTarget) this.populateButtonTarget.disabled = disabled
    if (this.hasRefreshButtonTarget) this.refreshButtonTarget.disabled = disabled
    if (this.hasSyncQueriesButtonTarget) this.syncQueriesButtonTarget.disabled = disabled
    this.saveButtonTarget.disabled = disabled
  }

  _showError(message) {
    this.errorMessageTarget.textContent = message
    this.errorMessageTarget.classList.remove("d-none")
  }

  _hideError() {
    this.errorMessageTarget.classList.add("d-none")
  }

  _showProcessing(message) {
    // The processing target contains a spinner span + text span; update the text span
    const textSpan = this.processingMessageTarget.querySelector("span:last-child")
    if (textSpan) {
      textSpan.textContent = message
    } else {
      this.processingMessageTarget.textContent = message
    }
    this.processingMessageTarget.classList.remove("d-none")
  }

  _hideProcessing() {
    this.processingMessageTarget.classList.add("d-none")
  }

  _escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

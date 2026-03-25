import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { escapeHtml, escapeAttr } from "modules/html_escape"

/** Build a query row <li> matching the server-rendered markup in _query_list_shell.html.erb.
 *  IMPORTANT: Keep in sync with app/views/core/_query_list_shell.html.erb (the <li> inside
 *  the @queries.each loop). Changes to row markup must be mirrored here. */
function buildQueryRowHtml(query, sortable) {
  const id = query.query_id
  const text = query.query_text
  const ratingsJson = JSON.stringify(query.ratings || {})
  const modifiedAt = query.modified_at || new Date().toISOString()
  const notes = query.notes || ""
  const informationNeed = query.information_need || ""
  const hasRatings = query.ratings && Object.keys(query.ratings).length > 0
  const ratedCount = query.ratings ? Object.keys(query.ratings).length : 0

  const dragHandle = sortable
    ? `<span class="drag-handle float-start" title="Drag to reorder"><i class="bi bi-list" aria-hidden="true"></i></span>`
    : ""

  const notesIcon =
    notes || informationNeed
      ? `<i class="bi bi-chat-left-text text-muted query-notes-indicator" title="Has notes" aria-hidden="true"></i>`
      : ""

  // Note: bulk rate scale items are NOT included here — query-row controller
  // dynamically populates them in connect(), matching the ERB template pattern.

  return `<li data-query-list-target="queryRow"
      data-query-id="${id}"
      data-query-text="${escapeAttr(text)}"
      data-modified-at="${modifiedAt}"
      data-rated="${hasRatings}"
      data-controller="query-row"
      data-query-row-query-id-value="${id}"
      data-query-row-query-text-value="${escapeAttr(text)}"
      data-query-row-ratings-value="${escapeAttr(ratingsJson)}"
      data-query-row-notes-value="${escapeAttr(notes)}"
      data-query-row-information-need-value="${escapeAttr(informationNeed)}">
    <div class="clearfix">
      <div class="result-header">
        ${dragHandle}
        <div class="results-score float-start">
          <div class="overall-rating query-score-badge" data-query-row-target="scoreDisplay">--</div>
        </div>
        <span class="snapshot-query-scores float-start d-none" data-query-row-target="snapshotScores"></span>
        <h2 class="results-title">
          <span class="query">${escapeHtml(text)} &nbsp;</span>
          ${notesIcon}
        </h2>
        <span class="float-end total-results">
          <small class="text-muted" data-query-row-target="totalResults">${ratedCount} rated</small>
        </span>
        <span class="float-end d-none query-row-indicator" title="Hop to it! There are unrated results!"
              data-query-row-target="frogIndicator">
          <span class="icon-container">
            <i class="frog-icon">&#x1F438;</i>
            <span class="notification-bubble" data-query-row-target="frogCount"></span>
          </span>
        </span>
        <span class="float-end d-none query-row-indicator" title="Querqy rule triggered"
              data-query-row-target="querqyIndicator">
          <i class="querqy-icon"></i>
        </span>
        <span class="toggleSign bi bi-chevron-down"
              data-action="click->query-row#toggle"
              data-query-row-target="chevron"></span>
      </div>
    </div>
    <div class="sub-results container clearfix d-none" data-query-row-target="expandedContent">
      <div class="query-row-expanded-toolbar">
        <div class="query-row-score-all">
          <strong>Score All</strong>
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm dropdown-toggle"
                    data-bs-toggle="dropdown" aria-expanded="false">
              <i class="bi bi-check2-square" aria-hidden="true"></i> Score All
            </button>
            <ul class="dropdown-menu" data-query-row-target="bulkRateMenu">
              <li><a class="dropdown-item" href="#" data-action="click->query-row#bulkRate" data-rating-value="clear">Clear All</a></li>
              <li><hr class="dropdown-divider"></li>
            </ul>
          </div>
        </div>
        <div class="btn-toolbar query-row-actions-toolbar" role="toolbar">
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="click->query-row#copyQuery" title="Copy query">
              <i class="bi bi-clipboard" aria-hidden="true"></i>
            </button>
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="click->query-row#toggleNotes">
              <i class="bi bi-chat-left-text" aria-hidden="true"></i> Toggle Notes
            </button>
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="click->query-row#explainQuery">
              <i class="bi bi-bar-chart-line" aria-hidden="true"></i> Explain Query
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="click->query-row#openDocFinder">
              <i class="bi bi-search" aria-hidden="true"></i> Missing Documents
            </button>
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    data-action="click->query-row#toggleDocExplain"
                    data-query-row-target="docExplainToggle"
                    aria-pressed="false"
                    title="Per-document match breakdown (Solr/ES explain in results)">
              <i class="bi bi-layers" aria-hidden="true"></i> Match breakdown
            </button>
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn-outline-secondary btn-sm" data-action="click->query-row#openQueryOptionsModal">
              <i class="bi bi-sliders" aria-hidden="true"></i> Set Options
            </button>
          </div>
          <div class="btn-group">
            <button type="button" class="btn btn-warning btn-sm" data-action="click->query-row#openMoveQueryModal">
              <i class="bi bi-folder-symlink" aria-hidden="true"></i> Move Query
            </button>
            <button type="button" class="btn btn-danger btn-sm" data-action="click->query-row#deleteQuery">
              <i class="bi bi-trash" aria-hidden="true"></i> Delete Query
            </button>
          </div>
        </div>
      </div>
      <div class="query-notes-panel d-none" data-query-row-target="notesPanel">
        <div class="form-group">
          <label class="form-label">Information Need</label>
          <input type="text" class="form-control form-control-sm"
                 placeholder="What is the user trying to find?"
                 data-query-row-target="informationNeedInput"
                 value="${escapeAttr(informationNeed)}" />
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control form-control-sm" rows="3"
                    placeholder="Add notes about this query..."
                    data-query-row-target="notesInput">${escapeHtml(notes)}</textarea>
        </div>
        <button class="btn btn-primary btn-sm" data-action="click->query-row#saveNotes">Save Notes</button>
        <span class="text-success d-none" data-query-row-target="notesSavedIndicator">Saved!</span>
      </div>
      <div data-query-row-target="resultsContainer" class="search-results-container">
        <p class="text-muted">Expand to run search.</p>
      </div>
    </div>
  </li>`
}

export default class extends Controller {
  static targets = ["input"]
  static values = {
    url: { type: String, default: "" },
    bulkUrl: { type: String, default: "" },
  }

  connect() {
    this.abortController = null
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  get _url() {
    if (this.hasUrlValue && this.urlValue) return this.urlValue
    const caseId = document.body.dataset.caseId
    return apiUrl(`api/cases/${caseId}/queries`)
  }

  get _bulkUrl() {
    if (this.hasBulkUrlValue && this.bulkUrlValue) return this.bulkUrlValue
    const caseId = document.body.dataset.caseId
    return apiUrl(`api/bulk/cases/${caseId}/queries`)
  }

  get _sortable() {
    const listEl = document.getElementById("query-list-shell")
    return listEl?.dataset.queryListSortableValue === "true"
  }

  submit(event) {
    event.preventDefault()

    const queryText = this.inputTarget.value.trim()
    if (!queryText) return

    const token = csrfToken()

    // Support multiple queries separated by semicolons
    const queries = queryText
      .split(";")
      .map((q) => q.trim())
      .filter(Boolean)

    if (queries.length === 1) {
      this._createSingle(queries[0], token)
    } else {
      this._createBulk(queries, token)
    }
  }

  async _createSingle(queryText, token) {
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

    try {
      const response = await fetch(this._url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
          Accept: "application/json",
        },
        body: JSON.stringify({ query: { query_text: queryText } }),
        signal: this.abortController.signal,
      })

      if (response.ok) {
        const data = await response.json()
        this.inputTarget.value = ""
        this._insertQueryRows([data.query])
      } else {
        alert(`Failed to add query (${response.status})`)
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to add query:", error)
        alert("Failed to add query: network error")
      }
    }
  }

  async _createBulk(queries, token) {
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

    try {
      const response = await fetch(this._bulkUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": token,
          Accept: "application/json",
        },
        body: JSON.stringify({ queries: queries }),
        signal: this.abortController.signal,
      })

      if (response.ok) {
        const data = await response.json()
        this.inputTarget.value = ""
        this._insertQueryRows(data.queries)
      } else {
        alert(`Failed to add queries (${response.status})`)
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Failed to add queries:", error)
        alert("Failed to add queries: network error")
      }
    }
  }

  /** Insert new query rows into the list in-place (no page reload). */
  _insertQueryRows(queries) {
    const list = document.querySelector("[data-query-list-target='list']")
    if (!list) {
      // Fallback if the list element isn't found
      window.location.reload()
      return
    }

    const sortable = this._sortable
    const existingIds = new Set(
      [...list.querySelectorAll("[data-query-list-target='queryRow']")].map(
        (el) => el.dataset.queryId,
      ),
    )
    let nextIndex = existingIds.size

    let insertedCount = 0
    queries.forEach((query) => {
      // Skip if this query already exists (API returns existing on duplicate)
      if (existingIds.has(String(query.query_id))) return

      const html = buildQueryRowHtml(query, sortable)
      const template = document.createElement("template")
      template.innerHTML = html.trim()
      const li = template.content.firstChild

      // Set originalIndex for sort stability
      li.dataset.originalIndex = nextIndex++

      list.appendChild(li)
      insertedCount++
    })

    if (insertedCount === 0) return

    // Update query count
    const countEl = document.querySelector("[data-query-list-target='queryCount']")
    if (countEl) {
      countEl.textContent =
        list.querySelectorAll("[data-query-list-target='queryRow']").length
    }

    // Dispatch a custom event so the query-list controller can re-apply
    // visibility/pagination and pick up the new outlets
    document.dispatchEvent(new CustomEvent("queries-added"))
  }
}

import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl, buildApiQuerySearchUrl } from "utils/quepid_root"

// Holds the results pane region for the case/try workspace. When a query is selected,
// fetches server-rendered search results (DocumentCardComponent) from the query execution
// API and displays them. Supports inline rating via popover on each document card.
// Diff mode appends diff_snapshot_ids[] to the search URL so the server renders diff badges.
// Uses _fetchRequestId to ignore stale responses when the user switches queries quickly.
export default class extends Controller {
  static values = {
    caseId: Number,
    tryNumber: Number,
    queryId: Number,
    queryText: String,  // Query text for snapshot search (diff mode)
    scale: Array,  // Scorer scale for rating popover (e.g. [0,1,2,3])
    scaleLabels: Object,  // Optional labels: { "0": "Not Relevant", "3": "Perfect" }
    skipFetch: Boolean  // When true (e.g. results_content slot provided), do not fetch; preserve slot content
  }

  static targets = ["resultsContainer", "loadingIndicator", "errorMessage", "errorText", "diffIndicator", "loadMoreArea", "detailModal", "detailModalTitle", "detailFieldsList", "detailJsonPre", "detailJsonTextarea", "detailJsonContainer", "detailModalBody", "viewSourceBtn", "copyJsonBtn", "showOnlyRatedToggle", "bulkRatingBar"]

  connect() {
    this._fetchRequestId = 0
    this._popovers = new Map()
    this._pageSize = 10
    this._currentStart = 0
    this._lastNumFound = 0
    this._diffSnapshotIds = []
    this._showOnlyRated = false
    this._boundHandleResultsClick = this._handleResultsClick.bind(this)
    this._boundHandleResultsKeydown = this._handleResultsKeydown.bind(this)
    this._boundHandleDiffChanged = this._handleDiffChanged.bind(this)
    document.addEventListener("click", this._boundHandleResultsClick)
    document.addEventListener("keydown", this._boundHandleResultsKeydown)
    document.addEventListener("diff-snapshots-changed", this._boundHandleDiffChanged)
    this._updateDiffIndicator()
    if (this._canFetch()) {
      this.fetchResults()
    } else if (this.hasResultsContainerTarget && this.hasQueryIdValue && !this.queryIdValue) {
      this.clearResults()
    }
  }

  disconnect() {
    document.removeEventListener("diff-snapshots-changed", this._boundHandleDiffChanged)
    document.removeEventListener("click", this._boundHandleResultsClick)
    document.removeEventListener("keydown", this._boundHandleResultsKeydown)
    this._popovers.forEach((p) => p?.dispose())
    this._popovers.clear()
  }

  _handleDiffChanged(event) {
    this._diffSnapshotIds = event.detail?.snapshotIds || []
    this._updateDiffIndicator()
    // Re-fetch from server — it will render diff badges (or not) based on the IDs
    if (this._canFetch()) {
      this.fetchResults()
    }
  }

  _updateDiffIndicator() {
    if (!this.hasDiffIndicatorTarget) return
    const workspace = document.querySelector("[data-controller~=\"workspace\"]")
    const ids = this._diffSnapshotIds?.length ? this._diffSnapshotIds : (workspace?.dataset?.diffSnapshotIds || "").split(",").filter(Boolean)
    this._diffSnapshotIds = ids
    this.diffIndicatorTarget.classList.toggle("d-none", ids.length === 0)
  }

  _handleResultsKeydown(event) {
    if (!this.hasResultsContainerTarget) return
    const ratingTrigger = event.target.closest("[data-rating-trigger]")
    if (!ratingTrigger) return
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      this._toggleRatingPopover(ratingTrigger)
    }
  }

  _handleResultsClick(event) {
    const ratingTrigger = event.target.closest("[data-rating-trigger]")
    if (ratingTrigger) {
      event.preventDefault()
      this._toggleRatingPopover(ratingTrigger)
    }
    const ratingBtn = event.target.closest("[data-rating-value]")
    if (ratingBtn) {
      event.preventDefault()
      const wrapper = ratingBtn.closest("[data-rating-doc-id]")
      const docId = wrapper?.dataset?.ratingDocId
      const ratingVal = ratingBtn.dataset.ratingValue
      const rating = ratingVal === "" ? NaN : parseInt(ratingVal, 10)
      if (docId != null) {
        this._applyRating(docId, rating)
      }
    }
    const detailBtn = event.target.closest("[data-results-pane-details]")
    if (detailBtn) {
      event.preventDefault()
      this._openDetailModal(detailBtn)
    }
    const loadMoreBtn = event.target.closest("[data-results-pane-load-more]")
    if (loadMoreBtn) {
      event.preventDefault()
      this._loadMore()
    }
  }

  _toggleRatingPopover(triggerEl) {
    const docId = triggerEl.closest("[data-doc-id]")?.dataset?.docId
    if (!docId) return

    const existing = this._popovers.get(docId)
    if (existing) {
      existing.toggle()
      return
    }

    const scale = this.scaleValue || [ 0, 1, 2, 3 ]
    const labels = this.scaleLabelsValue || {}
    const buttonsHtml = scale.map((v) => {
      const label = labels[String(v)]
      const display = label ? `${v} <small class="text-muted">${this._escapeHtml(label)}</small>` : `${v}`
      const title = label ? this._escapeHtmlAttr(label) : ""
      return `<button type="button" class="btn btn-sm btn-outline-primary" data-rating-value="${v}"${title ? ` title="${title}"` : ""}>${display}</button>`
    }).join(" ")
    const clearHtml = '<button type="button" class="btn btn-sm btn-outline-secondary ms-1" data-rating-value="">Clear</button>'
    const content = `<div class="d-flex flex-wrap gap-1 align-items-center" data-rating-doc-id="${this._escapeHtmlAttr(docId)}">${buttonsHtml}${clearHtml}</div>`

    const Popover = window.bootstrap?.Popover
    if (!Popover) return

    const popover = new Popover(triggerEl, {
      content,
      html: true,
      trigger: "manual",
      placement: "left",
      container: "body"
    })
    popover.show()
    this._popovers.set(docId, popover)
  }

  async _applyRating(docId, rating) {
    if (!this.caseIdValue || !this.queryIdValue) return

    const root = getQuepidRootUrl()
    const url = buildApiUrl(root, "cases", this.caseIdValue, "queries", this.queryIdValue, "ratings")
    const useTurboStream = !!window.Turbo

    try {
      const isClear = rating === "" || (typeof rating === "number" && isNaN(rating))
      const accept = useTurboStream ? "text/vnd.turbo-stream.html" : "application/json"

      if (isClear) {
        const res = await apiFetch(url, {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Accept: accept },
          body: JSON.stringify({ rating: { doc_id: docId } })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || data.message || "Failed to clear rating")
        }
        if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
          const html = await res.text()
          if (html?.trim()) window.Turbo.renderStreamMessage(html)
        } else {
          this._updateDocCardRating(docId, "")
        }
      } else {
        const res = await apiFetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: accept },
          body: JSON.stringify({ rating: { doc_id: docId, rating } })
        })
        if (!res.ok) {
          const ct = res.headers.get("Content-Type") || ""
          if (ct.includes("turbo-stream")) {
            const html = await res.text()
            if (html?.trim()) window.Turbo.renderStreamMessage(html)
            return
          }
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || data.message || "Failed to update rating")
        }
        if (useTurboStream && res.headers.get("Content-Type")?.includes("turbo-stream")) {
          const html = await res.text()
          if (html?.trim()) window.Turbo.renderStreamMessage(html)
        } else {
          const data = await res.json().catch(() => ({}))
          const newRating = data.rating != null ? String(data.rating) : ""
          this._updateDocCardRating(docId, newRating)
        }
      }
      this._triggerScoreRefresh()
      this._popovers.get(docId)?.hide()
    } catch (err) {
      console.error("Rating update failed:", err)
      if (window.flash) window.flash.error = err.message
    }
  }

  _updateDocCardRating(docId, rating) {
    const card = this.resultsContainerTarget?.querySelector(`[data-doc-id="${CSS.escape(String(docId))}"]`)
    if (!card) return
    const badge = card.querySelector(".rating-badge")
    if (!badge) return
    badge.innerHTML = rating !== ""
      ? `<span class="badge bg-primary" data-rating-trigger tabindex="0" role="button">${this._escapeHtml(rating)}</span>`
      : `<span class="badge bg-secondary" data-rating-trigger tabindex="0" role="button" title="Click to rate">Rate</span>`
  }

  _triggerScoreRefresh() {
    if (!this.caseIdValue) return

    // Lightweight per-query score refresh (fast feedback)
    if (this.queryIdValue) {
      document.dispatchEvent(new CustomEvent("query-score:refresh", {
        detail: { queryId: this.queryIdValue, caseId: this.caseIdValue }
      }))
    }

    // Debounced full case evaluation (updates case-level score)
    if (!this.tryNumberValue) return
    if (this._scoreRefreshTimer) clearTimeout(this._scoreRefreshTimer)
    this._scoreRefreshTimer = setTimeout(() => {
      const root = getQuepidRootUrl()
      const url = `${buildApiUrl(root, "cases", this.caseIdValue, "run_evaluation")}?try_number=${encodeURIComponent(this.tryNumberValue)}`
      apiFetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" } })
        .catch((err) => console.warn("Score refresh trigger failed:", err))
    }, 3000)
  }

  queryIdValueChanged() {
    if (this.hasQueryIdValue && this.queryIdValue) {
      this.fetchResults()
    } else {
      this.clearResults()
    }
  }

  _canFetch() {
    if (this.hasSkipFetchValue && this.skipFetchValue) return false
    return this.hasQueryIdValue &&
      this.queryIdValue &&
      this.caseIdValue &&
      this.tryNumberValue
  }

  async fetchResults(append = false) {
    if (!this._canFetch()) return

    const requestId = ++this._fetchRequestId
    const start = append ? this._currentStart : 0
    this._setLoading(true)
    this._clearError()
    if (!append) {
      this._currentStart = 0
      this._lastNumFound = 0
    }

    let url = buildApiQuerySearchUrl(
      getQuepidRootUrl(),
      this.caseIdValue,
      this.tryNumberValue,
      this.queryIdValue,
      null,
      this._pageSize,
      start
    )

    // Append diff snapshot IDs so server renders diff badges
    const diffIds = this._diffSnapshotIds || []
    if (diffIds.length > 0) {
      const sep = url.includes("?") ? "&" : "?"
      const diffParams = diffIds.map(id => `diff_snapshot_ids[]=${encodeURIComponent(id)}`).join("&")
      url = `${url}${sep}${diffParams}`
    }

    // Append show_only_rated filter
    if (this._showOnlyRated) {
      const sep = url.includes("?") ? "&" : "?"
      url = `${url}${sep}show_only_rated=true`
    }

    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "text/html",
          "X-CSRF-Token": token || "",
        },
      })
      const text = await res.text()

      if (requestId !== this._fetchRequestId) return

      if (!res.ok) {
        throw new Error(`Search failed (${res.status})`)
      }

      this._renderHtmlResults(text, append)
    } catch (err) {
      if (requestId !== this._fetchRequestId) return
      this._showError(err.message)
    } finally {
      if (requestId === this._fetchRequestId) {
        this._setLoading(false)
      }
    }
  }

  clearResults() {
    if (this.hasResultsContainerTarget) {
      this.resultsContainerTarget.innerHTML = ""
    }
    this._clearError()
    this._showBulkRatingBar(false)
  }

  _setLoading(loading) {
    if (this.hasLoadingIndicatorTarget) {
      this.loadingIndicatorTarget.classList.toggle("d-none", !loading)
    }
  }

  _clearError() {
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add("d-none")
      if (this.hasErrorTextTarget) this.errorTextTarget.textContent = ""
    }
  }

  _showError(message) {
    if (this.hasErrorMessageTarget) {
      if (this.hasErrorTextTarget) {
        this.errorTextTarget.textContent = message
      } else {
        this.errorMessageTarget.textContent = message
      }
      this.errorMessageTarget.classList.remove("d-none")
    }
    // Only clear results if there were none before (preserve existing results on error)
    if (this.hasResultsContainerTarget && !this.resultsContainerTarget.querySelector(".document-card")) {
      this.resultsContainerTarget.innerHTML = ""
    }
  }

  dismissError() {
    this._clearError()
  }

  toggleShowOnlyRated() {
    this._showOnlyRated = this.hasShowOnlyRatedToggleTarget && this.showOnlyRatedToggleTarget.checked
    if (this._canFetch()) this.fetchResults()
  }

  async bulkRate(event) {
    const rating = parseInt(event.currentTarget.dataset.ratingValue, 10)
    if (isNaN(rating)) return
    const docIds = this._collectVisibleDocIds()
    if (docIds.length === 0) return

    const root = getQuepidRootUrl()
    const url = buildApiUrl(root, "cases", this.caseIdValue, "queries", this.queryIdValue, "bulk", "ratings")
    try {
      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ doc_ids: docIds, rating })
      })
      if (!res.ok) throw new Error(`Bulk rate failed (${res.status})`)
      this._triggerScoreRefresh()
      if (this._canFetch()) this.fetchResults()
    } catch (err) {
      console.error("Bulk rating failed:", err)
    }
  }

  async bulkClear() {
    const docIds = this._collectVisibleDocIds()
    if (docIds.length === 0) return
    if (!confirm(`Clear all ratings for ${docIds.length} documents?`)) return

    const root = getQuepidRootUrl()
    const url = buildApiUrl(root, "cases", this.caseIdValue, "queries", this.queryIdValue, "bulk", "ratings", "delete")
    try {
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ doc_ids: docIds })
      })
      if (!res.ok) throw new Error(`Bulk clear failed (${res.status})`)
      this._triggerScoreRefresh()
      if (this._canFetch()) this.fetchResults()
    } catch (err) {
      console.error("Bulk clear failed:", err)
    }
  }

  _collectVisibleDocIds() {
    if (!this.hasResultsContainerTarget) return []
    return Array.from(this.resultsContainerTarget.querySelectorAll(".document-card[data-doc-id]"))
      .map(el => el.dataset.docId)
      .filter(Boolean)
  }

  /** Render server-rendered HTML (DocumentCardComponent + MatchesComponent). */
  _renderHtmlResults(htmlText, append = false) {
    if (!this.hasResultsContainerTarget) return

    this._popovers.forEach((p) => p?.dispose())
    this._popovers.clear()

    const parser = new DOMParser()
    const doc = parser.parseFromString(htmlText, "text/html")
    const wrapper = doc.querySelector("[data-results-pane-html-response]")
    if (!wrapper) return

    const numFound = parseInt(wrapper.dataset.numFound || "0", 10)
    const headerEl = wrapper.querySelector("p.text-muted.small.mb-2")
    const cards = wrapper.querySelectorAll(".document-card")
    const loadMoreEl = wrapper.querySelector("[data-results-pane-target='loadMoreArea']")

    this._showBulkRatingBar(cards.length > 0)

    if (append && this.resultsContainerTarget.querySelector("p.text-muted.small.mb-2")) {
      this._lastNumFound = numFound
      this._currentStart += cards.length
      const loadMoreArea = this.resultsContainerTarget.querySelector("[data-results-pane-target='loadMoreArea']")
      cards.forEach((card) => {
        if (loadMoreArea) {
          loadMoreArea.insertAdjacentElement("beforebegin", card.cloneNode(true))
        } else {
          this.resultsContainerTarget.appendChild(card.cloneNode(true))
        }
      })
      if (loadMoreArea && loadMoreEl) {
        loadMoreArea.outerHTML = loadMoreEl.outerHTML
      }
    } else {
      this._lastNumFound = numFound
      this._currentStart = cards.length
      let inner = ""
      if (headerEl) inner += headerEl.outerHTML
      cards.forEach((c) => { inner += c.outerHTML })
      if (loadMoreEl) inner += loadMoreEl.outerHTML
      this.resultsContainerTarget.innerHTML = inner
    }
  }

  _showBulkRatingBar(visible) {
    if (this.hasBulkRatingBarTarget) {
      this.bulkRatingBarTarget.classList.toggle("d-none", !visible)
    }
  }

  async _loadMore() {
    if (!this._canFetch()) return
    await this.fetchResults(true)
  }

  async _openDetailModal(triggerEl) {
    const card = triggerEl.closest(".document-card")
    if (!card) return

    const docId = card.dataset.docId || "Unknown"
    let fields = {}

    // Read fields from data-doc-fields when present on server-rendered cards.
    if (card.dataset.docFields) {
      try { fields = JSON.parse(card.dataset.docFields) } catch (_e) { /* ignore */ }
    }

    // For large docs, data-doc-fields may be omitted. Fetch on demand.
    if (Object.keys(fields).length === 0) {
      fields = await this._fetchDetailFields(docId)
    }

    // Populate title
    if (this.hasDetailModalTitleTarget) {
      const title = fields.title || fields.name || docId
      const displayTitle = Array.isArray(title) ? title[0] : title
      this.detailModalTitleTarget.textContent = `Document: ${displayTitle}`
    }

    // Populate fields list as <dl>
    if (this.hasDetailFieldsListTarget) {
      const keys = Object.keys(fields)
      if (keys.length === 0) {
        this.detailFieldsListTarget.innerHTML = '<p class="text-muted">No fields available.</p>'
      } else {
        const html = keys.map(k => {
          const v = fields[k]
          const display = (typeof v === "object" && v !== null)
            ? `<pre class="mb-0 small bg-light p-2 rounded">${this._escapeHtml(JSON.stringify(v, null, 2))}</pre>`
            : this._escapeHtml(String(v ?? ""))
          return `<dt class="col-sm-3 text-truncate" title="${this._escapeHtmlAttr(k)}">${this._escapeHtml(k)}</dt><dd class="col-sm-9">${display}</dd>`
        }).join("")
        this.detailFieldsListTarget.innerHTML = `<dl class="row mb-0">${html}</dl>`
      }
    }

    // Populate raw JSON tab — use CodeMirror read-only viewer when available
    const fullDoc = { id: docId, fields }
    const jsonStr = JSON.stringify(fullDoc, null, 2)

    if (this.hasDetailJsonTextareaTarget && window.CodeMirror) {
      const textarea = this.detailJsonTextareaTarget
      if (textarea.editor) {
        // Reuse existing CodeMirror instance — just update its content
        textarea.editor.setValue(jsonStr)
        textarea.editor.formatJSON()
      } else {
        textarea.value = jsonStr
        window.CodeMirror.fromTextArea(textarea, {
          mode: "json",
          readOnly: true,
          lineNumbers: true,
          height: 400
        })
        // formatJSON is auto-called by fromTextArea for valid JSON
      }
      // Hide the fallback <pre>
      if (this.hasDetailJsonPreTarget) this.detailJsonPreTarget.classList.add("d-none")
    } else if (this.hasDetailJsonPreTarget) {
      this.detailJsonPreTarget.textContent = jsonStr
      this.detailJsonPreTarget.classList.remove("d-none")
      // Initialize json-tree on the pre element
      this._initJsonTree(this.detailJsonPreTarget)
    }

    // Set up copy JSON button
    if (this.hasCopyJsonBtnTarget) {
      this.copyJsonBtnTarget.setAttribute("data-clipboard-text-value", jsonStr)
    }

    // Set up view source button — doc_id is stored for viewSource action
    this._currentDetailDocId = docId
    if (this.hasViewSourceBtnTarget) {
      this.viewSourceBtnTarget.classList.remove("d-none")
    }

    const modal = this.hasDetailModalTarget && window.bootstrap?.Modal?.getOrCreateInstance(this.detailModalTarget)
    modal?.show()
  }

  async _fetchDetailFields(docId) {
    if (!this.caseIdValue || !this.tryNumberValue || !this.queryIdValue) return {}

    try {
      const root = getQuepidRootUrl()
      const url = new URL(buildApiUrl(root, "cases", this.caseIdValue, "tries", this.tryNumberValue, "queries", this.queryIdValue, "search"))
      url.searchParams.set("q", docId)
      url.searchParams.set("rows", "10")
      url.searchParams.set("start", "0")
      const res = await apiFetch(url.toString(), { headers: { Accept: "application/json" } })
      if (!res.ok) return {}
      const data = await res.json().catch(() => ({}))
      const docs = Array.isArray(data.docs) ? data.docs : []
      if (docs.length === 0) return {}

      const exact = docs.find((d) => String(d?.id) === String(docId)) || docs[0]
      return exact?.fields || {}
    } catch (_e) {
      return {}
    }
  }

  viewSource() {
    if (!this._currentDetailDocId) return
    const root = getQuepidRootUrl()
    const docId = encodeURIComponent(this._currentDetailDocId)
    const url = `${buildApiUrl(root, "cases", this.caseIdValue, "tries", this.tryNumberValue, "queries", this.queryIdValue, "search", "raw")}?doc_id=${docId}`
    window.open(url, "_blank")
  }

  _initJsonTree(pre) {
    const container = pre.parentElement
    if (!container) return

    // Remove any previously rendered json-tree div
    const existing = container.querySelector(".json-tree")
    if (existing) existing.remove()

    // Show the pre again so the json-tree controller can read its content
    pre.style.display = ""

    container.setAttribute("data-controller", "json-tree")
    pre.setAttribute("data-json-tree-target", "source")

    // Force Stimulus to notice the new/updated controller attribute
    const app = this.application
    if (app) {
      requestAnimationFrame(() => {
        const ctrl = app.getControllerForElementAndIdentifier(container, "json-tree")
        if (ctrl) {
          // Re-run rendering (clears old trees and rebuilds)
          ctrl.sourceTargets.forEach(src => {
            const oldTree = src.nextElementSibling
            if (oldTree?.classList?.contains("json-tree")) oldTree.remove()
            src.style.display = ""
          })
          ctrl.connect()
        }
      })
    }
  }

  _escapeHtml(str) {
    if (str == null) return ""
    const div = document.createElement("div")
    div.textContent = String(str)
    return div.innerHTML
  }

  _escapeHtmlAttr(str) {
    if (str == null) return ""
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }

  /** Sanitize doc_id for HTML id used by Turbo Stream targets. Must match server. */
  _ratingBadgeId(docId) {
    return `rating-badge-${String(docId).replace(/\s/g, "_")}`
  }
}

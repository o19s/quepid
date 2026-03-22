import { Controller } from "@hotwired/stimulus"
import { executeSearch } from "modules/search_executor"
import { apiUrl, csrfToken } from "modules/api_url"
import { RatingsStore } from "modules/ratings_store"
import { scaleToColors, ratingColor, scoreToColor } from "modules/scorer"
import { runScorerCode } from "modules/scorer_executor"
import { parseExplain, hotMatchesOutOf } from "modules/explain_parser"

// Shared config caches — keyed by caseId:tryNumber so navigating to a
// different case/try fetches fresh config instead of serving stale data.
let tryConfigCache = { key: null, promise: null }
let scorerConfigCache = { key: null, promise: null }

function configCacheKey() {
  return `${document.body.dataset.caseId}:${document.body.dataset.tryNumber}`
}

function fetchScorerConfig() {
  const key = configCacheKey()
  if (scorerConfigCache.key === key && scorerConfigCache.promise) {
    return scorerConfigCache.promise
  }

  const scorerId = document.body.dataset.scorerId
  if (!scorerId) {
    scorerConfigCache = { key, promise: Promise.resolve(null) }
    return scorerConfigCache.promise
  }

  const promise = fetch(apiUrl(`api/scorers/${scorerId}`), {
    headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load scorer (${r.status})`)
      return r.json()
    })
    .catch((err) => {
      scorerConfigCache = { key: null, promise: null }
      throw err
    })

  scorerConfigCache = { key, promise }
  return promise
}

function fetchTryConfig() {
  const key = configCacheKey()
  if (tryConfigCache.key === key && tryConfigCache.promise) {
    return tryConfigCache.promise
  }

  const caseId = document.body.dataset.caseId
  const tryNumber = document.body.dataset.tryNumber

  const promise = fetch(apiUrl(`api/cases/${caseId}/tries/${tryNumber}`), {
    headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
  })
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load try config (${r.status})`)
      return r.json()
    })
    .catch((err) => {
      tryConfigCache = { key: null, promise: null }
      throw err
    })

  tryConfigCache = { key, promise }
  return promise
}

// Parse scorer scale from body data attribute (once, shared)
function getScorerScale() {
  try {
    return JSON.parse(document.body.dataset.scorerScale || "[]")
  } catch {
    return []
  }
}

export default class extends Controller {
  static targets = [
    "expandedContent",
    "chevron",
    "resultsContainer",
    "scoreDisplay",
    "totalResults",
    "notesPanel",
    "notesInput",
    "informationNeedInput",
    "notesSavedIndicator",
    "explainToggle",
    "queryExplainBtn",
    "bulkRateMenu",
  ]
  static values = {
    queryId: { type: Number },
    queryText: { type: String, default: "" },
    ratings: { type: Object, default: {} },
    notes: { type: String, default: "" },
    informationNeed: { type: String, default: "" },
  }

  connect() {
    this.expanded = false
    this.searchLoaded = false
    this.abortController = null
    this.lastSearchDocs = []
    this.lastNumFound = 0
    this.lastResult = null
    this.debugMode = false
    this.comparisonSnapshots = null
    this._comparisonDirty = false
    this._ratingsInFlight = new Set()
    this._notesSavedTimer = null

    const caseId = parseInt(document.body.dataset.caseId, 10)
    this.ratingsStore = new RatingsStore(caseId, this.queryIdValue, this.ratingsValue)
    this.scorerScale = getScorerScale()
    this.colorMap = scaleToColors(this.scorerScale)

    // Populate bulk rate dropdown with scale values
    if (this.hasBulkRateMenuTarget) {
      for (const val of this.scorerScale) {
        const li = document.createElement("li")
        li.innerHTML = `<a class="dropdown-item" href="#"
          data-action="click->query-row#bulkRate"
          data-rating-value="${val}">Rate all ${val}</a>`
        this.bulkRateMenuTarget.appendChild(li)
      }
    }

    // Listen for snapshot comparison events
    this._onComparisonActivate = (e) => {
      this.comparisonSnapshots = e.detail.snapshots
      if (this.expanded && this.searchLoaded) {
        this.renderDiffResults()
      } else {
        this._comparisonDirty = true
      }
    }
    this._onComparisonDeactivate = () => {
      this.comparisonSnapshots = null
      if (this.expanded && this.lastResult) {
        this.renderResults(this.lastResult)
      } else {
        this._comparisonDirty = true
      }
    }
    document.addEventListener("snapshot-comparison:activate", this._onComparisonActivate)
    document.addEventListener("snapshot-comparison:deactivate", this._onComparisonDeactivate)
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this._notesSavedTimer) {
      clearTimeout(this._notesSavedTimer)
      this._notesSavedTimer = null
    }
    document.removeEventListener("snapshot-comparison:activate", this._onComparisonActivate)
    document.removeEventListener("snapshot-comparison:deactivate", this._onComparisonDeactivate)
  }

  toggle() {
    if (this.expanded) {
      this.collapse()
    } else {
      this.expand()
    }
  }

  expand() {
    this.expanded = true
    this.expandedContentTarget.classList.remove("d-none")
    this.chevronTarget.classList.remove("glyphicon-chevron-down")
    this.chevronTarget.classList.add("glyphicon-chevron-up")

    if (!this.searchLoaded) {
      this.runSearch()
    } else if (this._comparisonDirty) {
      // Comparison state changed while collapsed — re-render in correct mode
      this._comparisonDirty = false
      if (this.comparisonSnapshots) {
        this.renderDiffResults()
      } else if (this.lastResult) {
        this.renderResults(this.lastResult)
      }
    }
  }

  collapse() {
    this.expanded = false
    this.expandedContentTarget.classList.add("d-none")
    this.chevronTarget.classList.remove("glyphicon-chevron-up")
    this.chevronTarget.classList.add("glyphicon-chevron-down")
  }

  // Public method for the query-list outlet to call
  async rerunSearch() {
    this.searchLoaded = false
    return this.runSearch()
  }

  // Toggle explain/debug mode — re-runs search with debug data
  toggleExplain() {
    this.debugMode = !this.debugMode
    this.searchLoaded = false

    // Visual feedback on the explain toggle button
    if (this.hasExplainToggleTarget) {
      this.explainToggleTarget.classList.toggle("btn-info", this.debugMode)
      this.explainToggleTarget.classList.toggle("btn-default", !this.debugMode)
    }

    // Show/hide the Query Explain button
    if (this.hasQueryExplainBtnTarget) {
      this.queryExplainBtnTarget.classList.toggle("d-none", !this.debugMode)
    }

    this.runSearch()
  }

  // Show the query explain modal with debug data from the last search
  showQueryExplain() {
    if (!this.lastResult) return

    document.dispatchEvent(
      new CustomEvent("show-query-explain", {
        detail: {
          queryDetails: this.lastResult.queryDetails || null,
          parsedQueryDetails: this.lastResult.parsedQueryDetails || null,
          queryText: this.queryTextValue,
          renderedTemplate: null,
        },
      }),
    )
  }

  // Bulk rate all visible docs with the given rating value
  async bulkRate(event) {
    event.preventDefault()
    const value = event.currentTarget.dataset.ratingValue
    const docIds = this.lastSearchDocs.map((d) => String(d.id))
    if (docIds.length === 0) return

    try {
      if (value === "clear") {
        await this.ratingsStore.unrateBulk(docIds)
      } else {
        await this.ratingsStore.rateBulk(docIds, parseInt(value, 10))
      }
      // Re-render all rating widgets and update score
      this._refreshAllRatingWidgets()
      this._updateScoreBadge()
    } catch (error) {
      console.error("Bulk rate failed:", error)
      alert("Failed to bulk rate")
    }
  }

  // Open the doc finder modal for this query
  openDocFinder() {
    document.dispatchEvent(
      new CustomEvent("show-doc-finder", {
        detail: {
          queryId: this.queryIdValue,
          queryText: this.queryTextValue,
          ratingsStore: this.ratingsStore,
          scorerScale: this.scorerScale,
          colorMap: this.colorMap,
          onRatingChanged: () => {
            this._refreshAllRatingWidgets()
            this._updateScoreBadge()
          },
        },
      }),
    )
  }

  async runSearch() {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    const container = this.resultsContainerTarget
    container.innerHTML =
      '<p class="text-muted"><i class="glyphicon glyphicon-refresh"></i> Searching...</p>'

    try {
      const tryConfig = await fetchTryConfig()
      const searchOptions = this.debugMode ? { debug: true } : {}
      const result = await executeSearch(
        tryConfig,
        this.queryTextValue,
        this.abortController.signal,
        searchOptions,
      )

      this.searchLoaded = true
      this.lastSearchDocs = result.docs || []
      this.lastNumFound = result.numFound || 0
      this.lastResult = result

      if (this.comparisonSnapshots) {
        this.renderDiffResults()
      } else {
        this.renderResults(result)
      }
      this._computeAndDisplayScore()
    } catch (error) {
      if (error.name === "AbortError") return
      container.innerHTML = `<div class="alert alert-danger">Search failed: ${this._escapeHtml(error.message)}</div>`
    }
  }

  renderResults(result) {
    const container = this.resultsContainerTarget

    // Update the total results count in the header
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = this._buildTotalResultsText()
    }

    if (result.error) {
      container.innerHTML = `<div class="alert alert-warning">${this._escapeHtml(result.error)}</div>`
      return
    }

    if (result.docs.length === 0) {
      container.innerHTML = '<p class="text-muted">No results found.</p>'
      return
    }

    // Compute max score across docs for stacked chart percentages
    const maxDocScore = this.debugMode
      ? Math.max(...result.docs.map((d) => d.score || 0), 0.001)
      : 0

    const rows = result.docs.map((doc, docIdx) => {
      const subsHtml = Object.entries(doc.subs)
        .map(([key, value]) => {
          const display = Array.isArray(value) ? value.join(", ") : value
          return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${this._escapeHtml(String(display))}</div>`
        })
        .join("")

      const thumbHtml = doc.thumb
        ? `<img src="${this._escapeAttr(doc.thumb)}" class="doc-thumb" />`
        : ""

      const ratingHtml = this._buildRatingWidget(doc)

      const explainHtml =
        this.debugMode && doc.explain ? this._buildStackedChart(doc, maxDocScore) : ""

      return `
        <li class="doc-row">
          ${ratingHtml}
          <div class="doc-content">
            ${thumbHtml}
            <a href="#" class="doc-title-link" data-doc-idx="${docIdx}">${this._escapeHtml(String(doc.title))}</a>
            <div class="doc-id">ID: ${this._escapeHtml(String(doc.id))}</div>
            ${subsHtml}
          </div>
          ${explainHtml}
        </li>`
    })

    this._ensureRatingColorStyles()

    container.innerHTML = `
      <div class="search-results-header">
        ${result.numFound} results found
        ${result.linkUrl ? `<a href="${this._escapeAttr(result.linkUrl)}" target="_blank" rel="noopener" class="search-results-raw-link">View raw</a>` : ""}
      </div>
      <ol class="search-results-list">
        ${rows.join("")}
      </ol>`

    // Attach click handlers to rating buttons and doc title links
    this._attachRatingListeners(container)
    this._attachDocTitleListeners(container)
  }

  renderDiffResults() {
    const container = this.resultsContainerTarget
    const snapshots = this.comparisonSnapshots || []
    const currentDocs = this.lastSearchDocs || []
    const queryId = String(this.queryIdValue)

    // Update the total results count in the header
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = this._buildTotalResultsText()
    }

    // Header row
    const headerCols = [`<div class="diff-column"><strong>Current Results</strong></div>`]
    for (const snap of snapshots) {
      headerCols.push(
        `<div class="diff-column"><strong>${this._escapeHtml(snap.name)}</strong></div>`,
      )
    }
    const headerHtml = `<div class="diff-header">${headerCols.join("")}</div>`

    // Gather snapshot docs for this query
    const snapshotDocs = snapshots.map((snap) => {
      const docs = snap.docs ? snap.docs[queryId] : null
      return docs || null // null means query not in snapshot
    })

    // Determine max rows
    const maxLen = Math.max(
      currentDocs.length,
      ...snapshotDocs.map((d) => (d ? d.length : 0)),
    )

    if (maxLen === 0) {
      container.innerHTML = '<p class="text-muted">No results to compare.</p>'
      return
    }

    // Build set of current doc IDs for diff highlighting
    const currentDocIds = new Set(currentDocs.map((d) => String(d.id)))

    const rows = []
    for (let i = 0; i < maxLen; i++) {
      const cols = []

      // Current results column
      if (i < currentDocs.length) {
        cols.push(`<div class="diff-column">${this._buildDocCell(currentDocs[i], i + 1)}</div>`)
      } else {
        cols.push(
          `<div class="diff-column"><div class="alert alert-secondary py-1 small">No result at position ${i + 1}</div></div>`,
        )
      }

      // Snapshot columns
      for (let s = 0; s < snapshots.length; s++) {
        const sDocs = snapshotDocs[s]
        if (sDocs === null) {
          cols.push(
            `<div class="diff-column"><div class="alert alert-info py-1 small">Query not in snapshot</div></div>`,
          )
        } else if (i < sDocs.length) {
          const snapDoc = sDocs[i]
          const snapDocId = String(snapDoc.id)
          const currentDocAtPos = i < currentDocs.length ? String(currentDocs[i].id) : null

          // Determine highlight class
          let highlightClass = ""
          if (!currentDocAtPos) {
            // Current results are shorter — snapshot has extra docs
            highlightClass = " missing"
          } else if (currentDocAtPos !== snapDocId) {
            // Different doc at same position — check if it moved or disappeared
            highlightClass = currentDocIds.has(snapDocId) ? " different" : " missing"
          }

          cols.push(
            `<div class="diff-column"><div class="search-result${highlightClass}">${this._buildSnapshotDocCell(snapDoc, i + 1)}</div></div>`,
          )
        } else {
          cols.push(
            `<div class="diff-column"><div class="alert alert-secondary py-1 small">No result at position ${i + 1}</div></div>`,
          )
        }
      }

      rows.push(`<div class="diff-row">${cols.join("")}</div>`)
    }

    this._ensureRatingColorStyles()

    container.innerHTML = `<div class="diff-container">${headerHtml}${rows.join("")}</div>`

    // Attach rating listeners for current results column
    this._attachRatingListeners(container)
    this._attachDocTitleListeners(container)
  }

  _buildDocCell(doc, rank) {
    const subsHtml = Object.entries(doc.subs || {})
      .map(([key, value]) => {
        const display = Array.isArray(value) ? value.join(", ") : value
        return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${this._escapeHtml(String(display))}</div>`
      })
      .join("")

    const thumbHtml = doc.thumb
      ? `<img src="${this._escapeAttr(doc.thumb)}" class="doc-thumb" />`
      : ""

    const ratingHtml = this._buildRatingWidget(doc)

    return `
      <div class="doc-row">
        ${ratingHtml}
        <div class="doc-content">
          ${thumbHtml}
          <span class="badge bg-secondary me-1">${rank}</span>
          <a href="#" class="doc-title-link" data-doc-idx="${rank - 1}">${this._escapeHtml(String(doc.title || doc.id))}</a>
          <div class="doc-id">ID: ${this._escapeHtml(String(doc.id))}</div>
          ${subsHtml}
        </div>
      </div>`
  }

  _buildSnapshotDocCell(snapDoc, rank) {
    // Snapshot docs have { id, fields, explain, rated_only } structure
    const fieldsHtml = snapDoc.fields
      ? Object.entries(snapDoc.fields)
          .map(([key, value]) => {
            const display =
              typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)
            return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${this._escapeHtml(display)}</div>`
          })
          .join("")
      : ""

    return `
      <div class="doc-row">
        <div class="doc-content">
          <span class="badge bg-secondary me-1">${rank}</span>
          <strong>${this._escapeHtml(String(snapDoc.id))}</strong>
          ${fieldsHtml}
        </div>
      </div>`
  }

  // --- Rating widget ---

  _buildRatingWidget(doc) {
    const docId = String(doc.id)
    const currentRating = this.ratingsStore.getRating(docId)
    // Use a data-safe encoding: base64 avoids all HTML/CSS escaping issues with doc IDs
    const encodedDocId = btoa(unescape(encodeURIComponent(docId)))

    const buttons = this.scorerScale
      .map((val) => {
        const numVal = parseInt(val, 10)
        const isActive = currentRating === numVal
        const activeClass = isActive ? " rating-btn-active" : ""
        const colorClass = isActive ? ` rating-color-${numVal}` : ""
        return `<button type="button"
                class="rating-btn${activeClass}${colorClass}"
                data-rating-action="rate"
                data-encoded-doc-id="${encodedDocId}"
                data-rating-value="${numVal}">${numVal}</button>`
      })
      .join("")

    const clearBtn =
      currentRating !== null
        ? `<button type="button" class="rating-btn rating-btn-clear"
           data-rating-action="unrate"
           data-encoded-doc-id="${encodedDocId}"
           title="Clear rating">&times;</button>`
        : ""

    return `<div class="doc-rating" data-encoded-doc-id="${encodedDocId}">${buttons}${clearBtn}</div>`
  }

  /**
   * Inject a <style> block with per-scale-value color classes.
   * Called once in connect() or lazily on first render. Idempotent.
   */
  _ensureRatingColorStyles() {
    if (document.getElementById("rating-color-styles")) return

    const rules = this.scorerScale
      .map((val) => {
        const numVal = parseInt(val, 10)
        const color = ratingColor(numVal, this.colorMap)
        return `.rating-color-${numVal} { background-color: ${color}; color: #fff; }`
      })
      .join("\n")

    const style = document.createElement("style")
    style.id = "rating-color-styles"
    style.textContent = rules
    document.head.appendChild(style)
  }

  _attachRatingListeners(container) {
    container.querySelectorAll("[data-rating-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => this._handleRatingClick(e))
    })
  }

  async _handleRatingClick(event) {
    const btn = event.currentTarget
    const docId = decodeURIComponent(escape(atob(btn.dataset.encodedDocId)))

    // Per-doc guard: ignore clicks while this doc's rating is in flight
    if (this._ratingsInFlight.has(docId)) return
    this._ratingsInFlight.add(docId)

    const action = btn.dataset.ratingAction

    try {
      if (action === "rate") {
        const value = parseInt(btn.dataset.ratingValue, 10)
        const currentRating = this.ratingsStore.getRating(docId)

        // Toggle off if clicking the same rating
        if (currentRating === value) {
          await this.ratingsStore.unrate(docId)
        } else {
          await this.ratingsStore.rate(docId, value)
        }
      } else if (action === "unrate") {
        await this.ratingsStore.unrate(docId)
      }

      // Re-render the rating widget for this doc
      this._refreshRatingWidget(docId)
      // Update the score badge and total results text
      this._updateScoreBadge()
    } catch (error) {
      console.error("Rating failed:", error)
      alert("Failed to save rating")
    } finally {
      this._ratingsInFlight.delete(docId)
    }
  }

  _refreshAllRatingWidgets() {
    for (const doc of this.lastSearchDocs) {
      this._refreshRatingWidget(String(doc.id))
    }
  }

  _refreshRatingWidget(docId) {
    const encodedDocId = btoa(unescape(encodeURIComponent(docId)))
    const container = this.resultsContainerTarget
    const widgetEl = container.querySelector(`[data-encoded-doc-id="${encodedDocId}"].doc-rating`)
    if (!widgetEl) return

    // Find the doc object from last search results
    const doc = this.lastSearchDocs.find((d) => String(d.id) === docId)
    if (!doc) return

    // Replace widget HTML
    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = this._buildRatingWidget(doc)
    const newWidget = tempDiv.firstElementChild

    widgetEl.replaceWith(newWidget)

    // Re-attach click handlers on the new widget
    this._attachRatingListeners(newWidget)
  }

  _updateScoreBadge() {
    // Update the "X found, Y rated" text
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = this._buildTotalResultsText()
    }

    // Compute score asynchronously then update badge and notify parent
    this._computeAndDisplayScore()
  }

  async _computeAndDisplayScore() {
    const badge = this.hasScoreDisplayTarget ? this.scoreDisplayTarget : null

    try {
      const scorer = await fetchScorerConfig()
      if (!scorer || !scorer.code) {
        if (badge) {
          badge.textContent = "--"
          badge.style.backgroundColor = ""
          badge.classList.add("score-badge-unscored")
        }
        this._dispatchScoreChanged(null)
        return
      }

      const scale = scorer.scale || this.scorerScale
      const ratings = this.ratingsStore.ratings
      const bestDocs = this.ratingsStore.bestDocs()
      const maxScaleValue = scale.length > 0 ? parseInt(scale[scale.length - 1], 10) : 0

      const score = runScorerCode(
        scorer.code,
        scale,
        this.lastSearchDocs,
        ratings,
        this.lastNumFound,
        bestDocs,
      )

      this.currentScore = score

      if (badge) {
        if (typeof score === "number") {
          const rounded = Math.round(score * 100) / 100
          badge.textContent = rounded.toFixed(2)
          badge.classList.remove("score-badge-unscored")
          badge.style.backgroundColor = scoreToColor(score, maxScaleValue)
        } else {
          badge.textContent = score || "--"
          badge.style.backgroundColor = ""
          badge.classList.add("score-badge-unscored")
        }
      }

      this._dispatchScoreChanged(score)
    } catch (e) {
      console.error("Score computation failed:", e)
      if (badge) {
        badge.textContent = "--"
        badge.style.backgroundColor = ""
        badge.classList.add("score-badge-unscored")
      }
      this._dispatchScoreChanged(null)
    }
  }

  _dispatchScoreChanged(score) {
    this.dispatch("scoreChanged", {
      detail: {
        queryId: this.queryIdValue,
        queryText: this.queryTextValue,
        score: score,
        maxScore:
          this.scorerScale.length > 0
            ? parseInt(this.scorerScale[this.scorerScale.length - 1], 10)
            : 0,
        numFound: this.lastNumFound,
      },
    })
  }

  _buildTotalResultsText() {
    const parts = []
    if (this.searchLoaded) {
      parts.push(`${this.lastNumFound} found`)
    }
    const ratedCount = this.ratingsStore.ratedCount()
    if (ratedCount > 0) {
      parts.push(`${ratedCount} rated`)
    }
    return parts.join(", ")
  }

  toggleNotes() {
    if (!this.hasNotesPanelTarget) return
    this.notesPanelTarget.classList.toggle("d-none")
  }

  async saveNotes() {
    const caseId = document.body.dataset.caseId
    const notes = this.hasNotesInputTarget ? this.notesInputTarget.value : ""
    const informationNeed = this.hasInformationNeedInputTarget
      ? this.informationNeedInputTarget.value
      : ""

    try {
      const response = await fetch(
        apiUrl(`api/cases/${caseId}/queries/${this.queryIdValue}/notes`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken(),
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: { notes, information_need: informationNeed },
          }),
        },
      )

      if (response.ok) {
        this.notesValue = notes
        this.informationNeedValue = informationNeed

        // Show saved indicator briefly
        if (this.hasNotesSavedIndicatorTarget) {
          this.notesSavedIndicatorTarget.classList.remove("d-none")
          if (this._notesSavedTimer) clearTimeout(this._notesSavedTimer)
          this._notesSavedTimer = setTimeout(() => {
            this._notesSavedTimer = null
            if (this.hasNotesSavedIndicatorTarget) {
              this.notesSavedIndicatorTarget.classList.add("d-none")
            }
          }, 2000)
        }
      } else {
        alert(`Failed to save notes (${response.status})`)
      }
    } catch (error) {
      console.error("Failed to save notes:", error)
      alert("Failed to save notes: network error")
    }
  }

  async deleteQuery() {
    if (!confirm("Are you sure you want to delete this query?")) return

    const caseId = document.body.dataset.caseId

    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/queries/${this.queryIdValue}`), {
        method: "DELETE",
        headers: {
          "X-CSRF-Token": csrfToken(),
        },
      })

      if (response.ok) {
        this.dispatch("queryDeleted", { detail: { queryId: this.queryIdValue } })
        this.element.remove()
      } else {
        alert(`Failed to delete query (${response.status})`)
      }
    } catch (error) {
      console.error("Failed to delete query:", error)
      alert("Failed to delete query: network error")
    }
  }

  _attachDocTitleListeners(container) {
    container.querySelectorAll(".doc-title-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault()
        const idx = parseInt(link.dataset.docIdx, 10)
        const doc = this.lastSearchDocs[idx]
        if (doc) {
          document.dispatchEvent(new CustomEvent("show-doc-detail", { detail: { doc } }))
        }
      })
    })
  }

  _buildStackedChart(doc, maxDocScore) {
    const tree = parseExplain(doc.explain)
    const matches = hotMatchesOutOf(tree, maxDocScore)
    const colorClasses = ["explain-red", "explain-orange", "explain-green", "explain-blue"]

    const bars = matches
      .slice(0, 5)
      .map((m, i) => {
        const pct = Math.min(Math.max(m.percentage, 0), 100)
        const colorClass = colorClasses[i % colorClasses.length]
        const label = this._truncateExplainLabel(m.description)
        const bar = document.createElement("div")
        bar.className = "explain-bar-row"
        bar.title = m.description
        bar.innerHTML = `<div class="explain-bar ${colorClass}"></div>
          <span class="explain-bar-label">${this._escapeHtml(label)}</span>`
        bar.firstElementChild.style.width = `${pct.toFixed(1)}%`
        return bar.outerHTML
      })
      .join("")

    const scoreText = doc.score != null ? doc.score.toFixed(4) : ""

    return `<div class="explain-stacked-chart">
      <div class="explain-score">${this._escapeHtml(scoreText)}</div>
      ${bars}
    </div>`
  }

  _truncateExplainLabel(desc) {
    // Extract the meaningful part from explain descriptions like "weight(title:foo in 123)"
    const match = desc.match(/^weight\((.+?)\s+in\s+\d+\)/)
    if (match) return match[1]
    if (desc.length > 40) return desc.substring(0, 37) + "..."
    return desc
  }

  _escapeHtml(str) {
    const div = document.createElement("div")
    div.textContent = str
    return div.innerHTML
  }

  _escapeAttr(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }
}

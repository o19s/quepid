import { Controller } from "@hotwired/stimulus"
import { executeSearch } from "modules/search_executor"
import { apiUrl, csrfToken } from "modules/api_url"
import { RatingsStore } from "modules/ratings_store"
import { scaleToColors, ratingColor, scoreToColor } from "modules/scorer"
import { runScorerCode } from "modules/scorer_executor"

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
    this._ratingsInFlight = new Set()
    this._notesSavedTimer = null

    const caseId = parseInt(document.body.dataset.caseId, 10)
    this.ratingsStore = new RatingsStore(caseId, this.queryIdValue, this.ratingsValue)
    this.scorerScale = getScorerScale()
    this.colorMap = scaleToColors(this.scorerScale)
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
      const result = await executeSearch(
        tryConfig,
        this.queryTextValue,
        this.abortController.signal,
      )

      this.searchLoaded = true
      this.lastSearchDocs = result.docs || []
      this.lastNumFound = result.numFound || 0
      this.renderResults(result)
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

    const rows = result.docs.map((doc) => {
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

      return `
        <li class="doc-row">
          ${ratingHtml}
          <div class="doc-content">
            ${thumbHtml}
            <div class="doc-title">${this._escapeHtml(String(doc.title))}</div>
            <div class="doc-id">ID: ${this._escapeHtml(String(doc.id))}</div>
            ${subsHtml}
          </div>
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

    // Attach click handlers to rating buttons
    this._attachRatingListeners(container)
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

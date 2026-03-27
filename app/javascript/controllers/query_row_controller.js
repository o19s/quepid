import { Controller } from "@hotwired/stimulus"
import { createQuepidSearcher } from "modules/searcher_adapter"
import { createNormalDoc, createFieldSpec } from "splainer-search"
import { apiUrl, csrfToken } from "modules/api_url"
import { RatingsStore } from "modules/ratings_store"
import { scaleToColors, ratingColor, scoreToColor } from "modules/scorer"
import { runScorerCode } from "modules/scorer_executor"
import { renderFieldValue } from "modules/field_renderer"
import { showFlash } from "modules/flash_helper"

/** Base64-encode a Unicode string (replaces deprecated btoa(unescape(encodeURIComponent()))). */
function b64Encode(str) {
  return btoa(String.fromCodePoint(...new TextEncoder().encode(str)))
}

/** Decode a base64 string back to Unicode (replaces deprecated decodeURIComponent(escape(atob()))). */
function b64Decode(encoded) {
  const bytes = Uint8Array.from(atob(encoded), (c) => c.codePointAt(0))
  return new TextDecoder().decode(bytes)
}

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

// Convert a splainer-search NormalDoc to the flat shape the rendering code expects.
// Preserves the richer splainer-search methods (.explain(), .score(), .hotMatchesOutOf())
// as properties on the returned object so both old rendering and new explain features work.
function flattenNormalDoc(nDoc) {
  // Lazy-cache explain and score — only computed on first access.
  // Avoids parsing the full explain tree for docs that never display debug info.
  let _explain, _explainResolved = false
  let _score, _scoreResolved = false

  const flat = {
    id: nDoc.id,
    title: nDoc.title,
    thumb: nDoc.thumb || null,
    subs: nDoc.subs || {},
    embeds: nDoc.embeds || {},
    translations: nDoc.translations || {},
    _source: nDoc.doc ? nDoc.doc.origin() : {},
    // Lazy explain/score — accessed as properties but computed on demand
    get explain() {
      if (!_explainResolved) { _explain = nDoc.explain ? nDoc.explain() : null; _explainResolved = true }
      return _explain
    },
    get score() {
      if (!_scoreResolved) { _score = typeof nDoc.score === "function" ? nDoc.score() : null; _scoreResolved = true }
      return _score
    },
    hotMatchesOutOf: (maxScore) => (nDoc.hotMatchesOutOf ? nDoc.hotMatchesOutOf(maxScore) : []),
    subSnippets: (pre, post) => (nDoc.subSnippets ? nDoc.subSnippets(pre, post) : {}),
    _url: nDoc._url ? nDoc._url() : null,
    _normalDoc: nDoc,
  }
  return flat
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
    "docExplainToggle",
    "bulkRateMenu",
    "frogIndicator",
    "frogCount",
    "querqyIndicator",
    "snapshotScores",
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
    this.currentSearcher = null
    this.lastSearchDocs = []
    this.lastNumFound = 0
    this.lastResult = null
    this.debugMode = false
    this.depthOfRating = null
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
      this._showSnapshotQueryScores(e.detail.snapshots)
      if (this.expanded && this.searchLoaded) {
        this.renderDiffResults()
      } else {
        this._comparisonDirty = true
      }
    }
    this._onComparisonDeactivate = () => {
      this.comparisonSnapshots = null
      this._clearSnapshotQueryScores()
      if (this.expanded && this.lastResult) {
        this.renderResults(this.lastResult)
      } else {
        this._comparisonDirty = true
      }
    }
    document.addEventListener("snapshot-comparison:activate", this._onComparisonActivate)
    document.addEventListener("snapshot-comparison:deactivate", this._onComparisonDeactivate)

    this._closeRatingMenusOnOutsideClick = this._closeRatingMenusOnOutsideClick.bind(this)
    document.addEventListener("click", this._closeRatingMenusOnOutsideClick, true)
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

    if (this._closeRatingMenusOnOutsideClick) {
      document.removeEventListener("click", this._closeRatingMenusOnOutsideClick, true)
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
    this.chevronTarget.classList.remove("bi-chevron-down")
    this.chevronTarget.classList.add("bi-chevron-up")

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
    this.chevronTarget.classList.remove("bi-chevron-up")
    this.chevronTarget.classList.add("bi-chevron-down")
  }

  // Public method for the query-list outlet to call
  async rerunSearch() {
    this.searchLoaded = false
    return this.runSearch()
  }

  // Solr/ES debug explain on each hit — powers the same "Matches" / stacked-bar column
  // as Angular's search-result row (see `stackedChart` + HotMatchesCtrl). Separate from
  // the "Explain Query" modal, which only needs query-level parsing params.
  toggleDocExplain(event) {
    event?.preventDefault()
    this.debugMode = !this.debugMode
    if (this.hasDocExplainToggleTarget) {
      this.docExplainToggleTarget.classList.toggle("btn-info", this.debugMode)
      this.docExplainToggleTarget.classList.toggle("btn-outline-secondary", !this.debugMode)
      this.docExplainToggleTarget.setAttribute("aria-pressed", this.debugMode ? "true" : "false")
    }
    this.searchLoaded = false
    this.runSearch()
  }

  // Open the Explain Query modal with query-level debug data from the last search.
  // splainer-search searchers always request debug/explain, so data is pre-populated.
  explainQuery(event) {
    event?.preventDefault()
    if (!this.searchLoaded) {
      showFlash("Expand the query row and wait for the search to finish first.", "warning")
      return
    }

    document.dispatchEvent(
      new CustomEvent("show-query-explain", {
        detail: {
          queryDetails: this.lastResult?.queryDetails || null,
          parsedQueryDetails: this.lastResult?.parsedQueryDetails || null,
          queryText: this.queryTextValue,
          renderedTemplate: this.lastResult?.renderedTemplate || null,
        },
      }),
    )
  }

  copyQuery(event) {
    event?.preventDefault()
    navigator.clipboard.writeText(this.queryTextValue).catch(() => {
      showFlash("Could not copy to the clipboard.", "danger")
    })
  }

  openQueryOptionsModal(event) {
    event?.preventDefault()
    document.dispatchEvent(
      new CustomEvent("open-query-options", { detail: { queryId: this.queryIdValue } }),
    )
  }

  openMoveQueryModal(event) {
    event?.preventDefault()
    document.dispatchEvent(
      new CustomEvent("open-move-query", { detail: { queryId: this.queryIdValue } }),
    )
  }

  // Bulk rate all visible docs with the given rating value
  async bulkRate(event) {
    event?.preventDefault()
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
      showFlash("Failed to bulk rate", "danger")
    }
  }

  // Open the doc finder modal for this query
  openDocFinder(event) {
    event?.preventDefault()
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

    // Add loading state to the query row header
    this.element.classList.add("loading")

    const container = this.resultsContainerTarget
    container.innerHTML =
      '<p class="text-muted"><span class="spinner"></span> Searching&hellip;</p>'

    try {
      const tryConfig = await fetchTryConfig()
      this._searchEngine = (tryConfig.search_engine || "solr").toLowerCase()
      this._fieldSpec = createFieldSpec(tryConfig.field_spec)

      // Create a splainer-search searcher and execute
      const searcher = createQuepidSearcher(tryConfig, this.queryTextValue)
      await searcher.search()
      this.currentSearcher = searcher

      // Convert splainer-search docs to the flat shape our rendering expects
      const docs = searcher.docs.map((doc) => flattenNormalDoc(createNormalDoc(this._fieldSpec, doc)))

      this.searchLoaded = true
      this.lastSearchDocs = docs
      this.lastNumFound = searcher.numFound || 0
      // Build renderedTemplate from the searcher's state:
      // - Solr: callUrl is the hydrated GET URL
      // - ES/OS: queryDsl is the hydrated POST body
      // - Others: linkUrl as fallback
      let renderedTemplate = null
      if (searcher.callUrl) {
        renderedTemplate = searcher.callUrl
      } else if (searcher.queryDsl) {
        renderedTemplate = JSON.stringify(searcher.queryDsl, null, 2)
      }

      this.lastResult = {
        docs,
        numFound: searcher.numFound || 0,
        linkUrl: searcher.linkUrl || null,
        renderedTemplate,
        error: searcher.inError ? "Search engine returned an error" : null,
        queryDetails: searcher.queryDetails || null,
        parsedQueryDetails: searcher.parsedQueryDetails || null,
      }

      if (searcher.inError) {
        container.innerHTML = `<div class="alert alert-warning">Search failed. <a href="${this._escapeAttr(searcher.linkUrl || "")}" target="_blank" rel="noopener">View raw response</a></div>`
      } else {
        if (this.comparisonSnapshots) {
          this.renderDiffResults()
        } else {
          this.renderResults(this.lastResult)
        }
        this._computeAndDisplayScore()
      }
    } catch (error) {
      if (error.name === "AbortError") return
      container.innerHTML = `<div class="alert alert-danger">Search failed: ${this._escapeHtml(error.message)}</div>`
    } finally {
      this.element.classList.remove("loading")
    }
  }

  renderResults(result) {
    const container = this.resultsContainerTarget

    // Update the total results count in the header
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = this._buildTotalResultsText()
    }

    // Update frog and querqy indicators in the header
    this._updateFrogIndicator()
    this._updateQuerqyIndicator(result)

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

    const rows = result.docs.map((doc, docIdx) => this._buildResultRow(doc, docIdx, maxDocScore))

    const searchEngine = this._getSearchEngine()
    const browseHtml = this._buildBrowseLink(result, searchEngine)
    const paginateHtml = this._buildPaginateLink(result)
    const depthNote = this._buildDepthNote()

    container.innerHTML = `
      <div class="search-results-header">
        ${result.numFound} results found
        ${result.linkUrl ? `<a href="${this._escapeAttr(result.linkUrl)}" target="_blank" rel="noopener" class="search-results-raw-link">View raw</a>` : ""}
      </div>
      <ol class="search-results-list">
        ${rows.join("")}
      </ol>
      <div class="search-results-footer">
        ${paginateHtml}
        ${browseHtml}
        ${depthNote}
      </div>`

    // Attach click handlers to rating buttons, doc title links, and pagination
    this._attachRatingListeners(container)
    this._applyRatingColors(container)
    this._attachDocTitleListeners(container)
    this._attachPaginateListener(container)
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
    const maxLen = Math.max(currentDocs.length, ...snapshotDocs.map((d) => (d ? d.length : 0)))

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

    container.innerHTML = `<div class="diff-container">${headerHtml}${rows.join("")}</div>`

    // Attach rating listeners for current results column
    this._attachRatingListeners(container)
    this._applyRatingColors(container)
    this._attachDocTitleListeners(container)
  }

  _buildResultRow(doc, docIdx, maxDocScore) {
    // Use highlighted snippets when available, fall back to raw sub fields
    const snippets = typeof doc.subSnippets === "function"
      ? doc.subSnippets("<strong>", "</strong>")
      : null
    const subsHtml = snippets
      ? this._buildSnippetSubFields(snippets)
      : this._buildSmartSubFields(doc.subs)
    const embedsHtml = this._buildEmbeds(doc.embeds)
    const translationsHtml = this._buildTranslations(doc.translations)

    const thumbHtml = doc.thumb
      ? `<img src="${this._escapeAttr(doc.thumb)}" class="doc-thumb" />`
      : ""

    const ratingHtml = this._buildRatingWidget(doc)

    const explainHtml =
      this.debugMode && doc.score != null ? this._buildStackedChart(doc, maxDocScore) : ""

    const rank = docIdx + 1

    return `
      <li class="doc-row">
        ${ratingHtml}
        <div class="doc-content">
          ${thumbHtml}
          <a href="#" class="doc-title-link" data-doc-idx="${docIdx}">${this._escapeHtml(String(doc.title))}</a>
          <div class="doc-id">ID: ${this._escapeHtml(String(doc.id))}</div>
          ${embedsHtml}
          ${translationsHtml}
          ${subsHtml}
          <div class="result-rank text-muted">Rank: #${rank}</div>
        </div>
        ${explainHtml}
      </li>`
  }

  _buildDocCell(doc, rank) {
    const subsHtml = this._buildSmartSubFields(doc.subs || {})

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
    const fieldsHtml = snapDoc.fields ? this._buildSmartSubFields(snapDoc.fields) : ""

    return `
      <div class="doc-row">
        <div class="doc-content">
          <span class="badge bg-secondary me-1">${rank}</span>
          <strong>${this._escapeHtml(String(snapDoc.id))}</strong>
          ${fieldsHtml}
        </div>
      </div>`
  }

  // --- Smart field rendering ---

  _buildSmartSubFields(subs) {
    if (!subs || typeof subs !== "object") return ""
    return Object.entries(subs)
      .map(([key, value]) => {
        return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${renderFieldValue(value, key)}</div>`
      })
      .join("")
  }

  // Render highlighted snippet sub fields — values are pre-escaped HTML from splainer-search
  // with <strong> tags for highlighting. Objects/arrays are rendered as plain text.
  _buildSnippetSubFields(snippets) {
    if (!snippets || typeof snippets !== "object") return ""
    return Object.entries(snippets)
      .map(([key, value]) => {
        let rendered
        if (Array.isArray(value)) {
          // Highlight snippets come as arrays of fragment strings
          rendered = value.join("&hellip;")
        } else if (typeof value === "object" && value !== null) {
          rendered = renderFieldValue(value, key)
        } else {
          // Already HTML-escaped with <strong> highlight markers
          rendered = String(value)
        }
        return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${rendered}</div>`
      })
      .join("")
  }

  _buildEmbeds(embeds) {
    if (!embeds || Object.keys(embeds).length === 0) return ""
    return Object.entries(embeds)
      .map(([key, value]) => {
        return `<div class="doc-sub-field"><span class="text-muted">${this._escapeHtml(key)}:</span> ${renderFieldValue(value, key)}</div>`
      })
      .join("")
  }

  _buildTranslations(translations) {
    if (!translations || Object.keys(translations).length === 0) return ""
    const imgSrc = apiUrl("images/google-translate.png")
    return Object.entries(translations)
      .map(([key, value]) => {
        const strVal = String(value)
        const translateUrl = `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(strVal)}`
        return `<div class="doc-sub-field">
          <span class="text-muted">${this._escapeHtml(key)}:</span>
          ${this._escapeHtml(strVal)}
          <a href="${this._escapeAttr(translateUrl)}" target="_blank" rel="noopener" title="Translate with Google">
            <img src="${this._escapeAttr(imgSrc)}" width="16" height="16" alt="Translate" />
          </a>
        </div>`
      })
      .join("")
  }

  // --- Frog (unrated) and Querqy indicators ---

  _updateFrogIndicator() {
    if (!this.hasFrogIndicatorTarget) return
    // Use depthOfRating (scorer K) to limit which docs count as missing,
    // matching Angular's behavior. Falls back to all docs if K not defined.
    const depth = this.depthOfRating || this.lastSearchDocs.length
    const docsToCheck = this.lastSearchDocs.slice(0, depth)
    const totalDocs = docsToCheck.length
    let unratedCount = 0
    for (const doc of docsToCheck) {
      if (this.ratingsStore.getRating(String(doc.id)) === null) {
        unratedCount++
      }
    }

    if (unratedCount > 0 && totalDocs > 0) {
      this.frogIndicatorTarget.classList.remove("d-none")
      if (this.hasFrogCountTarget) {
        this.frogCountTarget.textContent = unratedCount
      }
    } else {
      this.frogIndicatorTarget.classList.add("d-none")
    }
  }

  _updateQuerqyIndicator(result) {
    if (!this.hasQuerqyIndicatorTarget) return
    let triggered = false

    // Querqy surfaces its data at the top level of Solr's debug output
    // (rawDebug), not inside parsedQueryDetails. Check both locations
    // to match what Angular's splainer-search exposes.
    const debug = result.rawDebug
    if (debug) {
      if (debug.querqy?.rewrite !== undefined) {
        triggered = true
      } else if (debug["querqy.infoLog"] !== undefined) {
        triggered = true
      }
    }

    this.querqyIndicatorTarget.classList.toggle("d-none", !triggered)
  }

  // --- Snapshot per-query scores ---

  _showSnapshotQueryScores(snapshots) {
    if (!this.hasSnapshotScoresTarget) return

    const queryId = this.queryIdValue
    const caseScoreEl = document.querySelector("[data-controller~='case-score']")
    const maxScore = parseFloat(caseScoreEl?.dataset.caseScoreMaxScoreValue || "100")
    const container = this.snapshotScoresTarget
    container.innerHTML = ""

    for (const snap of snapshots) {
      const scores = snap.scores || []
      const queryScore = scores.find((s) => s.query_id === queryId)

      const badge = document.createElement("div")
      badge.className = "overall-rating query-score-badge diff-score-badge"

      if (queryScore && queryScore.score !== null && queryScore.score !== undefined) {
        const score = queryScore.score
        const rounded = Math.round(score * 100) / 100
        badge.textContent = rounded.toFixed(2)
        badge.style.backgroundColor = scoreToColor(score, maxScore)
        badge.title = `${snap.name}: ${rounded.toFixed(2)}`
      } else {
        badge.textContent = "--"
        badge.classList.add("score-badge-unscored")
        badge.title = `${snap.name}: no score`
      }

      container.appendChild(badge)
    }

    container.classList.remove("d-none")
  }

  _clearSnapshotQueryScores() {
    if (!this.hasSnapshotScoresTarget) return
    this.snapshotScoresTarget.innerHTML = ""
    this.snapshotScoresTarget.classList.add("d-none")
  }

  // --- Pagination and browse ---

  _buildPaginateLink(result) {
    const docsShown = this.lastSearchDocs.length
    if (result.numFound > docsShown) {
      return `<button type="button" class="btn btn-outline-secondary btn-sm peek-next-page">
        Peek at the next page of results
      </button>`
    }
    return ""
  }

  _buildBrowseLink(result, searchEngine) {
    if (searchEngine === "solr" && result.linkUrl && !result.error) {
      const count = result.numFound || 0
      const label = count === 1 ? "1 Result" : `${count} Results`
      return `<a href="${this._escapeAttr(result.linkUrl)}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
        Browse ${label} on Solr
      </a>`
    }
    return ""
  }

  _buildDepthNote() {
    // Depth of rating is a scorer setting — show note if scorer uses k/depth
    // This is informational; the scorer's k value limits which results count
    return ""
  }

  _getSearchEngine() {
    return this._searchEngine || "solr"
  }

  _attachPaginateListener(container) {
    const btn = container.querySelector(".peek-next-page")
    if (!btn) return
    btn.addEventListener("click", () => this._loadNextPage())
  }

  async _loadNextPage() {
    const currentCount = this.lastSearchDocs.length
    if (currentCount >= this.lastNumFound) return

    if (!this.currentSearcher) return

    const nextSearcher = this.currentSearcher.pager()
    if (!nextSearcher) return // no more pages

    try {
      await nextSearcher.search()
      this.currentSearcher = nextSearcher

      const newDocs = nextSearcher.docs.map((doc) =>
        flattenNormalDoc(createNormalDoc(this._fieldSpec, doc)),
      )

      if (newDocs.length > 0) {
        this.lastSearchDocs = this.lastSearchDocs.concat(newDocs)
        const combined = {
          ...this.lastResult,
          docs: this.lastSearchDocs,
        }
        this.lastResult = combined
        this.renderResults(combined)
      }
    } catch (error) {
      console.error("Pagination failed:", error)
    }
  }

  // --- Rating widget ---

  _buildRatingWidget(doc) {
    const docId = String(doc.id)
    const currentRating = this.ratingsStore.getRating(docId)
    // Use a data-safe encoding: base64 avoids all HTML/CSS escaping issues with doc IDs
    const encodedDocId = b64Encode(docId)

    const display = currentRating !== null ? String(currentRating) : "--"

    const scaleItems = this.scorerScale
      .map((val) => {
        const numVal = parseInt(val, 10)
        return `<li><button type="button" class="dropdown-item doc-rating-scale-item text-white"
                data-rating-action="rate"
                data-encoded-doc-id="${encodedDocId}"
                data-rating-value="${numVal}">${numVal}</button></li>`
      })
      .join("")

    const resetBlock =
      currentRating !== null
        ? `<li><hr class="dropdown-divider" /></li>
           <li><button type="button" class="dropdown-item" data-rating-action="unrate"
             data-encoded-doc-id="${encodedDocId}">RESET</button></li>`
        : ""

    // Same interaction pattern as Angular searchResult.html: one button + caret, menu lists scale + RESET
    return `<div class="dropdown doc-rating" data-encoded-doc-id="${encodedDocId}">
      <button type="button" class="btn btn-sm doc-rating-toggle"
        data-rating-action="toggle-menu"
        aria-expanded="false" aria-haspopup="true">
        ${this._escapeHtml(display)}<span class="doc-rating-caret" aria-hidden="true"></span>
      </button>
      <ul class="dropdown-menu doc-rating-menu">
        ${scaleItems}
        ${resetBlock}
      </ul>
    </div>`
  }

  _closeRatingMenusOnOutsideClick(event) {
    if (!this.hasResultsContainerTarget) return
    if (event.target.closest(".doc-rating")) return
    this._closeAllRatingMenus()
  }

  _closeAllRatingMenus() {
    if (!this.hasResultsContainerTarget) return
    this.resultsContainerTarget.querySelectorAll(".doc-rating-menu.show").forEach((menu) => {
      menu.classList.remove("show")
      const toggle = menu.previousElementSibling
      if (toggle?.classList?.contains("doc-rating-toggle")) {
        toggle.setAttribute("aria-expanded", "false")
      }
    })
  }

  _toggleRatingMenu(button) {
    const wrap = button.closest(".doc-rating")
    if (!wrap) return
    const menu = wrap.querySelector(".doc-rating-menu")
    if (!menu) return
    const wasOpen = menu.classList.contains("show")
    this._closeAllRatingMenus()
    if (!wasOpen) {
      menu.classList.add("show")
      button.setAttribute("aria-expanded", "true")
    }
  }

  /** Apply dynamic background colors to rating widgets via the DOM API. */
  _applyRatingColors(container) {
    // Trigger buttons: color by current rating
    container.querySelectorAll(".doc-rating-toggle").forEach((btn) => {
      const wrap = btn.closest(".doc-rating")
      if (!wrap) return
      const encodedDocId = wrap.dataset.encodedDocId
      if (!encodedDocId) return
      const docId = b64Decode(encodedDocId)
      const rating = this.ratingsStore.getRating(docId)
      btn.style.backgroundColor =
        rating !== null && Object.hasOwn(this.colorMap, rating)
          ? ratingColor(rating, this.colorMap)
          : "#777"
    })
    // Scale menu items: color by their rating value
    container.querySelectorAll(".doc-rating-scale-item").forEach((btn) => {
      const val = parseInt(btn.dataset.ratingValue, 10)
      if (!Number.isNaN(val)) {
        btn.style.backgroundColor = ratingColor(val, this.colorMap)
      }
    })
  }

  _attachRatingListeners(container) {
    container.querySelectorAll("[data-rating-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const action = el.dataset.ratingAction
        if (action === "toggle-menu") {
          e.preventDefault()
          e.stopPropagation()
          this._toggleRatingMenu(el)
          return
        }
        e.preventDefault()
        this._handleRatingClick(e)
      })
    })
  }

  async _handleRatingClick(event) {
    const btn = event.currentTarget
    const docId = b64Decode(btn.dataset.encodedDocId)

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
      this._closeAllRatingMenus()
      // Update the score badge and total results text
      this._updateScoreBadge()
    } catch (error) {
      console.error("Rating failed:", error)
      showFlash("Failed to save rating", "danger")
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
    const encodedDocId = b64Encode(docId)
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

    // Re-attach click handlers and colors on the new widget
    this._attachRatingListeners(newWidget)
    this._applyRatingColors(newWidget)
  }

  _updateScoreBadge() {
    // Update the "X found, Y rated" text
    if (this.hasTotalResultsTarget) {
      this.totalResultsTarget.textContent = this._buildTotalResultsText()
    }

    // Update frog indicator (unrated count changed)
    this._updateFrogIndicator()

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

      const result = runScorerCode(
        scorer.code,
        scale,
        this.lastSearchDocs,
        ratings,
        this.lastNumFound,
        bestDocs,
      )
      const score = result.score
      this.depthOfRating = result.depthOfRating

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

  toggleNotes(event) {
    event?.preventDefault()
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
        showFlash(`Failed to save notes (${response.status})`, "danger")
      }
    } catch (error) {
      console.error("Failed to save notes:", error)
      showFlash("Failed to save notes: network error", "danger")
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
        showFlash(`Failed to delete query (${response.status})`, "danger")
      }
    } catch (error) {
      console.error("Failed to delete query:", error)
      showFlash("Failed to delete query: network error", "danger")
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
    const matches = doc.hotMatchesOutOf(maxDocScore)

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

    const scoreVal = typeof doc.score === "number" ? doc.score : null
    const scoreText = scoreVal != null ? scoreVal.toFixed(4) : ""

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

import { Controller } from "@hotwired/stimulus"
import { executeSearch } from "modules/search_executor"
import { apiUrl, csrfToken } from "modules/api_url"
import { ratingColor } from "modules/scorer"

// Doc Finder Modal — search for and rate specific documents not in main results.
// Listens for "show-doc-finder" events from query_row_controller.
export default class extends Controller {
  static targets = ["searchInput", "resultsContainer"]

  connect() {
    this._onShow = (e) => this.open(e.detail)
    document.addEventListener("show-doc-finder", this._onShow)
    this.modalInstance = null
    this._context = null
    this._tryConfigPromise = null
  }

  disconnect() {
    this._tryConfigPromise = null
    document.removeEventListener("show-doc-finder", this._onShow)
  }

  open(context) {
    this._context = context
    this.searchInputTarget.value = ""
    this.resultsContainerTarget.innerHTML = ""

    this.modalInstance = window.bootstrap.Modal.getOrCreateInstance(this.element)
    this.modalInstance.show()
  }

  async search() {
    if (!this._context) return
    const searchText = this.searchInputTarget.value.trim()
    if (!searchText) return

    this.resultsContainerTarget.innerHTML =
      '<p class="text-muted"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Searching...</p>'

    try {
      const tryConfig = await this._fetchTryConfig()
      const result = await executeSearch(tryConfig, searchText)

      if (result.error) {
        this.resultsContainerTarget.innerHTML = `<div class="alert alert-warning">${this._escapeHtml(result.error)}</div>`
        return
      }

      this._renderFinderResults(result.docs)
    } catch (error) {
      this.resultsContainerTarget.innerHTML = `<div class="alert alert-danger">Search failed: ${this._escapeHtml(error.message)}</div>`
    }
  }

  async showRatedDocs() {
    if (!this._context) return
    const { ratingsStore } = this._context
    const ratedDocIds = Object.keys(ratingsStore.ratings)

    if (ratedDocIds.length === 0) {
      this.resultsContainerTarget.innerHTML =
        '<p class="text-muted">No rated documents for this query.</p>'
      return
    }

    this.resultsContainerTarget.innerHTML =
      '<p class="text-muted"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Loading rated docs...</p>'

    try {
      const tryConfig = await this._fetchTryConfig()
      const engine = (tryConfig.search_engine || "solr").toLowerCase()

      const docFinderEngines = ["solr", "static", "es", "os"]
      if (!docFinderEngines.includes(engine)) {
        this.resultsContainerTarget.innerHTML =
          `<p class="text-muted">Loading every rated document at once is not supported for the "${engine}" engine. Use the search box above instead.</p>`
        return
      }

      // Build a filter query to fetch only rated docs
      let filterConfig
      if (engine === "solr" || engine === "static") {
        const idField = this._getIdField(tryConfig)
        const idsFilter = ratedDocIds
          .map((id) => `"${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
          .join(" OR ")
        filterConfig = structuredClone(tryConfig)
        // Replace args entirely — the original args may contain template
        // placeholders (#$query##) in fq, etc. that would be incorrectly hydrated
        filterConfig.args = {
          q: [`${idField}:(${idsFilter})`],
          rows: [String(ratedDocIds.length)],
        }
      } else {
        // ES/OS — use terms query
        const idField = this._getIdField(tryConfig)
        filterConfig = structuredClone(tryConfig)
        filterConfig.args = {
          query: { terms: { [idField]: ratedDocIds } },
          size: ratedDocIds.length,
        }
      }

      // Use a dummy query text since we're overriding the query
      const result = await executeSearch(filterConfig, ratedDocIds[0])
      this._renderFinderResults(result.docs || [])
    } catch (error) {
      this.resultsContainerTarget.innerHTML = `<div class="alert alert-danger">Failed to load rated docs: ${this._escapeHtml(error.message)}</div>`
    }
  }

  _renderFinderResults(docs) {
    if (docs.length === 0) {
      this.resultsContainerTarget.innerHTML = '<p class="text-muted">No results found.</p>'
      return
    }

    const { ratingsStore, scorerScale } = this._context
    const rows = docs
      .map((doc, idx) => {
        const docId = String(doc.id)
        const currentRating = ratingsStore.getRating(docId)

        const buttons = scorerScale
          .map((val) => {
            const numVal = parseInt(val, 10)
            const isActive = currentRating === numVal
            const colorClass = isActive ? ` rating-color-${numVal}` : ""
            return `<button type="button"
              class="rating-btn${isActive ? " rating-btn-active" : ""}${colorClass}"
              data-action="click->doc-finder#rateDoc"
              data-finder-doc-idx="${idx}"
              data-rating-value="${numVal}">${numVal}</button>`
          })
          .join("")

        const clearBtn =
          currentRating !== null
            ? `<button type="button" class="rating-btn rating-btn-clear"
               data-action="click->doc-finder#unrateDoc"
               data-finder-doc-idx="${idx}">&times;</button>`
            : ""

        return `<div class="doc-row" data-finder-doc-id="${this._escapeAttr(docId)}">
          <div class="doc-rating">${buttons}${clearBtn}</div>
          <div class="doc-content">
            <div class="doc-title">${this._escapeHtml(String(doc.title))}</div>
            <div class="doc-id">ID: ${this._escapeHtml(docId)}</div>
          </div>
        </div>`
      })
      .join("")

    this._finderDocs = docs
    this._ensureRatingColorStyles()
    this.resultsContainerTarget.innerHTML = rows
  }

  async rateDoc(event) {
    const idx = parseInt(event.currentTarget.dataset.finderDocIdx, 10)
    const value = parseInt(event.currentTarget.dataset.ratingValue, 10)
    const doc = this._finderDocs[idx]
    if (!doc || !this._context) return

    const docId = String(doc.id)
    const { ratingsStore } = this._context

    try {
      const currentRating = ratingsStore.getRating(docId)
      if (currentRating === value) {
        await ratingsStore.unrate(docId)
      } else {
        await ratingsStore.rate(docId, value)
      }
      this._renderFinderResults(this._finderDocs)
      if (this._context.onRatingChanged) this._context.onRatingChanged()
    } catch (error) {
      console.error("Doc finder rate failed:", error)
    }
  }

  async unrateDoc(event) {
    const idx = parseInt(event.currentTarget.dataset.finderDocIdx, 10)
    const doc = this._finderDocs[idx]
    if (!doc || !this._context) return

    try {
      await this._context.ratingsStore.unrate(String(doc.id))
      this._renderFinderResults(this._finderDocs)
      if (this._context.onRatingChanged) this._context.onRatingChanged()
    } catch (error) {
      console.error("Doc finder unrate failed:", error)
    }
  }

  _ensureRatingColorStyles() {
    if (document.getElementById("rating-color-styles")) return
    if (!this._context) return
    const { scorerScale, colorMap } = this._context
    const rules = scorerScale
      .map((val) => {
        const numVal = parseInt(val, 10)
        const color = ratingColor(numVal, colorMap)
        return `.rating-color-${numVal} { background-color: ${color}; color: #fff; }`
      })
      .join("\n")
    const style = document.createElement("style")
    style.id = "rating-color-styles"
    style.textContent = rules
    document.head.appendChild(style)
  }

  _getIdField(tryConfig) {
    const fieldSpecStr = tryConfig.field_spec || ""
    const specs = fieldSpecStr.split(/[\s,+]+/).filter(Boolean)
    for (const spec of specs) {
      const parts = spec.split(":")
      if (parts.length > 1 && parts.includes("id")) return parts[parts.length - 1]
    }
    const engine = (tryConfig.search_engine || "solr").toLowerCase()
    return engine === "solr" || engine === "static" ? "id" : "_id"
  }

  async _fetchTryConfig() {
    if (this._tryConfigPromise) return this._tryConfigPromise

    const caseId = document.body.dataset.caseId
    const tryNumber = document.body.dataset.tryNumber
    this._tryConfigPromise = fetch(apiUrl(`api/cases/${caseId}/tries/${tryNumber}`), {
      headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load try config (${response.status})`)
        }
        return response.json()
      })
      .catch((err) => {
        this._tryConfigPromise = null
        throw err
      })
    return this._tryConfigPromise
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

import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"

export default class extends Controller {
  static targets = ["modal", "nameInput", "submitButton", "errorMessage", "progressMessage"]
  static outlets = ["query-row"]

  open(event) {
    event.preventDefault()

    // Default name: "Snapshot YYYY-MM-DD"
    const today = new Date().toISOString().slice(0, 10)
    this.nameInputTarget.value = `Snapshot ${today}`

    this.errorMessageTarget.classList.add("d-none")
    this.progressMessageTarget.classList.add("d-none")
    this.submitButtonTarget.disabled = false

    this._modal().show()

    // Focus the name input after the modal transition
    this.modalTarget.addEventListener("shown.bs.modal", () => this.nameInputTarget.select(), {
      once: true,
    })
  }

  close() {
    this._modal().hide()
  }

  async submit(event) {
    event.preventDefault()
    if (this._submitting) return
    this._submitting = true

    const name = this.nameInputTarget.value.trim()
    if (!name) {
      this._showError("Snapshot name is required.")
      this._submitting = false
      return
    }

    this.submitButtonTarget.disabled = true
    this.errorMessageTarget.classList.add("d-none")
    this.progressMessageTarget.classList.remove("d-none")

    try {
      const payload = this._buildPayload(name)

      // Warn if no queries have search results loaded
      const hasAnyDocs = Object.values(payload.snapshot.docs).some((d) => d.length > 0)
      if (!hasAnyDocs && this.hasQueryRowOutlet) {
        this.submitButtonTarget.disabled = false
        this.progressMessageTarget.classList.add("d-none")
        this._showError(
          'No search results loaded. Click "Run All Searches" first, then take the snapshot.',
        )
        this._submitting = false
        return
      }
      const caseId = document.body.dataset.caseId

      const response = await fetch(apiUrl(`api/cases/${caseId}/snapshots`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Server returned ${response.status}: ${text}`)
      }

      this.close()
      showFlash("Snapshot created successfully.")
    } catch (error) {
      console.error("Snapshot creation failed:", error)
      this._showError(error.message)
    } finally {
      this._submitting = false
      this.submitButtonTarget.disabled = false
      this.progressMessageTarget.classList.add("d-none")
    }
  }

  // Private

  _buildPayload(name) {
    const docs = {}
    const queries = {}

    this.queryRowOutlets.forEach((row) => {
      const queryId = row.queryIdValue
      const searchDocs = row.lastSearchDocs || []
      const numFound = row.lastNumFound || 0
      const score = typeof row.currentScore === "number" ? row.currentScore : null
      const ratingsStore = row.ratingsStore

      queries[queryId] = {
        score: score,
        all_rated: this._allRated(searchDocs, ratingsStore),
        number_of_results: numFound,
      }

      docs[queryId] = searchDocs.map((doc) => {
        const docPayload = {
          id: String(doc.id),
          // explain data is not yet available from search_executor (Phase 4/5)
          explain: doc.explain || "",
          rated_only: false,
          fields: this._extractFields(doc),
        }
        return docPayload
      })

      // Append rated docs not in search results
      if (ratingsStore) {
        const searchDocIds = new Set(searchDocs.map((d) => String(d.id)))
        const allRatings = ratingsStore.ratings || {}

        Object.keys(allRatings).forEach((docId) => {
          if (!searchDocIds.has(docId)) {
            docs[queryId].push({
              id: docId,
              explain: "",
              rated_only: true,
              fields: {},
            })
          }
        })
      }
    })

    return { snapshot: { name, docs, queries } }
  }

  _allRated(searchDocs, ratingsStore) {
    if (!ratingsStore || searchDocs.length === 0) return false
    return searchDocs.every((doc) => ratingsStore.getRating(String(doc.id)) !== null)
  }

  _extractFields(doc) {
    // Prefer _source (raw fields from search engine) when available — it
    // preserves original field names rather than the display-normalized
    // "title" / "subs" keys that normalizeDoc produces.
    if (doc._source && typeof doc._source === "object") {
      const fields = {}
      for (const [key, value] of Object.entries(doc._source)) {
        if (value !== undefined && value !== null) {
          fields[key] = this._fieldToString(value)
        }
      }
      return fields
    }

    // Fallback for docs without _source (e.g. rated-only stubs)
    const fields = {}
    if (doc.subs) {
      Object.entries(doc.subs).forEach(([key, value]) => {
        fields[key] = this._fieldToString(value)
      })
    }
    return fields
  }

  _fieldToString(value) {
    if (Array.isArray(value)) return value.join(", ")
    if (typeof value === "object" && value !== null) return JSON.stringify(value)
    return String(value)
  }

  _showError(message) {
    this.errorMessageTarget.textContent = message
    this.errorMessageTarget.classList.remove("d-none")
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

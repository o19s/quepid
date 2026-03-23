import { Controller } from "@hotwired/stimulus"
import { apiUrl } from "modules/api_url"

export default class extends Controller {
  static values = { caseId: Number }
  static targets = [
    "modal",
    "ratingsFileInput",
    "clearQueriesCheckbox",
    "informationNeedsFileInput",
    "createQueriesCheckbox",
    "snapshotFileInput",
    "alertArea",
    "submitButton",
    "submitText",
    "spinner",
    "warningArea",
    "warningText"
  ]

  connect() {
    this._activeTab = null
    this._activeFormat = null
  }

  open() {
    this._reset()
    this._modal().show()
  }

  selectTab(event) {
    // Track which tab is active: "ratings", "information_needs", "snapshots"
    this._activeTab = event.currentTarget.dataset.importTab
    this._hideAlert()
    this._updateSubmitState()
  }

  selectRatingsFormat(event) {
    // Track which ratings format: "csv", "rre", "ltr"
    this._activeFormat = event.currentTarget.value
    // Show the appropriate file input
    this.ratingsFileInputTargets.forEach(el => {
      el.closest(".mb-3").classList.toggle("d-none", el.dataset.format !== this._activeFormat)
    })
    this._updateSubmitState()
  }

  fileSelected() {
    this._hideAlert()
    this._updateSubmitState()
  }

  async submit(event) {
    event.preventDefault()
    this._setLoading(true)
    this._hideAlert()

    try {
      if (this._activeTab === "ratings") {
        await this._importRatings()
      } else if (this._activeTab === "information_needs") {
        await this._importInformationNeeds()
      } else if (this._activeTab === "snapshots") {
        await this._importSnapshots()
      }
    } catch (error) {
      console.error("Import error:", error)
      this._showAlert("An error occurred during import. Please try again.", "danger")
      this._setLoading(false)
    }
  }

  async _importRatings() {
    const fileInput = this.ratingsFileInputTargets.find(el => el.dataset.format === this._activeFormat)
    const file = fileInput?.files[0]
    if (!file) {
      this._showAlert("Please select a file.", "warning")
      this._setLoading(false)
      return
    }

    const content = await this._readFile(file)
    const clearQueries = this.clearQueriesCheckboxTarget.checked
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")

    let body, contentType

    if (this._activeFormat === "csv") {
      // Parse CSV and validate headers
      const lines = content.split("\n")
      const headers = lines[0].trim()
      if (headers !== "query,docid,rating") {
        this._showAlert("Headers mismatch! Expected: query,docid,rating", "danger")
        this._setLoading(false)
        return
      }
      // Parse CSV into ratings array
      const ratings = []
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        // Simple CSV parse (handles quoted fields with commas)
        const parts = this._parseCSVLine(line)
        ratings.push({ query_text: parts[0], doc_id: parts[1], rating: parts[2] || null })
      }
      body = JSON.stringify({ ratings, file_format: "hash", clear_queries: clearQueries })
      contentType = "application/json"
    } else if (this._activeFormat === "rre") {
      const rreJson = content
      body = JSON.stringify({ rre_json: rreJson, file_format: "rre", clear_queries: clearQueries })
      contentType = "application/json"
    } else if (this._activeFormat === "ltr") {
      body = JSON.stringify({ ltr_text: content, file_format: "ltr", clear_queries: clearQueries })
      contentType = "application/json"
    }

    const url = apiUrl(`api/import/ratings?case_id=${this.caseIdValue}`)
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": contentType, "X-CSRF-Token": csrfToken },
      body
    })

    if (response.ok) {
      this._showAlert("Ratings imported successfully! Reloading...", "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      const result = await response.json().catch(() => ({}))
      this._showAlert(result.message || "Failed to import ratings.", "danger")
      this._setLoading(false)
    }
  }

  async _importInformationNeeds() {
    const file = this.informationNeedsFileInputTarget.files[0]
    if (!file) {
      this._showAlert("Please select a file.", "warning")
      this._setLoading(false)
      return
    }

    const content = await this._readFile(file)
    // Validate headers
    const headers = content.split("\n")[0].trim()
    if (headers !== "query,information_need") {
      this._showAlert("Headers mismatch! Expected: query,information_need", "danger")
      this._setLoading(false)
      return
    }

    const createQueries = this.createQueriesCheckboxTarget.checked
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const url = apiUrl(`api/import/queries/information_needs?case_id=${this.caseIdValue}`)

    // The API expects raw CSV text and a create_queries flag
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ csv_text: content, create_queries: createQueries })
    })

    if (response.ok) {
      this._showAlert("Information needs imported successfully! Reloading...", "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      const result = await response.json().catch(() => ({}))
      this._showAlert(result.message || "Failed to import information needs.", "danger")
      this._setLoading(false)
    }
  }

  async _importSnapshots() {
    const file = this.snapshotFileInputTarget.files[0]
    if (!file) {
      this._showAlert("Please select a file.", "warning")
      this._setLoading(false)
      return
    }

    const content = await this._readFile(file)
    // Validate headers
    const firstLine = content.split("\n")[0].trim()
    const requiredHeaders = ["Snapshot Name", "Snapshot Time", "Case ID", "Query Text", "Doc ID", "Doc Position"]
    const hasHeaders = requiredHeaders.every(h => firstLine.includes(h))
    if (!hasHeaders) {
      this._showAlert(`Headers mismatch! Required: ${requiredHeaders.join(",")}`, "danger")
      this._setLoading(false)
      return
    }

    // Parse CSV into structured format grouped by snapshot name, then by query text
    const lines = content.split("\n")
    const snapshots = {}

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = this._parseCSVLine(line)
      const snapshotName = parts[0]
      const snapshotTime = parts[1]
      const queryText = parts[3]

      if (!snapshots[snapshotName]) {
        snapshots[snapshotName] = { name: snapshotName, created_at: snapshotTime, queries: {} }
      }

      if (!snapshots[snapshotName].queries[queryText]) {
        snapshots[snapshotName].queries[queryText] = { docs: [] }
      }

      snapshots[snapshotName].queries[queryText].docs.push({
        id: parts[4],
        position: parts[5],
      })
    }

    // API expects queries as a hash keyed by query text (SnapshotManager.import_queries uses .keys)
    const snapshotPayloads = Object.values(snapshots).map(snap => ({
      name: snap.name,
      created_at: snap.created_at,
      queries: snap.queries,
    }))

    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content")
    const url = apiUrl(`api/cases/${this.caseIdValue}/snapshots/imports`)

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ snapshots: snapshotPayloads })
    })

    if (response.ok) {
      this._showAlert("Snapshots imported successfully! Reloading...", "success")
      setTimeout(() => window.location.reload(), 1500)
    } else {
      const result = await response.json().catch(() => ({}))
      this._showAlert(result.message || "Failed to import snapshots.", "danger")
      this._setLoading(false)
    }
  }

  // Simple CSV line parser that handles quoted fields
  _parseCSVLine(line) {
    const result = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }
    result.push(current.trim())
    return result
  }

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(e)
      reader.readAsText(file)
    })
  }

  _updateSubmitState() {
    if (!this.hasSubmitButtonTarget) return
    const hasFile = this._activeTab === "ratings"
      ? this.ratingsFileInputTargets.some(el => el.dataset.format === this._activeFormat && el.files.length > 0)
      : this._activeTab === "information_needs"
        ? this.informationNeedsFileInputTarget.files.length > 0
        : this._activeTab === "snapshots"
          ? this.snapshotFileInputTarget.files.length > 0
          : false
    this.submitButtonTarget.disabled = !this._activeTab || !hasFile

    // Show contextual warning when a file is ready to import
    if (this.hasWarningAreaTarget) {
      const showWarning = hasFile && this._activeTab
      this.warningAreaTarget.classList.toggle("d-none", !showWarning)
      if (showWarning && this.hasWarningTextTarget) {
        const messages = {
          ratings: "This operation WILL override your existing ratings. Proceed with caution!",
          information_needs: "This operation WILL override your existing information needs. Proceed with caution!",
          snapshots: "This operation WILL replace any snapshots with the same Snapshot Name in the CSV.",
        }
        this.warningTextTarget.textContent = messages[this._activeTab] || ""
      }
    }
  }

  _setLoading(loading) {
    this.submitButtonTarget.disabled = loading
    this.submitTextTarget.textContent = loading ? "Importing..." : "Import"
    this.spinnerTarget.classList.toggle("d-none", !loading)
  }

  _showAlert(message, type) {
    this.alertAreaTarget.textContent = message
    this.alertAreaTarget.className = `alert alert-${type}`
    this.alertAreaTarget.classList.remove("d-none")
  }

  _hideAlert() {
    this.alertAreaTarget.classList.add("d-none")
  }

  _reset() {
    this._activeTab = "ratings"
    this._activeFormat = null
    this._hideAlert()
    // Hide warning from previous session
    if (this.hasWarningAreaTarget) this.warningAreaTarget.classList.add("d-none")
    // Reset all file inputs
    this.ratingsFileInputTargets.forEach(el => {
      el.value = ""
      el.closest(".mb-3")?.classList.add("d-none")
    })
    if (this.hasInformationNeedsFileInputTarget) this.informationNeedsFileInputTarget.value = ""
    if (this.hasSnapshotFileInputTarget) this.snapshotFileInputTarget.value = ""
    if (this.hasClearQueriesCheckboxTarget) this.clearQueriesCheckboxTarget.checked = false
    if (this.hasCreateQueriesCheckboxTarget) this.createQueriesCheckboxTarget.checked = false
    if (this.hasSubmitButtonTarget) this.submitButtonTarget.disabled = true
    // Reset Bootstrap tab to Ratings (first tab)
    const firstTab = this.modalTarget.querySelector('.nav-link[data-import-tab="ratings"]')
    if (firstTab) {
      // Deactivate all tabs/panes, then activate the first
      this.modalTarget.querySelectorAll(".nav-link").forEach(t => t.classList.remove("active"))
      this.modalTarget.querySelectorAll(".tab-pane").forEach(p => {
        p.classList.remove("show", "active")
      })
      firstTab.classList.add("active")
      const ratingsPane = this.modalTarget.querySelector("#import-ratings-tab")
      if (ratingsPane) ratingsPane.classList.add("show", "active")
    }
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

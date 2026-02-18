import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import {
  buildCaseImportInformationNeedsUrl,
  buildCaseImportRatingsUrl,
  getQuepidRootUrl
} from "utils/quepid_root"

// Handles the "Import" modal: Ratings (CSV, RRE, LTR) and Information Needs (CSV).
// Replaces the Angular importRatings component. Uses apiFetch and URL helpers.
export default class extends Controller {
  static values = { caseId: Number }
  static targets = [
    "modal", "trigger", "clearQueries", "createQueries",
    "formatRadio", "csvPane", "rrePane", "ltrPane", "csvText", "rreFile", "ltrFile",
    "ratingsError", "infoNeedsText", "infoNeedsError", "submitBtn"
  ]

  connect() {
    this._modal = null
    this._rreContent = null
    this._ltrContent = null
  }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  open(event) {
    event.preventDefault()
    if (!this._modal) {
      const el = this.modalTarget
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el)
    }
    this._rreContent = null
    this._ltrContent = null
    this._hideError(this.ratingsErrorTarget)
    this._hideError(this.infoNeedsErrorTarget)
    if (this.hasCsvTextTarget) this.csvTextTarget.value = ""
    if (this.hasInfoNeedsTextTarget) this.infoNeedsTextTarget.value = ""
    if (this.hasRreFileTarget) this.rreFileTarget.value = ""
    if (this.hasLtrFileTarget) this.ltrFileTarget.value = ""
    this.formatRadioTargets.forEach((r) => { r.checked = false })
    this._showFormatPane(null)
    this._modal.show()
  }

  formatChanged() {
    const selected = this.formatRadioTargets.find((r) => r.checked)
    this._showFormatPane(selected ? selected.value : null)
  }

  _showFormatPane(format) {
    if (this.hasCsvPaneTarget) this.csvPaneTarget.classList.toggle("d-none", format !== "csv")
    if (this.hasRrePaneTarget) this.rrePaneTarget.classList.toggle("d-none", format !== "rre")
    if (this.hasLtrPaneTarget) this.ltrPaneTarget.classList.toggle("d-none", format !== "ltr")
  }

  rreFilePicked(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      this._rreContent = e.target?.result ?? null
    }
    reader.readAsText(file)
  }

  ltrFilePicked(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      this._ltrContent = e.target?.result ?? null
    }
    reader.readAsText(file)
  }

  _hideError(target) {
    if (!target) return
    target.classList.add("d-none")
    target.textContent = ""
  }

  _showError(target, message) {
    if (!target) return
    target.textContent = message
    target.classList.remove("d-none")
  }

  async submit(event) {
    event.preventDefault()
    const activeTab = this.modalTarget.querySelector(".nav-link.active")?.id
    const isInfoNeeds = activeTab === "tab-info-needs"

    if (isInfoNeeds) {
      const csvText = this.hasInfoNeedsTextTarget ? this.infoNeedsTextTarget.value.trim() : ""
      if (!csvText) {
        this._showError(this.infoNeedsErrorTarget, "Please paste or upload CSV content (query,information_need).")
        return
      }
      this._hideError(this.infoNeedsErrorTarget)
      const createQueries = this.hasCreateQueriesTarget && this.createQueriesTarget.checked
      const url = buildCaseImportInformationNeedsUrl(this.rootUrl, this.caseIdValue)
      this.submitBtnTarget.disabled = true
      try {
        const body = new FormData()
        body.append("csv_text", csvText)
        body.append("create_queries", createQueries)

        const res = await apiFetch(url, {
          method: "POST",
          headers: { Accept: "text/vnd.turbo-stream.html" },
          body
        })
        const html = await res.text()
        if (html?.trim() && res.headers.get("Content-Type")?.includes("turbo-stream")) {
          window.Turbo?.renderStreamMessage?.(html)
        }
        if (res.ok) {
          if (window.flash) window.flash.success = "Successfully imported information needs from CSV."
          this._modal?.hide()
        } else {
          this._showError(this.infoNeedsErrorTarget, "Unable to import information needs.")
        }
      } catch (err) {
        this._showError(this.infoNeedsErrorTarget, err.message || "Unable to import information needs.")
      } finally {
        this.submitBtnTarget.disabled = false
      }
      return
    }

    const format = this.formatRadioTargets.find((r) => r.checked)?.value
    if (!format) {
      this._showError(this.ratingsErrorTarget, "Please select a format (CSV, RRE, or LTR) and provide content.")
      return
    }
    this._hideError(this.ratingsErrorTarget)
    const clearQueries = this.hasClearQueriesTarget && this.clearQueriesTarget.checked

    let payload = { file_format: format, clear_queries: clearQueries }
    if (format === "csv") {
      const raw = this.hasCsvTextTarget ? this.csvTextTarget.value.trim() : ""
      if (!raw) {
        this._showError(this.ratingsErrorTarget, "Please paste CSV content or select a file.")
        return
      }
      const ratings = this._parseRatingsCsv(raw)
      if (!ratings.length) {
        this._showError(this.ratingsErrorTarget, "Could not parse CSV. Expected headers: query,docid,rating")
        return
      }
      payload.ratings = ratings
    } else if (format === "rre") {
      const content = this._rreContent || (this.hasRreFileTarget && this.rreFileTarget.files?.[0] ? await this._readFile(this.rreFileTarget.files[0]) : null)
      if (!content) {
        this._showError(this.ratingsErrorTarget, "Please select an RRE JSON file.")
        return
      }
      try {
        JSON.parse(content)
      } catch (_e) {
        this._showError(this.ratingsErrorTarget, "Invalid JSON in RRE file.")
        return
      }
      payload.rre_json = content
    } else if (format === "ltr") {
      const content = this._ltrContent || (this.hasLtrFileTarget && this.ltrFileTarget.files?.[0] ? await this._readFile(this.ltrFileTarget.files[0]) : null)
      if (!content) {
        this._showError(this.ratingsErrorTarget, "Please select an LTR text file.")
        return
      }
      payload.ltr_text = content
    }

    const url = buildCaseImportRatingsUrl(this.rootUrl, this.caseIdValue)
    this.submitBtnTarget.disabled = true
    try {
      const body = new FormData()
      body.append("file_format", format)
      body.append("clear_queries", clearQueries)
      if (payload.ratings) {
        body.append("ratings", JSON.stringify(payload.ratings))
      }
      if (payload.rre_json) body.append("rre_json", payload.rre_json)
      if (payload.ltr_text) body.append("ltr_text", payload.ltr_text)

      const res = await apiFetch(url, {
        method: "POST",
        headers: { Accept: "text/vnd.turbo-stream.html" },
        body
      })
      const html = await res.text()
      if (html?.trim() && res.headers.get("Content-Type")?.includes("turbo-stream")) {
        window.Turbo?.renderStreamMessage?.(html)
      }
      if (res.ok) {
        if (window.flash) window.flash.success = `Successfully imported ratings from ${format.toUpperCase()}.`
        this._modal?.hide()
      } else {
        this._showError(this.ratingsErrorTarget, "Unable to import ratings.")
      }
    } catch (err) {
      this._showError(this.ratingsErrorTarget, err.message || "Unable to import ratings.")
    } finally {
      this.submitBtnTarget.disabled = false
    }
  }

  _readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result ?? null)
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsText(file)
    })
  }

  _parseRatingsCsv(raw) {
    const lines = raw.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) return []
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
    const qi = header.indexOf("query")
    const di = header.indexOf("docid")
    const ri = header.indexOf("rating")
    if (qi < 0 || di < 0 || ri < 0) return []
    const ratings = []
    for (let i = 1; i < lines.length; i++) {
      const parts = this._splitCsvLine(lines[i])
      ratings.push({
        query_text: (parts[qi] || "").trim(),
        doc_id: (parts[di] ?? "").toString().trim() || null,
        rating: (parts[ri] ?? "").toString().trim() || null
      })
    }
    return ratings
  }

  _splitCsvLine(line) {
    const out = []
    let cur = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') {
        inQuotes = !inQuotes
      } else if ((c === "," && !inQuotes) || c === "\n") {
        out.push(cur)
        cur = ""
      } else {
        cur += c
      }
    }
    out.push(cur)
    return out
  }
}

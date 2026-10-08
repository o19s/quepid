import { CORE_EVENTS } from "utils/core_events"
import { serverMessage } from "utils/error_message"
import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { postJson } from "api/json"
import { HttpError } from "api/http_error"
import { caseNameFromHeader } from "utils/case_header"
import coreFlash from "utils/core_flash"
import { parseCsv } from "utils/csv"
import { buildSnapshotImportGroups } from "utils/snapshot_import"

const REQUIRED_HEADERS = {
  csv: ["query", "docid", "rating"],
  information_needs: ["query", "information_need"],
  snapshots: ["Snapshot Name", "Snapshot Time", "Case ID", "Query Text", "Doc ID", "Doc Position"]
}

/** Core case import modal. Keeps the established core import formats and wording. */
export default class extends CoreModalControllerBase {
  static targets = [
    "title", "alert", "content", "warning", "warningText", "loading", "importButton",
    "clearQueries", "createQueries", "csvFile", "rreFile", "ltrFile",
    "informationNeedsFile", "snapshotsFile", "csvPreview", "informationNeedsPreview",
    "snapshotsPreview", "file", "format"
  ]

  static values = {
    caseId: Number,
    ratingsUrl: String,
    informationNeedsUrl: String,
    snapshotsUrl: String
  }

  initialize() {
    this.selectedType = ""
    this.files = {}
    this.contents = {}
    this.errors = {}
    this.busy = false
    if (this.hasLoadingTarget) this.loadingTarget.classList.add("d-none")
  }

  openFor() {
    this.reset()
    if (this.hasTitleTarget) this.titleTarget.textContent = `Import into Case: ${caseNameFromHeader()}`
  }

  reset() {
    this.selectedType = ""
    this.files = {}
    this.contents = {}
    this.errors = {}
    this.contentTargets.forEach((target) => { target.textContent = "" })
    this.setError(this.hasAlertTarget ? this.alertTarget : null, "")
    if (this.hasClearQueriesTarget) this.clearQueriesTarget.checked = false
    if (this.hasCreateQueriesTarget) this.createQueriesTarget.checked = false
    this.fileTargets.forEach((input) => { input.value = "" })
    this.formatTargets.forEach((input) => { input.checked = false })
    this.setBusy(false) // also hides the "Importing…" row left over from a previous successful import
  }

  selectType(event) {
    this.selectedType = event.target.value
    this.refreshUi()
  }

  clearSelection() {
    this.selectedType = ""
    this.refreshUi()
  }

  async fileSelected(event) {
    const type = event.currentTarget.dataset.importType
    const file = event.currentTarget.files[0]
    if (!file) return

    // Choosing a file selects its import type, even if reading it fails, so the error shows.
    this.selectedType = type
    try {
      const content = await file.text()
      this.files[type] = file
      this.contents[type] = content
      this.errors[type] = this.validate(type, content)
      this.renderPreview(type, content, event.currentTarget)
      this.refreshUi()
    } catch (error) {
      this.errors[type] = "Unable to read this file. Please try again."
      this.refreshUi()
    }
  }

  async submit(event) {
    event.preventDefault()
    if (this.busy || !this.canImport()) return

    this.setBusy(true)
    try {
      if (this.selectedType === "snapshots") await this.importSnapshots()
      else await this.importSimple()

      this.dispatchReload()
      this.flash("success", this.successMessage())
      this.hide()
    } catch (error) {
      this.flash("error", this.errorMessage(error))
      this.setBusy(false)
    }
  }

  async importSimple() {
    const content = this.contents[this.selectedType]
    let body
    let url
    if (this.selectedType === "csv") {
      body = {
        ratings: this.parseCsv(content).rows.map((row) => ({
          query_text: row.query,
          doc_id: row.docid,
          rating: row.rating
        })),
        case_id: this.caseIdValue,
        clear_queries: this.hasClearQueriesTarget && this.clearQueriesTarget.checked
      }
      url = `${this.ratingsUrlValue}?file_format=hash`
    } else if (this.selectedType === "rre") {
      body = { rre_json: content, case_id: this.caseIdValue, clear_queries: this.clearQueries() }
      url = `${this.ratingsUrlValue}?file_format=rre`
    } else if (this.selectedType === "ltr") {
      body = { ltr_text: content, case_id: this.caseIdValue, clear_queries: this.clearQueries() }
      url = `${this.ratingsUrlValue}?file_format=ltr`
    } else {
      body = { csv_text: content, case_id: this.caseIdValue, create_queries: this.hasCreateQueriesTarget && this.createQueriesTarget.checked }
      url = this.informationNeedsUrlValue
    }
    await this.post(url, body)
  }

  async importSnapshots() {
    const { rows } = this.parseCsv(this.contents.snapshots)
    const groups = buildSnapshotImportGroups(rows, this.caseIdValue)
    for (const snapshot of Object.values(groups[this.caseIdValue]?.snapshots || {})) {
      await this.post(this.snapshotsUrlValue, { snapshots: [snapshot] })
    }
  }

  async post(url, body) {
    try {
      return await postJson(url, body)
    } catch (error) {
      if (error instanceof HttpError) {
        error.message = error.data?.message || serverMessage(error, error.statusText || "Import failed.")
      }
      throw error
    }
  }

  validate(type, content) {
    if (type === "rre") {
      try { JSON.parse(content) } catch (_) { return "Invalid RRE JSON file." }
      return ""
    }
    if (type === "ltr") {
      return content.trim() ? "" : "The selected file is empty."
    }
    if (!content.trim()) return "The selected file is empty."
    const { headers, rows, errors } = this.parseCsv(content)
    const missing = REQUIRED_HEADERS[type].filter((header) => !headers.includes(header))
    if (missing.length) return `Headers mismatch! Please make sure you have the correct headers: ${REQUIRED_HEADERS[type].join(",")}`
    if (errors.length) return `CSV format error: ${errors.join(" ")}`
    if (rows.length === 0) return "The selected file has no data rows."
    return ""
  }

  parseCsv(content) {
    return parseCsv(content)
  }

  renderPreview(type, content, sourceInput) {
    const target = { csv: this.csvPreviewTarget, information_needs: this.informationNeedsPreviewTarget, snapshots: this.snapshotsPreviewTarget }[type]
      || sourceInput?.parentElement?.querySelector("[data-import-ratings-core-target='content']")
    if (target) target.textContent = content
  }

  refreshUi() {
    const activeError = this.errors[this.selectedType]
    this.setError(this.hasAlertTarget ? this.alertTarget : null, activeError || "")
    this.toggleVisible("warning", this.selectedType)
    if (this.hasWarningTextTarget && this.selectedType) this.warningTextTarget.textContent = this.warningMessage()
    if (this.hasImportButtonTarget) this.importButtonTarget.disabled = !this.canImport() || this.busy
  }

  warningMessage() {
    if (this.selectedType === "snapshots") return "This operation WILL replace any snapshots you have created that have the same Snapshot Name in the csv."
    if (this.selectedType === "information_needs") return "This operation WILL override your existing information needs. Proceed with caution!"
    return "This operation WILL override your existing ratings. Proceed with caution!"
  }

  canImport() { return Boolean(this.selectedType && this.contents[this.selectedType] && !this.errors[this.selectedType]) }
  clearQueries() { return this.hasClearQueriesTarget && this.clearQueriesTarget.checked }
  successMessage() {
    return this.selectedType === "snapshots" ? "Snapshots imported successfully!" : this.selectedType === "information_needs" ? "Successfully imported information needs from CSV." : `Successfully imported ${this.selectedType === "csv" ? "ratings from CSV" : `ratings from ${this.selectedType.toUpperCase()}`}.`
  }
  errorMessage(error) { return error.message || "Import failed. Please try again." }
  dispatchReload() { document.dispatchEvent(new CustomEvent(CORE_EVENTS.IMPORTS_QUERIES_NEED_RELOAD, { detail: { caseId: this.caseIdValue } })) }
  flash(type, message) { coreFlash.show(type, message) }
  setBusy(busy) {
    this.busy = busy
    this.setLoading(busy)
    this.refreshUi()
  }
  setError(target, message) { if (!target) return; target.textContent = message; target.classList.toggle("d-none", !message) }
}

import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { hideBsModal, showBsModal, getOrCreateBsModal } from "utils/bs_modal"
import { caseNameFromHeader } from "utils/case_header"

const REQUIRED_HEADERS = {
  csv: ["query", "docid", "rating"],
  information_needs: ["query", "information_need"],
  snapshots: ["Snapshot Name", "Snapshot Time", "Case ID", "Query Text", "Doc ID", "Doc Position"]
}

/** Core case import modal. Keeps the Angular core import formats and wording. */
export default class extends ModalTriggerControllerBase {
  static targets = [
    "title", "alert", "content", "warning", "loading", "importButton",
    "clearQueries", "createQueries", "csvFile", "rreFile", "ltrFile",
    "informationNeedsFile", "snapshotsFile", "csvPreview", "informationNeedsPreview",
    "snapshotsPreview"
  ]

  static values = {
    caseId: Number,
    ratingsUrl: String,
    informationNeedsUrl: String,
    snapshotsUrl: String
  }

  get modalElementId() {
    return "importRatingsModal"
  }

  initialize() {
    this.selectedType = ""
    this.files = {}
    this.contents = {}
    this.errors = {}
    this.busy = false
    if (this.hasLoadingTarget) this.loadingTarget.classList.add("d-none")
  }

  openAsRoot(event) {
    event?.preventDefault?.()
    this.reset()
    if (this.hasTitleTarget) this.titleTarget.textContent = `Import into Case: ${caseNameFromHeader()}`
    const modal = document.getElementById(this.modalElementId)
    showBsModal(getOrCreateBsModal(modal))
  }

  reset() {
    this.selectedType = ""
    this.files = {}
    this.contents = {}
    this.errors = {}
    this.busy = false
    this.contentTargets.forEach((target) => { target.textContent = "" })
    this.setError(this.hasAlertTarget ? this.alertTarget : null, "")
    if (this.hasClearQueriesTarget) this.clearQueriesTarget.checked = false
    if (this.hasCreateQueriesTarget) this.createQueriesTarget.checked = false
    this.element.querySelectorAll("input[type=file]").forEach((input) => { input.value = "" })
    this.element.querySelectorAll("input[type=radio]").forEach((input) => { input.checked = false })
    this.refreshUi()
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

    try {
      const content = await this.readFile(file)
      this.selectedType = type
      this.files[type] = file
      this.contents[type] = content
      this.errors[type] = this.validate(type, content)
      this.renderPreview(type, content)
      this.refreshUi()
    } catch (error) {
      this.errors[type] = "Unable to read this file. Please try again."
      this.refreshUi()
    }
  }

  async submit(event) {
    event.preventDefault()
    if (!this.canImport()) return

    this.setBusy(true)
    try {
      if (this.selectedType === "snapshots") await this.importSnapshots()
      else await this.importSimple()

      this.dispatchReload()
      this.flash("success", this.successMessage())
      hideBsModal(getOrCreateBsModal(document.getElementById(this.modalElementId)))
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
    const snapshots = new Map()
    rows.forEach((row) => {
      const key = row["Snapshot Name"]
      if (!snapshots.has(key)) snapshots.set(key, { name: key, created_at: row["Snapshot Time"], queries: {} })
      const snapshot = snapshots.get(key)
      snapshot.queries[row["Query Text"]] ||= { docs: [] }
      const reserved = REQUIRED_HEADERS.snapshots
      const fields = Object.fromEntries(Object.entries(row).filter(([name]) => !reserved.includes(name)))
      snapshot.queries[row["Query Text"]].docs.push({ id: row["Doc ID"], position: row["Doc Position"], fields })
    })

    for (const snapshot of snapshots.values()) {
      await this.post(this.snapshotsUrlValue, { snapshots: [snapshot] })
    }
  }

  async post(url, body) {
    const response = await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body)
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || data.error || response.statusText || "Import failed.")
    return data
  }

  validate(type, content) {
    if (type === "rre") {
      try { JSON.parse(content) } catch (_) { return "Invalid RRE JSON file." }
      return ""
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
    const parsedRows = []
    const errors = []
    let row = []
    let value = ""
    let quoted = false
    let line = 1
    let rowStartLine = 1

    const pushRow = () => {
      if (row.some(Boolean) || row.length) parsedRows.push({ values: row, line: rowStartLine })
      row = []
      value = ""
      rowStartLine = line + 1
    }

    for (let index = 0; index < content.length; index += 1) {
      const char = content[index]
      if (char === '"') {
        if (quoted && content[index + 1] === '"') { value += '"'; index += 1 }
        else quoted = !quoted
      } else if (char === "," && !quoted) { row.push(value.trim()); value = "" }
      else if ((char === "\n" || char === "\r") && !quoted) {
        if (char === "\r" && content[index + 1] === "\n") index += 1
        row.push(value.trim())
        pushRow()
        line += 1
      } else value += char
    }
    if (quoted) {
      errors.push(`line ${rowStartLine}: unclosed quote.`)
      row.push(value.trim())
      pushRow()
    } else if (value || row.length) { row.push(value.trim()); pushRow() }

    const headerRow = parsedRows.shift()
    const headers = headerRow?.values || []
    const rows = parsedRows.map(({ values, line: rowLine }) => {
      if (values.length !== headers.length) {
        errors.push(`line ${rowLine}: expected ${headers.length} columns but found ${values.length}.`)
      }
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
    })
    return { headers, rows, errors }
  }

  renderPreview(type, content) {
    const target = { csv: this.csvPreviewTarget, information_needs: this.informationNeedsPreviewTarget, snapshots: this.snapshotsPreviewTarget }[type]
    if (target) target.textContent = content
  }

  refreshUi() {
    const activeError = this.errors[this.selectedType]
    this.setError(this.hasAlertTarget ? this.alertTarget : null, activeError || "")
    if (this.hasWarningTarget) this.warningTarget.classList.toggle("d-none", !this.selectedType)
    if (this.hasImportButtonTarget) this.importButtonTarget.disabled = !this.canImport() || this.busy
  }

  canImport() { return Boolean(this.selectedType && this.contents[this.selectedType] && !this.errors[this.selectedType]) }
  clearQueries() { return this.hasClearQueriesTarget && this.clearQueriesTarget.checked }
  successMessage() {
    return this.selectedType === "snapshots" ? "Snapshots imported successfully!" : this.selectedType === "information_needs" ? "Successfully imported information needs from CSV." : `Successfully imported ${this.selectedType === "csv" ? "ratings from CSV" : `ratings from ${this.selectedType.toUpperCase()}`}.`
  }
  errorMessage(error) { return error.message || "Import failed. Please try again." }
  dispatchReload() { document.dispatchEvent(new CustomEvent("imports:queries-need-reload", { detail: { caseId: this.caseIdValue } })) }
  flash(type, message) { window.quepidDom?.flash?.show(type, message) }
  setBusy(busy) { this.busy = busy; if (this.hasLoadingTarget) this.loadingTarget.classList.toggle("d-none", !busy); this.refreshUi() }
  setError(target, message) { if (!target) return; target.textContent = message; target.classList.toggle("d-none", !message) }
  readFile(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsText(file) }) }
}

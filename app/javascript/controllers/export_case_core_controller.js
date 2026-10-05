import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { apiFetch } from "api/fetch"
import { getJson } from "api/json"
import { HttpError } from "api/http_error"
import { showFlash } from "utils/flash"
import { buildDetailedCaseCsv, buildGeneralCaseCsv, buildSnapshotCsv, formatDownloadFileName } from "utils/case_csv"
import { formatShortDate } from "utils/date_format"
import { downloadBlob } from "utils/download_file"
import { caseNameFromHeader } from "utils/case_header"
import { getCoreStores } from "utils/core_store_access"
import { caseRuntime } from "utils/case_runtime"
import { isSameId } from "utils/record_identity"

const CASE_ID_PLACEHOLDER = "__CASE_ID__"
const SNAPSHOT_ID_PLACEHOLDER = "__SNAPSHOT_ID__"
const FORMAT_PLACEHOLDER = "__FORMAT__"

function httpErrorFor(response) {
  return new HttpError({ status: response.status, statusText: response.statusText })
}

/**
 * Export-case modal for the core case toolbar — one radio-button
 * choice of export format, then an immediate download (the modal always
 * closes on "Export".
 *
 * Every format is reconstructed from persisted API data plus the live
 * document read model for "detailed" exports.
 *
 * The toolbar trigger carries the case id and whether detailed export is supported.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "title",
    "format",
    "submitButton",
    "detailedRadio",
    "detailedWarning",
    "snapshotRadio",
    "snapshotSelect",
    "basicRadio",
    "basicSnapshotSelect",
    "apiSnapshotSelect",
    "apiSnapshotLink",
    "apiSnapshotWrapper",
    "snapshotsError",
    "caseLink",
    "queriesLink",
    "annotationsLink",
    "scoresLink",
    "ratingsLink",
    "quepidPeekLink"
  ]

  static values = {
    snapshotsIndexUrlTemplate: String,
    snapshotShowUrlTemplate: String,
    caseUrlTemplate: String,
    queriesUrlTemplate: String,
    annotationsUrlTemplate: String,
    scoresUrlTemplate: String,
    ratingsExportUrlTemplate: String,
    informationNeedUrlTemplate: String,
    quepidExportUrlTemplate: String
  }

  openFor(btn) {
    const caseId = this.triggerValue(btn, "id")
    const caseName = caseNameFromHeader()
    const supportsDetailedExport = this.triggerValue(btn, "supportsDetailedExport") !== "false"

    this.currentCaseId = caseId || ""
    this.currentCaseName = caseName || ""
    this.supportsDetailedExport = supportsDetailedExport
    this.selectedFormat = null

    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Export Case: ${caseName}` : "Export Case"
    }

    this.formatTargets.forEach((radio) => { radio.checked = false })
    if (this.hasDetailedRadioTarget) this.detailedRadioTarget.disabled = !supportsDetailedExport
    if (this.hasDetailedWarningTarget) this.detailedWarningTarget.classList.add("d-none")

    this._refreshLinks()
    this._refreshSubmitState()
    this._loadSnapshots()
  }

  selectFormat(event) {
    this.selectedFormat = event.params.format
    if (this.hasDetailedWarningTarget) {
      const showWarning = this.selectedFormat === "detailed" && !this.supportsDetailedExport
      this.toggleVisible("detailedWarning", showWarning)
    }
    this._refreshSubmitState()
  }

  // The "Snapshot" radio's dropdown: picking a snapshot always selects the
  // "Snapshot" format.
  selectSnapshot() {
    if (this.hasSnapshotRadioTarget) this.snapshotRadioTarget.checked = true
    this.selectFormat({ params: { format: "snapshot" } })
  }

  // The Basic/TREC section shares one snapshot dropdown; picking a snapshot
  // there always selects "Basic".
  selectBasicSnapshot() {
    if (this.hasBasicRadioTarget) this.basicRadioTarget.checked = true
    this.selectFormat({ params: { format: "basic" } })
  }

  selectApiSnapshot() {
    if (!this.hasApiSnapshotSelectTarget) return
    const snapshotId = this.apiSnapshotSelectTarget.value

    this.toggleVisible("apiSnapshotWrapper", snapshotId)
    if (this.hasApiSnapshotLinkTarget && snapshotId) {
      this.apiSnapshotLinkTarget.href = this._snapshotShowUrl(snapshotId)
    }
  }

  async submit() {
    try {
      await this._performExport()
    } catch (error) {
      console.error("export-case-core: export failed", error)
      showFlash("error", "Export failed. Please try again.")
    }
  }

  _performExport() {
    switch (this.selectedFormat) {
      case "information_need":
        return this._downloadUrl(this._url(this.informationNeedUrlTemplateValue), "information_need.csv")
      case "general":
        return this._downloadGeneral()
      case "detailed":
        return this._downloadDetailed()
      case "snapshot":
        return this._downloadSnapshot()
      case "basic":
        return this._downloadRatingsExport("csv", this._selectedBasicSnapshotId() ? "basic_snapshot" : "basic",
          this._selectedBasicSnapshotId() ? "basic_snapshot.csv" : "basic.csv")
      case "trec":
        return this._downloadRatingsExport("txt", this._selectedBasicSnapshotId() ? "trec_snapshot" : "trec",
          this._selectedBasicSnapshotId() ? "trec_snapshot.txt" : "trec.txt")
      case "rre":
        return this._downloadRatingsExport("json", "rre", "rre.json")
      case "ltr":
        return this._downloadRatingsExport("txt", "ltr", "ltr.txt")
      case "quepid":
        return this._downloadJson(this._url(this.quepidExportUrlTemplateValue), "case.json")
      default:
        return null
    }
  }

  async _loadSnapshots() {
    const selects = [
      this.hasSnapshotSelectTarget && this.snapshotSelectTarget,
      this.hasBasicSnapshotSelectTarget && this.basicSnapshotSelectTarget,
      this.hasApiSnapshotSelectTarget && this.apiSnapshotSelectTarget
    ]
    selects.forEach((select) => {
      if (select) select.innerHTML = '<option value=""></option>'
    })
    this.toggleVisible("snapshotsError", false)
    if (!this.hasSnapshotsIndexUrlTemplateValue || !this.currentCaseId) return

    const caseId = this.currentCaseId
    try {
      const data = await getJson(this._url(this.snapshotsIndexUrlTemplateValue))
      if (!isSameId(caseId, this.currentCaseId)) return

      const snapshots = Array.isArray(data.snapshots) ? data.snapshots : []
      selects.forEach((select) => {
        if (!select) return
        snapshots.forEach((snapshot) => {
          const option = document.createElement("option")
          option.value = String(snapshot.id)
          const date = formatShortDate(snapshot.time)
          option.textContent = date ? `(${date}) ${snapshot.name}` : snapshot.name
          select.appendChild(option)
        })
      })
    } catch (error) {
      if (!isSameId(caseId, this.currentCaseId)) return
      console.error("export-case-core: load snapshots failed", error)
      this.toggleVisible("snapshotsError", true)
    }
  }

  _refreshLinks() {
    if (this.hasCaseLinkTarget) this.caseLinkTarget.href = this._url(this.caseUrlTemplateValue)
    if (this.hasQueriesLinkTarget) this.queriesLinkTarget.href = this._url(this.queriesUrlTemplateValue)
    if (this.hasAnnotationsLinkTarget) this.annotationsLinkTarget.href = this._url(this.annotationsUrlTemplateValue)
    if (this.hasScoresLinkTarget) this.scoresLinkTarget.href = this._url(this.scoresUrlTemplateValue)
    if (this.hasRatingsLinkTarget) this.ratingsLinkTarget.href = this._url(this.ratingsExportUrlTemplateValue).replaceAll(FORMAT_PLACEHOLDER, "json")
    if (this.hasQuepidPeekLinkTarget) this.quepidPeekLinkTarget.href = this._url(this.quepidExportUrlTemplateValue)
    if (this.hasApiSnapshotWrapperTarget) this.apiSnapshotWrapperTarget.classList.add("d-none")
  }

  _refreshSubmitState() {
    if (!this.hasSubmitButtonTarget) return
    const missingSnapshot = this.selectedFormat === "snapshot" && !this._selectedSnapshotId()
    const disabled = !this.selectedFormat || missingSnapshot ||
      (this.selectedFormat === "detailed" && !this.supportsDetailedExport)
    this.submitButtonTarget.disabled = disabled
  }

  _selectedSnapshotId() {
    return this.hasSnapshotSelectTarget ? this.snapshotSelectTarget.value : ""
  }

  _selectedBasicSnapshotId() {
    return this.hasBasicSnapshotSelectTarget ? this.basicSnapshotSelectTarget.value : ""
  }

  async _downloadGeneral() {
    const [ caseData, queriesData ] = await Promise.all([
      caseRuntime.read(this.currentCaseId, { url: this._url(this.caseUrlTemplateValue) }),
      getJson(this._url(this.queriesUrlTemplateValue))
    ])
    const csv = buildGeneralCaseCsv(caseData, queriesData.queries || [])
    downloadBlob(new Blob([ csv ], { type: "text/csv" }), this._fileName("general.csv"))
  }

  async _downloadDetailed() {
    const caseData = await caseRuntime.read(this.currentCaseId, { url: this._url(this.caseUrlTemplateValue) })
    const queries = getCoreStores().documents.snapshot().queries
    const csv = buildDetailedCaseCsv(caseData, queries)
    downloadBlob(new Blob([ csv ], { type: "text/csv" }), this._fileName("detailed.csv"))
  }

  async _downloadSnapshot() {
    const snapshotId = this._selectedSnapshotId()
    if (!snapshotId) return

    const snapshotData = await getJson(this._snapshotShowUrl(snapshotId))
    const csv = buildSnapshotCsv(this.currentCaseId, snapshotData)
    downloadBlob(new Blob([ csv ], { type: "text/csv" }), this._fileName("snapshot.csv"))
  }

  _downloadRatingsExport(format, fileFormat, fileSuffix) {
    const url = this._url(this.ratingsExportUrlTemplateValue).replaceAll(FORMAT_PLACEHOLDER, format)
    const params = new URLSearchParams({ file_format: fileFormat })
    const snapshotId = this._selectedBasicSnapshotId()
    if (fileFormat.endsWith("_snapshot") && snapshotId) params.set("snapshot_id", snapshotId)

    const fullUrl = `${url}?${params.toString()}`
    return format === "json" ? this._downloadJson(fullUrl, fileSuffix) : this._downloadUrl(fullUrl, fileSuffix)
  }

  async _downloadUrl(url, fileSuffix) {
    const response = await apiFetch(url, { headers: { Accept: "*/*" } })
    if (!response.ok) throw httpErrorFor(response)

    const blob = await response.blob()
    downloadBlob(blob, this._fileName(fileSuffix))
  }

  async _downloadJson(url, fileSuffix) {
    const data = await getJson(url)
    const blob = new Blob([ JSON.stringify(data, null, 2) ], { type: "application/json" })
    downloadBlob(blob, this._fileName(fileSuffix))
  }

  _fileName(suffix) {
    return formatDownloadFileName(`${this.currentCaseName}_${suffix}`)
  }

  _snapshotShowUrl(snapshotId) {
    return this._url(this.snapshotShowUrlTemplateValue).replaceAll(SNAPSHOT_ID_PLACEHOLDER, snapshotId)
  }

  _url(template) {
    return template.replaceAll(CASE_ID_PLACEHOLDER, this.currentCaseId)
  }
}

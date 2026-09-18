import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { buildGeneralCaseCsv, buildSnapshotCsv, formatDownloadFileName, formatShortDate } from "utils/case_csv"
import { downloadBlob } from "utils/download_file"

const CASE_ID_PLACEHOLDER = "__CASE_ID__"
const SNAPSHOT_ID_PLACEHOLDER = "__SNAPSHOT_ID__"
const FORMAT_PLACEHOLDER = "__FORMAT__"

/**
 * Export-case modal for the core case toolbar — mirrors the AngularJS
 * `<export-case>` component/`_modal.html` it replaces: one radio-button
 * choice of export format, then an immediate download (the modal always
 * closes on "Export", matching Angular's close-then-download flow — there is
 * no inline success/failure alert to preserve, Angular didn't show one).
 *
 * Every format except "detailed" is reconstructed from persisted API data
 * (case/queries/snapshot endpoints already used elsewhere), so this fully
 * replaces AngularJS's `caseCSVSvc.stringify` / `stringifySnapshot` and the
 * plain `$http` + `saveAs` downloads. "detailed" needs the live,
 * already-searched documents held in the still-running Angular
 * `queriesSvc` (not reconstructable from the server without re-running the
 * search), so it stays bridged via a CustomEvent to `caseCSVSvc.js` until the
 * live-query-state migration phase — see
 * docs/todo/angularjs_removal_inventory.md.
 *
 * Same dual-role pattern as share/clone/delete-case-options-core (shared via
 * ModalTriggerControllerBase): the trigger reads case id/name off its own
 * dataset and delegates to the modal-root instance.
 */
export default class extends ModalTriggerControllerBase {
  modalElementId = "exportCaseModal"

  static targets = [
    "title",
    "submitButton",
    "snapshotRadio",
    "snapshotSelect",
    "basicRadio",
    "basicSnapshotSelect",
    "apiSnapshotSelect",
    "apiSnapshotLink",
    "apiSnapshotWrapper",
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

  openAsRoot(event) {
    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.exportCaseCoreIdValue
    const caseName = btn?.dataset?.exportCaseCoreNameValue

    this.currentCaseId = caseId || ""
    this.currentCaseName = caseName || ""
    this.selectedFormat = null

    if (this.hasTitleTarget) {
      this.titleTarget.textContent = caseName ? `Export Case: ${caseName}` : "Export Case"
    }

    this.element.querySelectorAll('input[name="export-case-format"]').forEach((radio) => { radio.checked = false })

    this._refreshLinks()
    this._refreshSubmitState()
    this._loadSnapshots()
  }

  selectFormat(event) {
    this.selectedFormat = event.params.format
    this._refreshSubmitState()
  }

  // The "Snapshot" radio's dropdown: picking a snapshot always selects the
  // "Snapshot" format, mirroring the AngularJS modal's $watch on `options`.
  selectSnapshot() {
    if (this.hasSnapshotRadioTarget) this.snapshotRadioTarget.checked = true
    this.selectFormat({ params: { format: "snapshot" } })
  }

  // The Basic/TREC section shares one snapshot dropdown; picking a snapshot
  // there always selects "Basic" (same AngularJS $watch quirk — choosing a
  // snapshot for a TREC export still flips the radio to Basic).
  selectBasicSnapshot() {
    if (this.hasBasicRadioTarget) this.basicRadioTarget.checked = true
    this.selectFormat({ params: { format: "basic" } })
  }

  selectApiSnapshot() {
    if (!this.hasApiSnapshotSelectTarget) return
    const snapshotId = this.apiSnapshotSelectTarget.value

    if (this.hasApiSnapshotWrapperTarget) this.apiSnapshotWrapperTarget.classList.toggle("d-none", !snapshotId)
    if (this.hasApiSnapshotLinkTarget && snapshotId) {
      this.apiSnapshotLinkTarget.href = this._snapshotShowUrl(snapshotId)
    }
  }

  async submit() {
    try {
      await this._performExport()
    } catch (error) {
      console.error("export-case-core: export failed", error)
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
    if (!this.hasSnapshotsIndexUrlTemplateValue || !this.currentCaseId) return

    const caseId = this.currentCaseId
    try {
      const response = await apiFetch(this._url(this.snapshotsIndexUrlTemplateValue), { headers: { Accept: "application/json" } })
      if (!response.ok) return
      const data = await response.json()
      if (caseId !== this.currentCaseId) return

      const snapshots = Array.isArray(data.snapshots) ? data.snapshots : []
      selects.forEach((select) => {
        if (!select) return
        snapshots.forEach((snapshot) => {
          const option = document.createElement("option")
          option.value = String(snapshot.id)
          option.textContent = `(${formatShortDate(snapshot.time)}) ${snapshot.name}`
          select.appendChild(option)
        })
      })
    } catch (error) {
      if (caseId !== this.currentCaseId) return
      console.error("export-case-core: load snapshots failed", error)
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
    const disabled = !this.selectedFormat || missingSnapshot
    this.submitButtonTarget.disabled = disabled
  }

  _selectedSnapshotId() {
    return this.hasSnapshotSelectTarget ? this.snapshotSelectTarget.value : ""
  }

  _selectedBasicSnapshotId() {
    return this.hasBasicSnapshotSelectTarget ? this.basicSnapshotSelectTarget.value : ""
  }

  async _downloadGeneral() {
    const [ caseResponse, queriesResponse ] = await Promise.all([
      apiFetch(this._url(this.caseUrlTemplateValue), { headers: { Accept: "application/json" } }),
      apiFetch(this._url(this.queriesUrlTemplateValue), { headers: { Accept: "application/json" } })
    ])
    if (!caseResponse.ok || !queriesResponse.ok) {
      console.error("export-case-core: general export failed", caseResponse.status, queriesResponse.status)
      return
    }

    const caseData = await caseResponse.json()
    const queriesData = await queriesResponse.json()
    const csv = buildGeneralCaseCsv(caseData, queriesData.queries || [])
    downloadBlob(new Blob([ csv ], { type: "text/csv" }), this._fileName("general.csv"))
  }

  _downloadDetailed() {
    document.dispatchEvent(new CustomEvent("export-case:detailed", { detail: { caseId: this.currentCaseId } }))
  }

  async _downloadSnapshot() {
    const snapshotId = this._selectedSnapshotId()
    if (!snapshotId) return

    const response = await apiFetch(this._snapshotShowUrl(snapshotId), { headers: { Accept: "application/json" } })
    if (!response.ok) {
      console.error("export-case-core: snapshot export failed", response.status)
      return
    }

    const snapshotData = await response.json()
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
    if (!response.ok) {
      console.error("export-case-core: export failed", url, response.status)
      return
    }

    const blob = await response.blob()
    downloadBlob(blob, this._fileName(fileSuffix))
  }

  async _downloadJson(url, fileSuffix) {
    const response = await apiFetch(url, { headers: { Accept: "application/json" } })
    if (!response.ok) {
      console.error("export-case-core: export failed", url, response.status)
      return
    }

    const data = await response.json()
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

import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = ["modal", "formatRadio", "submitButton", "snapshotGroup", "snapshotSelect"]
  static values = {
    caseId: { type: Number },
    caseName: { type: String, default: "" },
  }

  open(event) {
    event.preventDefault()

    // Uncheck all radio buttons
    this.formatRadioTargets.forEach((r) => (r.checked = false))
    this.submitButtonTarget.disabled = true
    this._selectedFormat = null

    // Hide snapshot selectors
    if (this.hasSnapshotGroupTarget) {
      this.snapshotGroupTarget.classList.add("d-none")
    }

    this._modal().show()
  }

  selectFormat(event) {
    this._selectedFormat = event.currentTarget.value
    this.submitButtonTarget.disabled = false

    // Show snapshot selector for formats that support it
    if (this.hasSnapshotGroupTarget) {
      const needsSnapshot = ["basic", "trec"].includes(this._selectedFormat)
      this.snapshotGroupTarget.classList.toggle("d-none", !needsSnapshot)
    }
  }

  async submit(event) {
    event.preventDefault()
    if (!this._selectedFormat) return
    if (this._submitting) return
    this._submitting = true

    const caseId = this.caseIdValue
    const caseName = this.caseNameValue.replace(/[\s:]/g, "_")
    const snapshotId =
      this.hasSnapshotGroupTarget &&
      this.hasSnapshotSelectTarget &&
      !this.snapshotGroupTarget.classList.contains("d-none")
        ? this.snapshotSelectTarget.value
        : null

    const format = this._selectedFormat

    let url, filename
    switch (format) {
      case "basic":
        url = snapshotId
          ? `api/export/ratings/${caseId}.csv?file_format=basic_snapshot&snapshot_id=${snapshotId}`
          : `api/export/ratings/${caseId}.csv?file_format=basic`
        filename = `${caseName}_basic.csv`
        break
      case "trec":
        url = snapshotId
          ? `api/export/ratings/${caseId}.txt?file_format=trec_snapshot&snapshot_id=${snapshotId}`
          : `api/export/ratings/${caseId}.txt?file_format=trec`
        filename = `${caseName}_trec.txt`
        break
      case "rre":
        url = `api/export/ratings/${caseId}.json?file_format=rre`
        filename = `${caseName}_rre.json`
        break
      case "ltr":
        url = `api/export/ratings/${caseId}.txt?file_format=ltr`
        filename = `${caseName}_ltr.txt`
        break
      case "quepid":
        url = `api/export/cases/${caseId}.json`
        filename = `${caseName}_case.json`
        break
      case "information_need":
        url = `api/export/queries/information_needs/${caseId}.csv`
        filename = `${caseName}_information_needs.csv`
        break
      default:
        return
    }

    try {
      const response = await fetch(apiUrl(url), {
        headers: {
          "X-CSRF-Token": csrfToken(),
        },
      })

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`)
      }

      const blob = await response.blob()
      this._downloadBlob(blob, filename)
      this._modal().hide()
    } catch (error) {
      console.error("Export failed:", error)
      alert(`Export failed: ${error.message}`)
    } finally {
      this._submitting = false
    }
  }

  // Private

  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { getJson } from "api/json"
import { showStatusMessage } from "utils/status_message"

/**
 * Core snapshot comparison picker.
 *
 * The picker and read renderer are Stimulus-owned. Snapshot fetching and the
 * live Query/searcher adapter stay behind the `snapshot-bridge` outlet until
 * the broader live query-state migration is complete.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "title",
    "alert",
    "selections",
    "addButton",
    "warning",
    "processingWarning",
    "deleteWarning",
    "progress",
    "updateButton",
    "clearButton"
  ]

  static outlets = ["snapshot-bridge"]

  static values = {
    snapshotsUrl: String,
    maxSnapshots: { type: Number, default: 5 }
  }

  initialize() {
    this.snapshots = []
    this.selectionValues = []
    this.deleteId = null
    this.busy = false
  }

  async openFor() {
    this.clearMessages()
    this.setBusy(false)

    const current = this.currentSelections()
    this.selectionValues = current.length > 0 ? [...current] : [""]
    await this.loadSnapshots()
  }

  async loadSnapshots() {
    this.setBusy(true)
    try {
      const payload = await getJson(`${this.snapshotsUrlValue}?shallow=true`)
      this.snapshots = payload.snapshots || []
      this.renderSelections()
    } catch (error) {
      this.showError("Could not load available snapshots.")
      this.snapshots = []
      this.renderSelections()
    } finally {
      this.setBusy(false)
    }
  }

  currentSelections() {
    const selection = this.snapshotBridgeOutlet.currentSelections()
    return Array.isArray(selection) ? selection.map(String) : []
  }

  addSelection() {
    if (this.selectionValues.length < this.maxSnapshotsValue) {
      this.selectionValues.push("")
      this.renderSelections()
    }
  }

  removeSelection(index) {
    if (this.selectionValues.length > 1) this.selectionValues.splice(index, 1)
    else this.selectionValues[0] = ""
    this.renderSelections()
  }

  removeSelectionAt(event) {
    this.removeSelection(event.params.index)
  }

  deleteSelectionAt(event) {
    this.deleteSelected(event.params.index)
  }

  selectChanged(event) {
    this.selectionValues[event.params.index] = event.currentTarget.value
    this.renderSelections()
  }

  async update() {
    const selections = this.validSelections()
    if (this.hasDuplicateSelections()) {
      this.showWarning("You have selected the same snapshot multiple times. Each snapshot should be unique.")
      return
    }

    if (selections.length === 0) {
      await this.clear()
      return
    }

    const applied = await this.callBridge(
      () => this.snapshotBridgeOutlet.apply({ selections, snapshotsUrl: this.snapshotsUrlValue }),
      "Could not fetch one or more snapshots!"
    )
    if (applied) this.closeModal()
  }

  async clear() {
    const cleared = await this.callBridge(() => this.snapshotBridgeOutlet.clear(), "Could not fetch one or more snapshots!")
    if (cleared) this.closeModal()
  }

  async deleteSelected(index) {
    const snapshotId = this.selectionValues[index]
    if (!snapshotId) return

    this.deleteId = snapshotId
    this.renderSelections()
  }

  cancelDelete(event) {
    event?.preventDefault()
    this.deleteId = null
    this.renderSelections()
  }

  async confirmDelete(event) {
    event?.preventDefault()
    if (!this.deleteId) return

    const snapshotId = this.deleteId
    const deleted = await this.callBridge(
      () => this.snapshotBridgeOutlet.delete({ snapshotId, snapshotsUrl: this.snapshotsUrlValue }),
      "Could not delete snapshot."
    )
    if (!deleted) return

    this.selectionValues = this.selectionValues.filter((id) => id !== String(snapshotId))
    if (this.selectionValues.length === 0) this.selectionValues = [""]
    this.deleteId = null
    this.renderSelections()
  }

  validSelections() {
    return this.selectionValues.filter(Boolean)
  }

  hasDuplicateSelections() {
    return new Set(this.validSelections()).size !== this.validSelections().length
  }

  renderSelections() {
    if (!this.hasSelectionsTarget) return
    this.selectionsTarget.replaceChildren()

    this.selectionValues.forEach((selected, index) => {
      const row = document.createElement("div")
      row.className = "snapshot-selection-row"
      row.style.marginBottom = "10px"
      row.style.display = "flex"
      row.style.alignItems = "center"

      const label = document.createElement("label")
      label.className = "snapshot-selection-label"
      label.textContent = `Snapshot ${index + 1}:`
      label.style.marginRight = "10px"
      label.style.minWidth = "100px"
      label.style.fontWeight = "bold"

      const select = document.createElement("select")
      select.className = "form-select snapshot-selection-select"
      select.dataset.diffCoreIndexParam = String(index)
      select.style.width = "auto"
      select.style.minWidth = "200px"
      select.style.marginRight = "10px"
      select.dataset.action = "change->diff-core#selectChanged"
      this.addOption(select, "", "-- Select Snapshot --")
      this.snapshots.forEach((snapshot) => {
        this.addOption(select, String(snapshot.id), this.snapshotName(snapshot), selected === String(snapshot.id))
      })

      const remove = document.createElement("button")
      remove.type = "button"
      remove.className = "btn btn-sm btn-danger"
      if (!selected) remove.classList.add("d-none")
      remove.title = this.selectionValues.length > 1 ? "Remove this snapshot selection" : "Clear this selection"
      remove.setAttribute("aria-label", remove.title)
      remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>'
      remove.dataset.diffCoreIndexParam = String(index)
      remove.dataset.action = "click->diff-core#removeSelectionAt"

      const del = document.createElement("button")
      del.type = "button"
      del.className = "btn btn-sm btn-danger"
      if (!selected) del.classList.add("d-none")
      del.style.marginLeft = "5px"
      del.title = "Delete this snapshot"
      del.setAttribute("aria-label", del.title)
      del.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>'
      del.dataset.diffCoreIndexParam = String(index)
      del.dataset.action = "click->diff-core#deleteSelectionAt"

      row.append(label, select, remove, del)
      this.selectionsTarget.append(row)
    })

    this.toggleVisible(this.addButtonTarget, this.selectionValues.length < this.maxSnapshotsValue)
    this.warningTarget.textContent = "You have selected the same snapshot multiple times. Each snapshot should be unique."
    this.toggleVisible(this.warningTarget, this.hasDuplicateSelections())
    const processing = this.selectionValues.some((id) => {
      const snapshot = this.snapshots.find((candidate) => String(candidate.id) === String(id))
      return Boolean(snapshot?.has_snapshot_file || snapshot?.hasSnapshotFile)
    })
    this.toggleVisible(this.processingWarningTarget, processing)
    this.toggleVisible(this.deleteWarningTarget, this.deleteId)
  }

  addOption(select, value, text, selected = false) {
    const option = document.createElement("option")
    option.value = value
    option.textContent = text
    option.selected = selected
    select.append(option)
  }

  snapshotName(snapshot) {
    const name = snapshot.name || snapshot.snapshot_name || `Snapshot ${snapshot.id}`
    const time = snapshot.time || snapshot.created_at || snapshot.created_time
    if (!time) return name

    const date = new Date(time)
    if (Number.isNaN(date.getTime())) return name
    return `(${date.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })}) ${name}`
  }

  async callBridge(request, errorMessage) {
    this.setBusy(true)
    try {
      await request()
      return true
    } catch (error) {
      console.error(error)
      this.showError(errorMessage)
      return false
    } finally {
      this.setBusy(false)
    }
  }

  closeModal() {
    const modal = this.element.closest(".modal")
    if (modal) window.bootstrap?.Modal.getInstance(modal)?.hide()
  }

  setBusy(busy) {
    this.busy = busy
    this.setButtonsDisabled(busy, ["updateButton", "clearButton"])
    this.setProgress(busy)
  }

  clearMessages() {
    this.warningTarget.classList.add("d-none")
    this.processingWarningTarget.classList.add("d-none")
    this.deleteWarningTarget.classList.add("d-none")
    showStatusMessage(this.hasAlertTarget ? this.alertTarget : null, { message: "", className: "alert d-none" })
  }

  showWarning(message) {
    this.warningTarget.textContent = message
    this.warningTarget.classList.remove("d-none")
  }

  showError(message) {
    const alert = this.hasAlertTarget ? this.alertTarget : null
    if (alert) showStatusMessage(alert, { message, className: "alert alert-danger" })
  }
}

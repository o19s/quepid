import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { showStatusMessage } from "utils/status_message"

/**
 * Core snapshot comparison picker.
 *
 * The picker and read renderer are Stimulus-owned. Snapshot fetching and the
 * live Query/searcher adapter remain behind the temporary document-event seam
 * until the broader live query-state migration is complete.
 */
export default class extends ModalTriggerControllerBase {
  static targets = [
    "title",
    "selections",
    "addButton",
    "warning",
    "processingWarning",
    "deleteWarning",
    "progress",
    "updateButton",
    "clearButton"
  ]

  static values = {
    snapshotsUrl: String,
    maxSnapshots: { type: Number, default: 5 }
  }

  get modalElementId() {
    return "diffModal"
  }

  initialize() {
    this.snapshots = []
    this.selectionValues = []
    this.deleteId = null
    this.busy = false
  }

  async openAsRoot(event) {
    event?.preventDefault?.()
    this.clearMessages()
    this.setBusy(false)

    const current = await this.currentSelections()
    this.selectionValues = current.length > 0 ? [...current] : [""]
    await this.loadSnapshots()
  }

  async loadSnapshots() {
    this.setBusy(true)
    try {
      const response = await apiFetch(`${this.snapshotsUrlValue}?shallow=true`)
      if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`)
      const payload = await response.json()
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

  async currentSelections() {
    return new Promise((resolve) => {
      let settled = false
      const done = (selection) => {
        if (settled) return
        settled = true
        resolve(Array.isArray(selection) ? selection.map(String) : [])
      }

      document.dispatchEvent(new CustomEvent("diff:selection-request", { detail: { done } }))
      window.setTimeout(() => done([]), 250)
    })
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

  selectChanged(event) {
    this.selectionValues[Number(event.currentTarget.dataset.index)] = event.currentTarget.value
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

    this.setBusy(true)
    await this.dispatchAndWait("diff:apply", { selections })
  }

  async clear() {
    this.setBusy(true)
    await this.dispatchAndWait("diff:clear", {})
  }

  async deleteSelected(index) {
    const snapshotId = this.selectionValues[index]
    if (!snapshotId) return

    this.deleteId = snapshotId
    this.renderSelections()
  }

  cancelDelete() {
    this.deleteId = null
    this.renderSelections()
  }

  async confirmDelete() {
    if (!this.deleteId) return
    this.setBusy(true)
    await this.dispatchAndWait("diff:delete", { snapshotId: this.deleteId })
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
      select.dataset.index = String(index)
      select.style.width = "auto"
      select.style.minWidth = "200px"
      select.style.marginRight = "10px"
      select.addEventListener("change", (event) => this.selectChanged(event))
      this.addOption(select, "", "-- Select Snapshot --")
      this.snapshots.forEach((snapshot) => {
        this.addOption(select, String(snapshot.id), this.snapshotName(snapshot), selected === String(snapshot.id))
      })

      const remove = document.createElement("button")
      remove.type = "button"
      remove.className = "btn btn-sm btn-danger"
      if (!selected) remove.classList.add("d-none")
      remove.title = this.selectionValues.length > 1 ? "Remove this snapshot selection" : "Clear this selection"
      remove.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>'
      remove.addEventListener("click", () => this.removeSelection(index))

      const del = document.createElement("button")
      del.type = "button"
      del.className = "btn btn-sm btn-danger"
      if (!selected) del.classList.add("d-none")
      del.style.marginLeft = "5px"
      del.title = "Delete this snapshot"
      del.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>'
      del.addEventListener("click", () => this.deleteSelected(index))

      row.append(label, select, remove, del)
      this.selectionsTarget.append(row)
    })

    this.addButtonTarget.classList.toggle("d-none", this.selectionValues.length >= this.maxSnapshotsValue)
    this.warningTarget.classList.toggle("d-none", !this.hasDuplicateSelections())
    const processing = this.selectionValues.some((id) => {
      const snapshot = this.snapshots.find((candidate) => String(candidate.id) === String(id))
      return Boolean(snapshot?.has_snapshot_file || snapshot?.hasSnapshotFile)
    })
    this.processingWarningTarget.classList.toggle("d-none", !processing)
    this.deleteWarningTarget.classList.toggle("d-none", !this.deleteId)
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

  async dispatchAndWait(eventName, detail) {
    return new Promise((resolve) => {
      let settled = false
      const done = (error) => {
        if (settled) return
        settled = true
        window.clearTimeout(timeoutId)
        this.setBusy(false)
        if (error) this.showError(eventName === "diff:delete" ? "Could not delete snapshot." : "Could not fetch one or more snapshots!")
        else {
          if (eventName === "diff:delete") {
            this.selectionValues = this.selectionValues.filter((id) => id !== String(detail.snapshotId))
            if (this.selectionValues.length === 0) this.selectionValues = [""]
            this.deleteId = null
            this.renderSelections()
          } else {
            this.closeModal()
          }
        }
        resolve()
      }

      const timeoutId = window.setTimeout(() => done("timeout"), 30000)
      document.dispatchEvent(new CustomEvent(eventName, { detail: { ...detail, done } }))
    })
  }

  closeModal() {
    const modal = this.element.closest(".modal")
    if (modal) window.bootstrap?.Modal.getInstance(modal)?.hide()
  }

  setBusy(busy) {
    this.busy = busy
    if (this.hasUpdateButtonTarget) this.updateButtonTarget.disabled = busy
    if (this.hasClearButtonTarget) this.clearButtonTarget.disabled = busy
    if (this.hasProgressTarget) this.progressTarget.classList.toggle("d-none", !busy)
  }

  clearMessages() {
    this.warningTarget.classList.add("d-none")
    this.processingWarningTarget.classList.add("d-none")
    this.deleteWarningTarget.classList.add("d-none")
    showStatusMessage(this.element.querySelector("[data-diff-core-target='alert']"), { message: "", className: "alert d-none" })
  }

  showWarning(message) {
    this.warningTarget.textContent = message
    this.warningTarget.classList.remove("d-none")
  }

  showError(message) {
    const alert = this.element.querySelector("[data-diff-core-target='alert']")
    if (alert) showStatusMessage(alert, { message, className: "alert alert-danger" })
  }
}

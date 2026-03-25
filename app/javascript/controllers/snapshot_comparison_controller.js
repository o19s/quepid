import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

const MAX_SNAPSHOTS = 3

export default class extends Controller {
  static targets = [
    "modal",
    "snapshotList",
    "addButton",
    "warningArea",
    "loadingSpinner",
    "compareButton",
    "clearButton",
  ]

  connect() {
    this.snapshots = [] // available snapshots from API
    this.comparisonActive = false
    this._comparedSnapshotIds = [] // IDs of snapshots in active comparison
    this._onModalHidden = () => {
      this._comparing = false
    }
    this.modalTarget.addEventListener("hidden.bs.modal", this._onModalHidden)
  }

  disconnect() {
    this.modalTarget.removeEventListener("hidden.bs.modal", this._onModalHidden)
  }

  async open(event) {
    event.preventDefault()

    this.warningAreaTarget.classList.add("d-none")
    this.warningAreaTarget.textContent = ""
    this.loadingSpinnerTarget.classList.remove("d-none")
    this.snapshotListTarget.innerHTML = ""
    this.addButtonTarget.classList.add("d-none")
    this.compareButtonTarget.disabled = true

    this._modal().show()

    try {
      const caseId = document.body.dataset.caseId
      const response = await fetch(apiUrl(`api/cases/${caseId}/snapshots?shallow=true`), {
        headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
      })

      if (!response.ok) throw new Error(`Failed to load snapshots (${response.status})`)

      const data = await response.json()
      this.snapshots = data.snapshots || []

      this.loadingSpinnerTarget.classList.add("d-none")

      if (this.snapshots.length === 0) {
        this.snapshotListTarget.innerHTML =
          '<p class="text-muted">No snapshots available. Create a snapshot first.</p>'
        return
      }

      this._addSelectionRow()
      this.addButtonTarget.classList.remove("d-none")
      this.compareButtonTarget.disabled = false
    } catch (error) {
      console.error("Failed to load snapshots:", error)
      this.loadingSpinnerTarget.classList.add("d-none")
      this._showWarning(error.message)
    }
  }

  addSnapshot() {
    const rows = this.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    if (rows.length >= MAX_SNAPSHOTS) return

    this._addSelectionRow()

    if (
      this.snapshotListTarget.querySelectorAll(".snapshot-selection-row").length >= MAX_SNAPSHOTS
    ) {
      this.addButtonTarget.classList.add("d-none")
    }
  }

  removeRow(event) {
    const row = event.currentTarget.closest(".snapshot-selection-row")
    if (!row) return

    row.remove()

    // Show Add button if below max
    if (
      this.snapshotListTarget.querySelectorAll(".snapshot-selection-row").length < MAX_SNAPSHOTS
    ) {
      this.addButtonTarget.classList.remove("d-none")
    }

    // Disable compare if no rows remain
    const remaining = this.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    this.compareButtonTarget.disabled = remaining.length === 0
  }

  async deleteSnapshot(event) {
    const snapshotId = event.currentTarget.dataset.snapshotId
    if (!snapshotId) return
    if (!confirm("Delete this snapshot permanently?")) return

    const caseId = document.body.dataset.caseId

    try {
      const response = await fetch(apiUrl(`api/cases/${caseId}/snapshots/${snapshotId}`), {
        method: "DELETE",
        headers: { "X-CSRF-Token": csrfToken() },
      })

      if (!response.ok) {
        throw new Error(`Failed to delete snapshot (${response.status})`)
      }

      // Remove from local list and refresh dropdowns
      this.snapshots = this.snapshots.filter((s) => String(s.id) !== String(snapshotId))
      this._refreshAllDropdowns()

      // If a compared snapshot was deleted, clear the active comparison
      if (this.comparisonActive && this._comparedSnapshotIds.includes(snapshotId)) {
        this.clear()
      }
    } catch (error) {
      console.error("Failed to delete snapshot:", error)
      this._showWarning(error.message)
    }
  }

  async compare() {
    if (this._comparing) return
    this._comparing = true

    this.warningAreaTarget.classList.add("d-none")

    const selects = this.snapshotListTarget.querySelectorAll("select")
    const selectedIds = Array.from(selects)
      .map((s) => s.value)
      .filter((v) => v)

    if (selectedIds.length === 0) {
      this._showWarning("Select at least one snapshot.")
      this._comparing = false
      return
    }

    // Check for duplicates
    const unique = new Set(selectedIds)
    if (unique.size < selectedIds.length) {
      this._showWarning("Remove duplicate snapshot selections.")
      this._comparing = false
      return
    }

    // Check for processing snapshots
    const processing = selectedIds.filter((id) => {
      const snap = this.snapshots.find((s) => String(s.id) === id)
      return snap && snap.has_snapshot_file
    })
    if (processing.length > 0) {
      this._showWarning("One or more selected snapshots are still processing. Please wait.")
      this._comparing = false
      return
    }

    // Fetch full snapshot data for each selected
    this.compareButtonTarget.disabled = true
    this.loadingSpinnerTarget.classList.remove("d-none")

    try {
      const caseId = document.body.dataset.caseId
      const fetchPromises = selectedIds.map((id) =>
        fetch(apiUrl(`api/cases/${caseId}/snapshots/${id}`), {
          headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
        }).then((r) => {
          if (!r.ok) throw new Error(`Failed to load snapshot ${id} (${r.status})`)
          return r.json()
        }),
      )

      const snapshotData = await Promise.all(fetchPromises)

      this.comparisonActive = true
      this._comparedSnapshotIds = selectedIds.slice()
      this.clearButtonTarget.classList.remove("d-none")

      // Dispatch activation event with snapshot data
      document.dispatchEvent(
        new CustomEvent("snapshot-comparison:activate", {
          detail: { snapshots: snapshotData },
        }),
      )

      this._modal().hide()
    } catch (error) {
      console.error("Failed to load snapshot data:", error)
      this._showWarning(error.message)
    } finally {
      this._comparing = false
      this.compareButtonTarget.disabled = false
      this.loadingSpinnerTarget.classList.add("d-none")
    }
  }

  clear(event) {
    if (event) event.preventDefault()

    this.comparisonActive = false
    this._comparedSnapshotIds = []
    this.clearButtonTarget.classList.add("d-none")

    document.dispatchEvent(new CustomEvent("snapshot-comparison:deactivate"))
  }

  // Private

  _addSelectionRow() {
    const rowIndex = this.snapshotListTarget.querySelectorAll(".snapshot-selection-row").length + 1
    const row = document.createElement("div")
    row.className = "snapshot-selection-row d-flex align-items-center mb-2 gap-2"

    const label = document.createElement("label")
    label.className = "form-label mb-0 text-nowrap"
    label.textContent = `Snapshot ${rowIndex}:`

    const select = document.createElement("select")
    select.className = "form-select form-select-sm"
    this._populateSelect(select)

    const removeBtn = document.createElement("button")
    removeBtn.type = "button"
    removeBtn.className = "btn btn-sm btn-outline-danger"
    removeBtn.innerHTML = '<i class="bi bi-x"></i>'
    removeBtn.title = "Remove"
    removeBtn.dataset.action = "click->snapshot-comparison#removeRow"

    const deleteBtn = document.createElement("button")
    deleteBtn.type = "button"
    deleteBtn.className = "btn btn-sm btn-outline-secondary"
    deleteBtn.innerHTML = '<i class="bi bi-trash"></i>'
    deleteBtn.title = "Delete snapshot"
    deleteBtn.dataset.action = "click->snapshot-comparison#deleteSnapshot"
    // We'll set the snapshot ID dynamically when selection changes
    select.addEventListener("change", () => {
      deleteBtn.dataset.snapshotId = select.value
    })

    row.appendChild(label)
    row.appendChild(select)
    row.appendChild(removeBtn)
    row.appendChild(deleteBtn)

    this.snapshotListTarget.appendChild(row)

    // Set initial delete button snapshot ID
    if (select.value) {
      deleteBtn.dataset.snapshotId = select.value
    }
  }

  _populateSelect(select) {
    select.innerHTML = ""

    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.textContent = "-- Select snapshot --"
    select.appendChild(placeholder)

    for (const snap of this.snapshots) {
      const opt = document.createElement("option")
      opt.value = snap.id
      const dateStr = snap.time ? new Date(snap.time).toLocaleDateString() : ""
      opt.textContent = `${snap.name}${dateStr ? ` (${dateStr})` : ""}`
      if (snap.has_snapshot_file) {
        opt.textContent += " [processing...]"
        opt.disabled = true
      }
      select.appendChild(opt)
    }
  }

  _refreshAllDropdowns() {
    const rows = this.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    rows.forEach((row) => {
      const select = row.querySelector("select")
      const deleteBtn = row.querySelector("[data-action*='deleteSnapshot']")
      if (!select) return

      const currentValue = select.value
      this._populateSelect(select)
      // Restore selection if still available
      if (this.snapshots.find((s) => String(s.id) === currentValue)) {
        select.value = currentValue
      }
      // Sync delete button with current selection
      if (deleteBtn) {
        deleteBtn.dataset.snapshotId = select.value
      }
    })

    // If no snapshots left, show message
    if (this.snapshots.length === 0) {
      this.snapshotListTarget.innerHTML =
        '<p class="text-muted">No snapshots available. Create a snapshot first.</p>'
      this.addButtonTarget.classList.add("d-none")
      this.compareButtonTarget.disabled = true
    }
  }

  _showWarning(message) {
    this.warningAreaTarget.textContent = message
    this.warningAreaTarget.classList.remove("d-none")
  }

  _modal() {
    return window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
  }
}

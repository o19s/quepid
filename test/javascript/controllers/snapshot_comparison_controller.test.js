import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import SnapshotComparisonController from "../../../app/javascript/controllers/snapshot_comparison_controller"
import { waitForController } from "../support/stimulus_helpers"

// Mock bootstrap modal
const mockModal = { show: vi.fn(), hide: vi.fn() }
window.bootstrap = { Modal: { getOrCreateInstance: () => mockModal, getInstance: () => mockModal } }

describe("SnapshotComparisonController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.body.dataset.caseId = "1"
    document.body.dataset.quepidRootUrl = "/"

    document.body.innerHTML = `
      <div data-controller="snapshot-comparison">
        <div data-snapshot-comparison-target="modal" class="modal">
          <div data-snapshot-comparison-target="warningArea" class="d-none"></div>
          <div data-snapshot-comparison-target="loadingSpinner" class="d-none"></div>
          <div data-snapshot-comparison-target="snapshotList"></div>
          <button data-snapshot-comparison-target="addButton" class="d-none"></button>
          <button data-snapshot-comparison-target="compareButton" disabled></button>
          <button data-snapshot-comparison-target="clearButton" class="d-none"></button>
        </div>
      </div>
    `

    application = Application.start()
    application.register("snapshot-comparison", SnapshotComparisonController)
    await waitForController(
      application,
      '[data-controller="snapshot-comparison"]',
      "snapshot-comparison",
    )
  })

  afterEach(() => {
    application.stop()
    global.fetch = originalFetch
    delete document.body.dataset.caseId
  })

  function getController() {
    return application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="snapshot-comparison"]'),
      "snapshot-comparison",
    )
  }

  function mockFetchSnapshots(snapshots) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ snapshots }),
    })
  }

  it("connects with initial state", () => {
    const ctrl = getController()
    expect(ctrl.snapshots).toEqual([])
    expect(ctrl.comparisonActive).toBe(false)
  })

  it("open loads snapshots and adds a selection row", async () => {
    const snaps = [
      { id: 1, name: "Snap A", time: "2025-01-01T00:00:00Z" },
      { id: 2, name: "Snap B", time: "2025-01-02T00:00:00Z" },
    ]
    mockFetchSnapshots(snaps)

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    expect(ctrl.snapshots).toHaveLength(2)
    const rows = ctrl.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    expect(rows.length).toBe(1)
    expect(ctrl.addButtonTarget.classList.contains("d-none")).toBe(false)
    expect(ctrl.compareButtonTarget.disabled).toBe(false)
  })

  it("open shows message when no snapshots", async () => {
    mockFetchSnapshots([])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    expect(ctrl.snapshotListTarget.innerHTML).toContain("No snapshots available")
    expect(ctrl.addButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("addSnapshot adds rows up to MAX_SNAPSHOTS (3)", async () => {
    mockFetchSnapshots([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    ctrl.addSnapshot()
    ctrl.addSnapshot() // Now 3 rows
    ctrl.addSnapshot() // Should be ignored (at max)

    const rows = ctrl.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    expect(rows.length).toBe(3)
    expect(ctrl.addButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("removeRow removes a row and re-shows add button", async () => {
    mockFetchSnapshots([{ id: 1, name: "A" }])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })
    ctrl.addSnapshot()
    ctrl.addSnapshot() // 3 rows, add hidden

    const rows = ctrl.snapshotListTarget.querySelectorAll(".snapshot-selection-row")
    const removeBtn = rows[1].querySelector("button")
    ctrl.removeRow({ currentTarget: removeBtn })

    expect(ctrl.snapshotListTarget.querySelectorAll(".snapshot-selection-row").length).toBe(2)
    expect(ctrl.addButtonTarget.classList.contains("d-none")).toBe(false)
  })

  it("compare validates empty selection", async () => {
    mockFetchSnapshots([{ id: 1, name: "A" }])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    // Leave select empty
    await ctrl.compare()

    expect(ctrl.warningAreaTarget.textContent).toContain("Select at least one")
    expect(ctrl.warningAreaTarget.classList.contains("d-none")).toBe(false)
  })

  it("compare validates duplicate selections", async () => {
    mockFetchSnapshots([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })
    ctrl.addSnapshot()

    // Set both selects to the same value
    const selects = ctrl.snapshotListTarget.querySelectorAll("select")
    selects[0].value = "1"
    selects[1].value = "1"

    await ctrl.compare()

    expect(ctrl.warningAreaTarget.textContent).toContain("duplicate")
  })

  it("compare dispatches activation event on success", async () => {
    const snaps = [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ]
    mockFetchSnapshots(snaps)

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    // Select snapshot 1
    const select = ctrl.snapshotListTarget.querySelector("select")
    select.value = "1"

    // Mock the detail fetch
    global.fetch = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, name: "A", queries: {} }),
      })

    let eventDetail = null
    document.addEventListener("snapshot-comparison:activate", (e) => {
      eventDetail = e.detail
    })

    await ctrl.compare()

    expect(eventDetail).not.toBeNull()
    expect(eventDetail.snapshots).toHaveLength(1)
    expect(ctrl.comparisonActive).toBe(true)
    expect(ctrl.clearButtonTarget.classList.contains("d-none")).toBe(false)
  })

  it("clear resets comparison state and dispatches deactivate", async () => {
    const ctrl = getController()
    ctrl.comparisonActive = true
    ctrl._comparedSnapshotIds = ["1"]

    let deactivated = false
    document.addEventListener("snapshot-comparison:deactivate", () => {
      deactivated = true
    })

    ctrl.clear()

    expect(ctrl.comparisonActive).toBe(false)
    expect(ctrl._comparedSnapshotIds).toEqual([])
    expect(ctrl.clearButtonTarget.classList.contains("d-none")).toBe(true)
    expect(deactivated).toBe(true)
  })

  it("deleteSnapshot removes snapshot and refreshes dropdowns", async () => {
    mockFetchSnapshots([
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ])

    const ctrl = getController()
    await ctrl.open({ preventDefault: () => {} })

    // Mock confirm + delete fetch
    vi.spyOn(window, "confirm").mockReturnValue(true)
    global.fetch = vi.fn().mockResolvedValue({ ok: true })

    await ctrl.deleteSnapshot({ currentTarget: { dataset: { snapshotId: "1" } } })

    expect(ctrl.snapshots).toHaveLength(1)
    expect(ctrl.snapshots[0].id).toBe(2)
  })
})

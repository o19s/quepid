import { viewTemplateTargets } from "../support/view_template"
import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DiffCoreController from "controllers/diff_core_controller"
import { showStatusMessage } from "utils/status_message"

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("api/fetch", () => ({ apiFetch }))
vi.mock("utils/status_message", () => ({
  showStatusMessage: vi.fn()
}))

function buildBridge() {
  return {
    currentSelections: vi.fn(() => []),
    apply: vi.fn(async () => {}),
    clear: vi.fn(async () => {}),
    delete: vi.fn(async () => {})
  }
}

function buildController(bridge = buildBridge()) {
  const controller = buildControllerFixture(DiffCoreController, {
    outlets: { snapshotBridge: bridge },
    targets: {
      ...viewTemplateTargets("app/views/core/_snapshot_selection_template.html.erb", "diff-core"),
      selections: document.createElement("div"),
      title: document.createElement("h5"),
      addButton: document.createElement("button"),
      warning: document.createElement("div"),
      processingWarning: document.createElement("div"),
      deleteWarning: document.createElement("div"),
      progress: document.createElement("div"),
      updateButton: document.createElement("button"),
      clearButton: document.createElement("button")
    },
    values: {
      maxSnapshots: 5
    }
  })
  controller.hasAlertTarget = true
  controller.snapshots = [
    { id: 2, name: "Weekly" },
    { id: 3, name: "Monthly" }
  ]
  controller.selectionValues = ["2"]
  controller.deleteId = null
  controller.element.append(
    controller.selectionsTarget,
    controller.addButtonTarget,
    controller.warningTarget,
    controller.processingWarningTarget,
    controller.deleteWarningTarget,
    controller.progressTarget
  )
  controller.element.insertAdjacentHTML("beforeend", "<div data-diff-core-target='alert'></div>")
  controller.alertTarget = controller.element.querySelector("[data-diff-core-target='alert']")
  return controller
}

describe("DiffCoreController", () => {
  it("inserts snapshot names as text and replaces rows without accumulating options", () => {
    const controller = buildController()
    controller.snapshots = [{ id: 2, name: "<img src=x onerror=alert(1)>" }]
    controller.renderSelections()
    controller.renderSelections()
    expect(controller.selectionsTarget.querySelector("img")).toBeNull()
    expect(controller.selectionsTarget.querySelectorAll("option")).toHaveLength(2)
    expect(controller.selectionsTarget.textContent).toContain(controller.snapshots[0].name)
  })

  it("routes generated remove and delete buttons using their row parameters", () => {
    const controller = buildController()
    controller.selectionValues = ["2", "3"]
    controller.renderSelections()
    const secondRow = controller.selectionsTarget.children[1]
    const buttons = secondRow.querySelectorAll("button")
    expect(buttons[0].dataset.action).toBe("click->diff-core#removeSelectionAt")
    expect(buttons[1].dataset.action).toBe("click->diff-core#deleteSelectionAt")
    expect(buttons[0].dataset.diffCoreIndexParam).toBe("1")
    expect(buttons[1].dataset.diffCoreIndexParam).toBe("1")
    controller.deleteSelected = vi.fn()
    controller.deleteSelectionAt({ params: { index: 1 } })
    expect(controller.deleteSelected).toHaveBeenCalledWith(1)
    controller.removeSelectionAt({ params: { index: 1 } })
    expect(controller.selectionValues).toEqual(["2"])
  })

  beforeEach(() => {
    vi.clearAllMocks()
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({ snapshots: [] }) })
  })

  afterEach(() => vi.restoreAllMocks())

  it("keeps the yes/no delete-confirmation links from following their href", async () => {
    const controller = buildController()
    controller.setBusy = vi.fn()
    controller.deleteId = "2"
    const cancel = { preventDefault: vi.fn() }
    const confirm = { preventDefault: vi.fn() }

    controller.cancelDelete(cancel)
    controller.deleteId = "2"
    await controller.confirmDelete(confirm)

    expect(cancel.preventDefault).toHaveBeenCalledOnce()
    expect(confirm.preventDefault).toHaveBeenCalledOnce()
  })

  it("renders the selected snapshot and available snapshots", () => {
    const controller = buildController()
    controller.renderSelections()

    expect(controller.selectionsTarget.querySelectorAll("select")).toHaveLength(1)
    expect(controller.selectionsTarget.querySelector("select").value).toBe("2")
    expect(controller.selectionsTarget.textContent).toContain("Weekly")
    expect(controller.selectionsTarget.textContent).toContain("Monthly")
  })

  it("warns instead of applying duplicate selections", async () => {
    const controller = buildController()
    controller.selectionValues = ["2", "2"]
    controller.renderSelections()
    expect(controller.warningTarget.textContent).toContain("same snapshot")
    expect(controller.warningTarget.classList.contains("d-none")).toBe(false)

    await controller.update()

    expect(controller.warningTarget.textContent).toContain("same snapshot")
    expect(controller.snapshotBridgeOutlet.apply).not.toHaveBeenCalled()
  })

  it("applies the selected snapshots through the bridge outlet and closes", async () => {
    const controller = buildController()
    controller.snapshotsUrlValue = "api/cases/1/snapshots"
    controller.closeModal = vi.fn()

    await controller.update()

    expect(controller.snapshotBridgeOutlet.apply).toHaveBeenCalledWith({ selections: ["2"], snapshotsUrl: "api/cases/1/snapshots" })
    expect(controller.closeModal).toHaveBeenCalledOnce()
    expect(controller.updateButtonTarget.disabled).toBe(false)
  })

  const alertMessages = () => showStatusMessage.mock.calls.map(([, options]) => options.message).filter(Boolean)

  it("opens with the bridge's current selections and loads snapshots shallowly", async () => {
    const bridge = buildBridge()
    bridge.currentSelections.mockReturnValue([4])
    const controller = buildController(bridge)
    controller.snapshotsUrlValue = "api/cases/1/snapshots"
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: true, json: async () => ({ snapshots: [{ id: 4, name: "Release" }] }) })

    await controller.openFor(null)

    expect(controller.selectionValues).toEqual(["4"])
    expect(apiFetch).toHaveBeenCalledWith("api/cases/1/snapshots?shallow=true", { method: "GET", headers: { Accept: "application/json" } })
    expect(controller.selectionsTarget.querySelector("select").value).toBe("4")
    expect(controller.updateButtonTarget.disabled).toBe(false)
  })

  it("starts with one blank row when nothing is being compared", async () => {
    const controller = buildController()

    await controller.openFor(null)

    expect(controller.selectionValues).toEqual([""])
  })

  it("shows an error and an empty list when snapshots can't be loaded", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: false, status: 500 })

    await controller.loadSnapshots()

    expect(controller.snapshots).toEqual([])
    expect(alertMessages()).toContain("Could not load available snapshots.")
    expect(controller.progressTarget.classList.contains("d-none")).toBe(true)
  })

  it("adds rows up to the maximum and hides Add once it is reached", () => {
    const controller = buildController()
    controller.maxSnapshotsValue = 2

    controller.addSelection()
    controller.addSelection()

    expect(controller.selectionValues).toEqual(["2", ""])
    expect(controller.addButtonTarget.classList.contains("d-none")).toBe(true)
  })

  it("removes a row, but clears the last remaining row instead of removing it", () => {
    const controller = buildController()
    controller.selectionValues = ["2", "3"]

    controller.removeSelection(0)
    expect(controller.selectionValues).toEqual(["3"])

    controller.removeSelection(0)
    expect(controller.selectionValues).toEqual([""])
  })

  it("records a changed select by its row index", () => {
    const controller = buildController()
    controller.selectionValues = ["2", ""]
    controller.renderSelections()
    const second = controller.selectionsTarget.querySelectorAll("select")[1]

    second.value = "3"
    expect(second.dataset.action).toBe("change->diff-core#selectChanged")
    expect(second.dataset.diffCoreIndexParam).toBe("1")
    controller.selectChanged({ currentTarget: second, params: { index: 1 } })

    expect(controller.selectionValues).toEqual(["2", "3"])
  })

  it("hides the remove and delete buttons on an empty row, and flags snapshots still processing", () => {
    const controller = buildController()
    controller.snapshots = [{ id: 2, name: "Weekly", has_snapshot_file: true }]
    controller.selectionValues = ["2", ""]

    controller.renderSelections()

    const [filled, empty] = controller.selectionsTarget.querySelectorAll(".snapshot-selection-row")
    expect(filled.querySelectorAll("button.d-none")).toHaveLength(0)
    expect(empty.querySelectorAll("button.d-none")).toHaveLength(2)
    expect(filled.querySelector("button").title).toBe("Remove this snapshot selection")
    expect(controller.processingWarningTarget.classList.contains("d-none")).toBe(false)
  })

  it("clears the comparison when nothing is selected", async () => {
    const controller = buildController()
    controller.selectionValues = [""]
    controller.closeModal = vi.fn()

    await controller.update()

    expect(controller.snapshotBridgeOutlet.clear).toHaveBeenCalledOnce()
    expect(controller.snapshotBridgeOutlet.apply).not.toHaveBeenCalled()
    expect(controller.closeModal).toHaveBeenCalledOnce()
    expect(controller.updateButtonTarget.disabled).toBe(false)
  })

  it("asks to confirm a delete, then drops the deleted snapshot from the selection", async () => {
    const controller = buildController()
    controller.selectionValues = ["2", "3"]
    controller.snapshotsUrlValue = "api/cases/1/snapshots"

    await controller.deleteSelected(1)
    expect(controller.deleteId).toBe("3")
    expect(controller.deleteWarningTarget.classList.contains("d-none")).toBe(false)
    await controller.confirmDelete({ preventDefault: vi.fn() })

    expect(controller.snapshotBridgeOutlet.delete).toHaveBeenCalledWith({ snapshotId: "3", snapshotsUrl: "api/cases/1/snapshots" })
    expect(controller.selectionValues).toEqual(["2"])
    expect(controller.deleteId).toBeNull()
    expect(controller.deleteWarningTarget.classList.contains("d-none")).toBe(true)
  })

  it("leaves one blank row after deleting the only selected snapshot, and ignores empty rows", async () => {
    const controller = buildController()
    controller.deleteId = "2"

    await controller.confirmDelete({ preventDefault: vi.fn() })
    expect(controller.selectionValues).toEqual([""])

    await controller.deleteSelected(0)
    expect(controller.deleteId).toBeNull()
  })

  it.each([
    ["apply", (c) => c.update(), "Could not fetch one or more snapshots!"],
    ["clear", (c) => c.clear(), "Could not fetch one or more snapshots!"],
    ["delete", (c) => { c.deleteId = "2"; return c.confirmDelete({ preventDefault: vi.fn() }) }, "Could not delete snapshot."]
  ])("reports a failed %s and keeps the modal state", async (command, act, message) => {
    const bridge = buildBridge()
    const failure = new Error("bridge failed")
    bridge[command].mockRejectedValue(failure)
    const controller = buildController(bridge)
    controller.closeModal = vi.fn()
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(controller)

    expect(logged).toHaveBeenCalledWith(failure)
    expect(alertMessages()).toContain(message)
    expect(controller.selectionValues).toEqual(["2"])
    expect(controller.closeModal).not.toHaveBeenCalled()
    expect(controller.updateButtonTarget.disabled).toBe(false)
  })

  it("keeps the buttons disabled while the bridge is working", async () => {
    let finish
    const bridge = buildBridge()
    bridge.apply.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const controller = buildController(bridge)
    controller.closeModal = vi.fn()

    const applying = controller.update()
    expect(controller.updateButtonTarget.disabled).toBe(true)
    finish()
    await applying

    expect(controller.updateButtonTarget.disabled).toBe(false)
  })

  it("names snapshots by name, falling back to the id, with a short date when known", () => {
    const controller = buildController()

    expect(controller.snapshotName({ id: 2, name: "Weekly", created_at: "2026-09-28T12:00:00Z" })).toBe("(9/28/26) Weekly")
    expect(controller.snapshotName({ id: 3, snapshot_name: "Legacy" })).toBe("Legacy")
    expect(controller.snapshotName({ id: 4, time: "not a date" })).toBe("Snapshot 4")
  })
})


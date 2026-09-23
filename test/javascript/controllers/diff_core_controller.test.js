import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import DiffCoreController from "controllers/diff_core_controller"

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }))

vi.mock("api/fetch", () => ({ apiFetch }))
vi.mock("utils/status_message", () => ({
  showStatusMessage: vi.fn()
}))

function buildController() {
  const controller = Object.create(DiffCoreController.prototype)
  controller.element = document.createElement("div")
  controller.application = { getControllerForElementAndIdentifier: vi.fn() }
  controller.snapshots = [
    { id: 2, name: "Weekly" },
    { id: 3, name: "Monthly" }
  ]
  controller.selectionValues = ["2"]
  controller.maxSnapshotsValue = 5
  controller.deleteId = null
  controller.hasSelectionsTarget = true
  controller.selectionsTarget = document.createElement("div")
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.addButtonTarget = document.createElement("button")
  controller.warningTarget = document.createElement("div")
  controller.processingWarningTarget = document.createElement("div")
  controller.deleteWarningTarget = document.createElement("div")
  controller.progressTarget = document.createElement("div")
  controller.updateButtonTarget = document.createElement("button")
  controller.clearButtonTarget = document.createElement("button")
  controller.element.append(
    controller.selectionsTarget,
    controller.addButtonTarget,
    controller.warningTarget,
    controller.processingWarningTarget,
    controller.deleteWarningTarget,
    controller.progressTarget
  )
  return controller
}

describe("DiffCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiFetch.mockResolvedValue({ ok: true, json: async () => ({ snapshots: [] }) })
  })

  afterEach(() => vi.restoreAllMocks())

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
    const apply = vi.fn()
    document.addEventListener("diff:apply", apply)

    await controller.update()

    document.removeEventListener("diff:apply", apply)
    expect(controller.warningTarget.textContent).toContain("same snapshot")
    expect(apply).not.toHaveBeenCalled()
  })

  it("dispatches the selected snapshots to the Angular diff bridge", async () => {
    const controller = buildController()
    const events = []
    const listener = (event) => {
      events.push(event)
      event.detail.done(null)
    }
    document.addEventListener("diff:apply", listener)

    await controller.update()

    document.removeEventListener("diff:apply", listener)
    expect(events).toHaveLength(1)
    expect(events[0].detail.selections).toEqual(["2"])
  })
})

import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TakeSnapshotCoreController from "controllers/take_snapshot_core_controller"

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn(), show: vi.fn() })),
  hideBsModal: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = buildControllerFixture(TakeSnapshotCoreController, {
    targets: {
      title: document.createElement("h5"),
      alert: document.createElement("div"),
      nameInput: document.createElement("input"),
      lookupFields: document.createElement("div"),
      noLookupFields: document.createElement("div"),
      fieldSpec: document.createElement("code"),
      engineName: document.createElement("span"),
      recordFieldsCheckbox: document.createElement("input"),
      submitButton: document.createElement("button"),
      progress: document.createElement("div"),
      cancelButton: document.createElement("button")
    }
  })
  controller.recordFieldsCheckboxTarget.type = "checkbox"

  Object.assign(controller, overrides)
  return controller
}

describe("TakeSnapshotCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("names the engine from the server's engine labels, preferring a mapper engine's own name", () => {
    const controller = buildModalController({ engineLabelsValue: { vectara: "Vectara", searchapi: "Search API" } })
    const trigger = document.createElement("a")
    trigger.dataset.takeSnapshotCoreSearchEngineValue = "vectara"

    controller.openFor(trigger)
    expect(controller.engineNameTarget.textContent).toBe("Vectara")

    trigger.dataset.takeSnapshotCoreSearchEngineValue = "searchapi"
    trigger.dataset.takeSnapshotCoreMapperEngineNameValue = "Vespa"
    controller.openFor(trigger)
    expect(controller.engineNameTarget.textContent).toBe("Vespa")
  })

  it("forces recordDocumentFields for engines without id lookup", () => {
    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.takeSnapshotCoreIdValue = "3"
    trigger.dataset.takeSnapshotCoreFieldSpecValue = "id:id title:title"
    trigger.dataset.takeSnapshotCoreSearchEngineValue = "vectara"

    controller.openFor(trigger)

    expect(controller.supportsLookup).toBe(false)
    expect(controller.lookupFieldsTarget.classList.contains("d-none")).toBe(true)
    expect(controller.noLookupFieldsTarget.classList.contains("d-none")).toBe(false)

    const events = []
    document.addEventListener("take-snapshot:create", (e) => events.push(e))

    controller.nameInputTarget.value = "My snap"
    controller.submit({ preventDefault() {} })

    expect(events).toHaveLength(1)
    expect(events[0].detail).toMatchObject({
      caseId: 3,
      name: "My snap",
      recordDocumentFields: true
    })
  })

  it("passes through the checkbox for engines that support lookup by id", () => {
    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.takeSnapshotCoreIdValue = "3"
    trigger.dataset.takeSnapshotCoreSearchEngineValue = "solr"

    controller.openFor(trigger)
    controller.nameInputTarget.value = "Solr snap"
    controller.recordFieldsCheckboxTarget.checked = true

    const events = []
    document.addEventListener("take-snapshot:create", (e) => events.push(e))
    controller.submit({ preventDefault() {} })

    expect(events[0].detail.recordDocumentFields).toBe(true)
  })

  it("disables Cancel while the snapshot request is in flight, re-enables on completion", () => {
    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.takeSnapshotCoreIdValue = "3"
    trigger.dataset.takeSnapshotCoreSearchEngineValue = "solr"
    controller.openFor(trigger)

    let capturedDone
    document.addEventListener("take-snapshot:create", (e) => {
      capturedDone = e.detail.done
    })

    controller.nameInputTarget.value = "Solr snap"
    controller.submit({ preventDefault() {} })

    expect(controller.cancelButtonTarget.disabled).toBe(true)

    capturedDone(null)

    expect(controller.cancelButtonTarget.disabled).toBe(false)
  })
})

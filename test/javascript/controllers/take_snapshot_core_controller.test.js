import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TakeSnapshotCoreController from "controllers/take_snapshot_core_controller"

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({ hide: vi.fn(), show: vi.fn() })),
  hideBsModal: vi.fn()
}))

function buildModalController(overrides = {}) {
  const controller = Object.create(TakeSnapshotCoreController.prototype)
  controller.application = {
    getControllerForElementAndIdentifier: vi.fn(() => null)
  }
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.hasAlertTarget = true
  controller.alertTarget = document.createElement("div")
  controller.hasNameInputTarget = true
  controller.nameInputTarget = document.createElement("input")
  controller.hasLookupFieldsTarget = true
  controller.lookupFieldsTarget = document.createElement("div")
  controller.hasNoLookupFieldsTarget = true
  controller.noLookupFieldsTarget = document.createElement("div")
  controller.hasFieldSpecTarget = true
  controller.fieldSpecTarget = document.createElement("code")
  controller.hasEngineNameTarget = true
  controller.engineNameTarget = document.createElement("span")
  controller.hasRecordFieldsCheckboxTarget = true
  controller.recordFieldsCheckboxTarget = document.createElement("input")
  controller.recordFieldsCheckboxTarget.type = "checkbox"
  controller.hasSubmitButtonTarget = true
  controller.submitButtonTarget = document.createElement("button")
  controller.hasProgressTarget = true
  controller.progressTarget = document.createElement("div")
  controller.hasCancelButtonTarget = true
  controller.cancelButtonTarget = document.createElement("button")
  controller.element = document.createElement("div")

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

  it("forces recordDocumentFields for engines without id lookup", () => {
    const controller = buildModalController()
    const trigger = document.createElement("a")
    trigger.dataset.takeSnapshotCoreIdValue = "3"
    trigger.dataset.takeSnapshotCoreFieldSpecValue = "id:id title:title"
    trigger.dataset.takeSnapshotCoreSearchEngineValue = "vectara"

    controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

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

    controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })
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
    controller.openAsRoot({ currentTarget: trigger, preventDefault() {} })

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

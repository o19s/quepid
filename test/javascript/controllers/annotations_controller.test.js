import { buildControllerFixture } from "../support/controller_fixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AnnotationsController from "controllers/annotations_controller"
import { apiFetch } from "api/fetch"
import coreFlash from "utils/core_flash"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) }))
vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))

function buildController() {
  const element = document.createElement("div")
  const controller = buildControllerFixture(AnnotationsController, {
    targets: {
      message: document.createElement("textarea"),
      createButton: document.createElement("button"),
      list: document.createElement("ul"),
      empty: document.createElement("p"),
      editModal: document.createElement("div"),
      editMessage: document.createElement("textarea"),
      editSave: document.createElement("button")
    },
    values: {
      url: "/cases/7/annotations",
      annotationUrlTemplate: "/cases/7/annotations/__ANNOTATION_ID__",
      caseId: 7,
      tryId: 3
    }
  })
  controller.element = element
  controller.scoringStore = {
    caseScore: { score: 0.8, allRated: true },
    snapshot: () => ({ queryScores: { "11": { score: 1, maxScore: 1 } } }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  return controller
}

// The Ruby controller tests exercise the real ERB; these fragments test its DOM contract.
function rowHtml(id, message) {
  return `<li class="annotation" data-annotation-id="${id}"><em class="annotations-time" data-created-at="2026-10-08T15:00:00Z"></em><span>by Imported review</span><span>Try No: 2 Score: 0.80</span><div class="annotation-message">${message}</div></li>`
}

function htmlResponse(html) {
  return { ok: true, status: 200, text: async () => html }
}

describe("AnnotationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("creates an annotation from the current case score and renders it", async () => {
    apiFetch.mockResolvedValue(htmlResponse(rowHtml(9, "Tokenizer changed")))
    const controller = buildController()
    controller.messageTarget.value = "Tokenizer changed"

    await controller.create({ preventDefault: vi.fn() })

    expect(apiFetch).toHaveBeenCalledWith("/cases/7/annotations", expect.objectContaining({ method: "POST" }))
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
      annotation: { message: "Tokenizer changed" },
      score: {
        all_rated: true,
        score: 0.8,
        try_id: 3,
        queries: { "11": { score: 1, maxScore: 1 } }
      }
    })
    expect(controller.listTarget.textContent).toContain("Tokenizer changed")
    expect(controller.listTarget.textContent).toContain("by Imported review")
    expect(controller.listTarget.textContent).toContain("Try No: 2")
  })

  it("does not create before the first score is available", async () => {
    const controller = buildController()
    controller.scoringStore.caseScore = null
    const event = { preventDefault: vi.fn() }

    await controller.create(event)

    expect(apiFetch).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("deletes an annotation and notifies the graph bridge", async () => {
    apiFetch.mockResolvedValueOnce(htmlResponse(rowHtml(9, "Old")))
    apiFetch.mockResolvedValueOnce({ status: 204, ok: true })
    const controller = buildController()
    controller.render(await controller.requestRows("/cases/7/annotations"))
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed)

    const event = { preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "9" } } }
    const deleting = controller.delete(event)
    // DOM events clear currentTarget once the synchronous listener returns.
    event.currentTarget = null
    await deleting

    expect(apiFetch).toHaveBeenCalledWith("/cases/7/annotations/9", { method: "DELETE", headers: { Accept: "text/html" } })
    expect(controller.rows()).toEqual([])
    expect(changed).toHaveBeenCalled()
  })

  it("loads server rows and replaces the list without duplicating them", async () => {
    apiFetch.mockResolvedValue(htmlResponse(rowHtml(9, "Persisted")))
    const controller = buildController()
    await controller.load()
    await controller.load()
    expect(controller.rows()).toHaveLength(1)
    expect(controller.findAnnotation("9").textContent).toContain("Persisted")
    expect(controller.emptyTarget.classList.contains("d-none")).toBe(true)
  })

  it("keeps edited rows in place and notifies the graph after saving", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValueOnce(htmlResponse(rowHtml(8, "First") + rowHtml(9, "Old")))
    await controller.load()
    controller.editingId = "9"
    controller.editMessageTarget.value = "Edited"
    apiFetch.mockResolvedValueOnce(htmlResponse(rowHtml(9, "Edited")))
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed, { once: true })
    await controller.saveEdit({ preventDefault: vi.fn() })
    expect(controller.rows().map(row => row.dataset.annotationId)).toEqual(["8", "9"])
    expect(controller.findAnnotation(9).textContent).toContain("Edited")
    expect(changed).toHaveBeenCalled()
  })

  it("applies an edit when another deletion rebuilds the list while saving", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValueOnce(htmlResponse(rowHtml(8, "First") + rowHtml(9, "Old")))
    await controller.load()
    let finishDelete
    let finishEdit
    apiFetch.mockImplementationOnce(() => new Promise(resolve => { finishDelete = resolve }))
    apiFetch.mockImplementationOnce(() => new Promise(resolve => { finishEdit = resolve }))
    const deleting = controller.delete({ preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "8" } } })
    controller.editingId = "9"
    controller.editMessageTarget.value = "Edited"
    const saving = controller.saveEdit({ preventDefault: vi.fn() })
    finishDelete({ status: 204, ok: true })
    await deleting
    finishEdit(htmlResponse(rowHtml(9, "Edited")))
    await saving
    expect(controller.rows().map(row => row.dataset.annotationId)).toEqual(["9"])
    expect(controller.findAnnotation(9).querySelector(".annotation-message").textContent).toBe("Edited")
  })

  it("retains the draft and saved row when an edit fails", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValueOnce(htmlResponse(rowHtml(9, "Saved")))
    await controller.load()
    controller.editingId = "9"
    controller.editMessageTarget.value = "Unsaved draft"
    apiFetch.mockResolvedValueOnce({ ok: false })
    await controller.saveEdit({ preventDefault: vi.fn() })
    expect(controller.editMessageTarget.value).toBe("Unsaved draft")
    expect(controller.findAnnotation(9).textContent).toContain("Saved")
    expect(controller.editSaveTarget.disabled).toBe(false)
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to update Annotation.")
  })

  it("shows the existing empty/error state when loading fails or redirects to login", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValue({ ok: true, redirected: true })
    await controller.load()
    expect(controller.rows()).toEqual([])
    expect(controller.emptyTarget.classList.contains("d-none")).toBe(false)
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to load annotations.")
  })

})

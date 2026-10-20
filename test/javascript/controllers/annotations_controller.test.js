import { buildControllerFixture } from "../support/controller_fixture"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import AnnotationsController from "controllers/annotations_controller"
import { apiFetch } from "api/fetch"
import coreFlash from "utils/core_flash"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) }))
vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))

const STREAM_TYPE = "text/vnd.turbo-stream.html"

function buildController() {
  const element = document.createElement("div")
  const list = document.createElement("ul")
  list.id = "case-annotations"
  element.append(list)
  document.body.append(element)
  const controller = buildControllerFixture(AnnotationsController, {
    element,
    targets: {
      message: document.createElement("textarea"),
      createButton: document.createElement("button"),
      list,
      editModal: document.createElement("div"),
      editMessage: document.createElement("textarea"),
      editSave: document.createElement("button")
    },
    values: {
      url: "/cases/7/annotations",
      annotationUrlTemplate: "/cases/7/annotations/__ANNOTATION_ID__",
      caseId: 7,
      tryId: 3,
      lastScore: {}
    }
  })
  controller.scoringStore = {
    caseScore: { score: 0.8, allRated: true },
    snapshot: () => ({ queryScores: { "11": { score: 1, maxScore: 1 } } }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  return controller
}

// The Ruby controller tests exercise the real ERB and streams; these fragments test their DOM contract.
function rowHtml(id, message) {
  return `<li id="annotation_${id}" class="annotation" data-annotation-id="${id}"><em class="annotations-time"><time datetime="2026-10-08T15:00:00Z"></time> - </em><span>by Imported review</span><span>Try No: 2 Score: 0.80</span><div class="annotation-message">${message}</div></li>`
}

function stream(action, target, html = "") {
  return `<turbo-stream action="${action}" target="${target}"><template>${html}</template></turbo-stream>`
}

function streamResponse(body) {
  return { ok: true, status: 200, headers: new Headers({ "Content-Type": `${STREAM_TYPE}; charset=utf-8` }), text: async () => body }
}

// Turbo applies stream actions after the next repaint.
function rendered() {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve)))
}

// Rails renders the existing rows with the case page.
function renderRows(controller, html) {
  controller.listTarget.innerHTML = html
}

function rowIds(controller) {
  return controller.rows().map((row) => row.dataset.annotationId)
}

describe("AnnotationsController", () => {
  beforeAll(async () => {
    // Real Turbo renders the streams; the core bundle exposes it as window.Turbo.
    vi.stubGlobal("Turbo", await import("@hotwired/turbo"))
  })

  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("creates an annotation from the current case score and prepends it", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(8, "Earlier"))
    apiFetch.mockResolvedValueOnce(streamResponse(stream("prepend", "case-annotations", rowHtml(9, "Tokenizer changed"))))
    controller.messageTarget.value = "Tokenizer changed"

    await controller.create({ preventDefault: vi.fn() })
    await rendered()

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
    expect(rowIds(controller)).toEqual(["9", "8"])
    expect(controller.listTarget.textContent).toContain("Tokenizer changed")
    expect(controller.listTarget.textContent).toContain("by Imported review")
    expect(controller.listTarget.textContent).toContain("Try No: 2")
    expect(controller.messageTarget.value).toBe("")
  })

  it("enables Create only while a case score exists", () => {
    const controller = buildController()
    controller.updateCreateState()
    expect(controller.createButtonTarget.disabled).toBe(false)
    controller.scoringStore.caseScore = null
    controller.updateCreateState()
    expect(controller.createButtonTarget.disabled).toBe(true)
  })

  it("retains Rails-rendered rows on connect without an annotation read", () => {
    const controller = buildController()
    renderRows(controller, rowHtml(9, "Already rendered"))
    controller.connect()
    try {
      expect(rowIds(controller)).toEqual(["9"])
      expect(controller.listTarget.textContent).toContain("Already rendered")
      expect(apiFetch).not.toHaveBeenCalled()
    } finally {
      controller.disconnect()
    }
  })

  it("keeps a failed create draft without notifying graph consumers", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(9, "Saved"))
    controller.messageTarget.value = "Unsaved note"
    apiFetch.mockResolvedValueOnce({ ok: false })
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed)
    try {
      await controller.create({ preventDefault: vi.fn() })
      expect(controller.messageTarget.value).toBe("Unsaved note")
      expect(rowIds(controller)).toEqual(["9"])
      expect(controller.createButtonTarget.disabled).toBe(false)
      expect(changed).not.toHaveBeenCalled()
      expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to create Annotation.")
    } finally {
      document.removeEventListener("annotations:changed", changed)
    }
  })

  it("does not create before the first score is available", async () => {
    const controller = buildController()
    controller.scoringStore.caseScore = null
    const event = { preventDefault: vi.fn() }

    await controller.create(event)

    expect(apiFetch).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("falls back to the case's recorded score when no query scored this run, as Legacy did", async () => {
    const controller = buildController()
    controller.scoringStore.caseScore = { score: "--", allRated: true }
    controller.scoringStore.snapshot = () => ({ queryScores: {} })
    controller.lastScoreValue = { all_rated: false, score: 0.4, try_id: 2, queries: { "11": { score: 0.4 } } }
    apiFetch.mockResolvedValueOnce(streamResponse(stream("prepend", "case-annotations", rowHtml(9, "Endpoint down"))))
    controller.messageTarget.value = "Endpoint down"

    controller.updateCreateState()
    expect(controller.createButtonTarget.disabled).toBe(false)

    await controller.create({ preventDefault: vi.fn() })
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).score).toEqual(controller.lastScoreValue)
  })

  it("refuses Create on a case with no queries even though it has a '--' score", async () => {
    const controller = buildController()
    controller.scoringStore.caseScore = { score: "--", allRated: true }
    controller.scoringStore.snapshot = () => ({ queryScores: {} })

    controller.updateCreateState()
    expect(controller.createButtonTarget.disabled).toBe(true)

    await controller.create({ preventDefault: vi.fn() })
    expect(apiFetch).not.toHaveBeenCalled()
    expect(coreFlash.show).toHaveBeenCalledWith(
      "error",
      "Can't create a new annotation until searches have been run! Please rerun your searches."
    )
  })

  it("deletes an annotation and notifies the graph bridge", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(9, "Old"))
    apiFetch.mockResolvedValueOnce(streamResponse(stream("remove", "annotation_9")))
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed, { once: true })

    const event = { preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "9" } } }
    const deleting = controller.delete(event)
    // DOM events clear currentTarget once the synchronous listener returns.
    event.currentTarget = null
    await deleting
    await rendered()

    expect(apiFetch).toHaveBeenCalledWith("/cases/7/annotations/9", { method: "DELETE", headers: { Accept: STREAM_TYPE } })
    expect(controller.rows()).toEqual([])
    expect(changed).toHaveBeenCalled()
  })

  it("keeps edited rows in place and notifies the graph after saving", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(8, "First") + rowHtml(9, "Old"))
    controller.editingId = "9"
    controller.editMessageTarget.value = "Edited"
    apiFetch.mockResolvedValueOnce(streamResponse(stream("replace", "annotation_9", rowHtml(9, "Edited"))))
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed, { once: true })
    await controller.saveEdit({ preventDefault: vi.fn() })
    await rendered()
    expect(rowIds(controller)).toEqual(["8", "9"])
    expect(controller.findAnnotation(9).textContent).toContain("Edited")
    expect(changed).toHaveBeenCalled()
  })

  it("applies an edit when another deletion changes the list while saving", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(8, "First") + rowHtml(9, "Old"))
    let finishDelete
    let finishEdit
    apiFetch.mockImplementationOnce(() => new Promise(resolve => { finishDelete = resolve }))
    apiFetch.mockImplementationOnce(() => new Promise(resolve => { finishEdit = resolve }))
    const deleting = controller.delete({ preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "8" } } })
    controller.editingId = "9"
    controller.editMessageTarget.value = "Edited"
    const saving = controller.saveEdit({ preventDefault: vi.fn() })
    finishDelete(streamResponse(stream("remove", "annotation_8")))
    await deleting
    finishEdit(streamResponse(stream("replace", "annotation_9", rowHtml(9, "Edited"))))
    await saving
    await rendered()
    expect(rowIds(controller)).toEqual(["9"])
    expect(controller.findAnnotation(9).querySelector(".annotation-message").textContent).toBe("Edited")
  })

  it("retains the draft and saved row when an edit fails", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(9, "Saved"))
    controller.editingId = "9"
    controller.editMessageTarget.value = "Unsaved draft"
    apiFetch.mockResolvedValueOnce({ ok: false })
    await controller.saveEdit({ preventDefault: vi.fn() })
    expect(controller.editMessageTarget.value).toBe("Unsaved draft")
    expect(controller.findAnnotation(9).textContent).toContain("Saved")
    expect(controller.editSaveTarget.disabled).toBe(false)
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to update Annotation.")
  })

  it("rejects a successful response that is not a stream", async () => {
    const controller = buildController()
    renderRows(controller, rowHtml(9, "Saved"))
    apiFetch.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers({ "Content-Type": "text/html" }), text: async () => "<html></html>" })
    await controller.delete({ preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "9" } } })
    await rendered()
    expect(rowIds(controller)).toEqual(["9"])
    expect(coreFlash.show).toHaveBeenCalledWith("error", "Unable to delete Annotation.")
  })
})

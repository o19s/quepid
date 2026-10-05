import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import { hideBsModal } from "utils/bs_modal"
import CaseEmbedderCoreController from "controllers/case_embedder_core_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(() => ({})),
  hideBsModal: vi.fn()
}))

const STATE = {
  embedder_id: null,
  embedder: null,
  embedders: [
    { embedder_id: 7, name: "MiniLM", provider: "Ollama", model: "all-minilm", dimensions: 128 },
    { embedder_id: 9, name: "OpenAI small", provider: "OpenAI", model: "text-embedding-3-small", dimensions: null }
  ]
}

function jsonResponse(data, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(data) }
}

function buildModalController() {
  const controller = Object.create(CaseEmbedderCoreController.prototype)
  controller.element = document.createElement("div")
  controller.indexUrlTemplateValue = "api/cases/__CASE_ID__/embedders"
  controller.updateUrlTemplateValue = "api/cases/__CASE_ID__/embedders/__EMBEDDER_ID__"
  controller.hasTitleTarget = true
  controller.titleTarget = document.createElement("h5")
  controller.alertTarget = document.createElement("div")
  controller.inaccessibleWarningTarget = document.createElement("div")
  controller.listTarget = document.createElement("div")
  controller.emptyNoticeTarget = document.createElement("p")
  controller.submitButtonTarget = document.createElement("button")
  return controller
}

function buildHeader(modalController, id = "5") {
  const header = Object.create(CaseEmbedderCoreController.prototype)
  header.element = document.createElement("small")
  header.element.hidden = true
  header.hasTitleTarget = false
  header.idValue = id
  header.hasNameTarget = true
  header.nameTarget = document.createElement("span")
  header.modalController = () => modalController
  return header
}

async function openModal(controller, caseId = "5") {
  const link = document.createElement("a")
  link.dataset.caseEmbedderCoreIdValue = caseId
  await controller.openAsRoot({ currentTarget: link })
}

function items(controller) {
  return [...controller.listTarget.querySelectorAll("[data-embedder-id]")]
}

describe("CaseEmbedderCoreController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("open lists None plus the visible embedders, with the current choice active and save disabled", async () => {
    apiFetch.mockResolvedValue(jsonResponse(STATE))
    const controller = buildModalController()

    await openModal(controller)

    expect(apiFetch).toHaveBeenCalledWith("api/cases/5/embedders", expect.anything())
    expect(items(controller).map((item) => item.dataset.embedderId)).toEqual(["0", "7", "9"])
    expect(items(controller)[0].classList.contains("active")).toBe(true)
    expect(items(controller)[1].textContent).toContain("Ollama · all-minilm · 128 dims")
    expect(items(controller)[2].textContent).toContain("model default size")
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.emptyNoticeTarget.classList.contains("d-none")).toBe(true)
  })

  it("warns when the case's embedder isn't shared with the user, and still lists it", async () => {
    const hidden = { embedder_id: 3, name: "Teammate's", provider: "Voyage AI", model: "voyage-3.5", dimensions: 1024, accessible: false }
    apiFetch.mockResolvedValue(jsonResponse({ ...STATE, embedder_id: 3, embedder: hidden }))
    const controller = buildModalController()

    await openModal(controller)

    expect(controller.inaccessibleWarningTarget.classList.contains("d-none")).toBe(false)
    expect(controller.inaccessibleWarningTarget.textContent).toContain("Teammate's")
    expect(items(controller).at(-1).dataset.embedderId).toBe("3")
    expect(items(controller).at(-1).classList.contains("active")).toBe(true)
  })

  it("selecting a different embedder enables save; saving PUTs it, announces the change and closes", async () => {
    const saved = { ...STATE, embedder_id: 7, embedder: { ...STATE.embedders[0], accessible: true } }
    apiFetch.mockResolvedValueOnce(jsonResponse(STATE)).mockResolvedValueOnce(jsonResponse(saved))
    const controller = buildModalController()
    const announced = vi.fn()
    document.addEventListener("quepid:case-embedder-changed", announced)

    await openModal(controller)
    controller.select({ currentTarget: items(controller)[1] })
    expect(controller.submitButtonTarget.disabled).toBe(false)

    await controller.save()

    expect(apiFetch).toHaveBeenLastCalledWith("api/cases/5/embedders/7", expect.objectContaining({ method: "PUT" }))
    expect(announced).toHaveBeenCalledTimes(1)
    expect(announced.mock.calls[0][0].detail).toEqual({ caseId: "5", state: saved })
    expect(hideBsModal).toHaveBeenCalled()
    document.removeEventListener("quepid:case-embedder-changed", announced)
  })

  it("a failed save keeps the modal open with the server's error", async () => {
    apiFetch
      .mockResolvedValueOnce(jsonResponse(STATE))
      .mockResolvedValueOnce(jsonResponse({ error: "Embedder not found" }, false, 404))
    const controller = buildModalController()

    await openModal(controller)
    controller.select({ currentTarget: items(controller)[2] })
    await controller.save()

    expect(controller.alertTarget.textContent).toBe("Embedder not found")
    expect(controller.alertTarget.classList.contains("alert-danger")).toBe(true)
    expect(hideBsModal).not.toHaveBeenCalled()
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("the header waits for Angular to fill in the case id, then shows the embedder's name", async () => {
    const modal = buildModalController()
    const fetchState = vi.spyOn(modal, "fetchState").mockResolvedValue({ embedder: { name: "MiniLM" } })

    const pending = buildHeader(modal, "{{ caseModel.selectedCase().caseNo }}")
    pending.idValueChanged()
    expect(fetchState).not.toHaveBeenCalled()

    const header = buildHeader(modal, "5")
    header.idValueChanged()
    await vi.waitFor(() => expect(header.nameTarget.textContent).toBe("MiniLM"))
    expect(header.element.hidden).toBe(false)
    expect(fetchState).toHaveBeenCalledWith("5")
  })

  it("the toolbar link has no name to show and fetches nothing", () => {
    const modal = buildModalController()
    const fetchState = vi.spyOn(modal, "fetchState")
    const link = buildHeader(modal, "5")
    link.hasNameTarget = false

    link.idValueChanged()

    expect(fetchState).not.toHaveBeenCalled()
  })

  it("the header updates only for its own case, and hides when the embedder is removed", () => {
    const header = buildHeader(buildModalController(), "5")
    header.renderLabel({ embedder: { name: "MiniLM" } })

    header.changed({ detail: { caseId: "6", state: { embedder: { name: "Other" } } } })
    expect(header.nameTarget.textContent).toBe("MiniLM")

    header.changed({ detail: { caseId: "5", state: { embedder: null } } })
    expect(header.element.hidden).toBe(true)
  })
})

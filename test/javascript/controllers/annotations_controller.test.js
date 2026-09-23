import { beforeEach, describe, expect, it, vi } from "vitest"
import AnnotationsController from "controllers/annotations_controller"
import { apiFetch } from "api/fetch"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) }))
vi.mock("utils/flash", () => ({ showFlash: vi.fn() }))

function buildController() {
  const element = document.createElement("div")
  const controller = Object.create(AnnotationsController.prototype)
  controller.element = element
  controller.urlTemplateValue = "/api/cases/__CASE_ID__/annotations"
  controller.caseIdValue = 7
  controller.tryIdValue = 3
  controller.scoringStore = {
    caseScore: { score: 0.8, allRated: true },
    snapshot: () => ({ queryScores: { "11": { score: 1, maxScore: 1 } } }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
  controller.annotations = []
  controller.messageTarget = document.createElement("textarea")
  controller.hasCreateButtonTarget = true
  controller.createButtonTarget = document.createElement("button")
  controller.listTarget = document.createElement("ul")
  controller.emptyTarget = document.createElement("p")
  controller.editModalTarget = document.createElement("div")
  controller.editMessageTarget = document.createElement("textarea")
  controller.editSaveTarget = document.createElement("button")
  return controller
}

describe("AnnotationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
    document.body.appendChild(document.createElement("queries"))
  })

  it("creates an annotation from the current case score and renders it", async () => {
    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 9,
        message: "Tokenizer changed",
        created_at: new Date().toISOString(),
        score: { case_id: 7, try_id: 3, score: 0.8 },
        user: { name: "Ada" },
        source: "Imported review"
      })
    })
    const controller = buildController()
    controller.messageTarget.value = "Tokenizer changed"

    await controller.create({ preventDefault: vi.fn() })

    expect(apiFetch).toHaveBeenCalledWith("/api/cases/7/annotations", expect.objectContaining({ method: "POST" }))
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
  })

  it("does not create before the first score is available", async () => {
    const controller = buildController()
    controller.scoringStore.caseScore = null
    const event = { preventDefault: vi.fn() }

    await controller.create(event)

    expect(apiFetch).not.toHaveBeenCalled()
    expect(event.preventDefault).toHaveBeenCalled()
  })

  it("deletes an annotation and notifies the Angular graph bridge", async () => {
    apiFetch.mockResolvedValue({ ok: true })
    const controller = buildController()
    controller.annotations = [{ id: 9, message: "Old", score: {} }]
    const queries = document.querySelector("queries")
    const changed = vi.fn()
    queries.addEventListener("annotations:changed", changed)
    controller.render()

    await controller.delete({ preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "9" } } })

    expect(apiFetch).toHaveBeenCalledWith("/api/cases/7/annotations/9", { method: "DELETE" })
    expect(controller.annotations).toEqual([])
    expect(changed).toHaveBeenCalled()
  })
})

import { buildControllerFixture } from "../support/controller_fixture"
import { beforeEach, describe, expect, it, vi } from "vitest"
import AnnotationsController from "controllers/annotations_controller"
import { apiFetch } from "api/fetch"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) }))
vi.mock("utils/flash", () => ({ showFlash: vi.fn() }))

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
      urlTemplate: "/api/cases/__CASE_ID__/annotations",
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
  controller.annotations = []
  return controller
}

describe("AnnotationsController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ""
  })

  it("creates an annotation from the current case score and renders it", async () => {
    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({
        id: 9,
        message: "Tokenizer changed",
        created_at: new Date().toISOString(),
        score: { case_id: 7, try_id: 3, try_number: 2, score: 0.8 },
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
    apiFetch.mockResolvedValue({ text: async () => "", json: async () => null,  ok: true })
    const controller = buildController()
    controller.annotations = [{ id: 9, message: "Old", score: {} }]
    const changed = vi.fn()
    document.addEventListener("annotations:changed", changed)
    controller.render()

    await controller.delete({ preventDefault: vi.fn(), currentTarget: { dataset: { annotationId: "9" } } })

    expect(apiFetch).toHaveBeenCalledWith("/api/cases/7/annotations/9", { method: "DELETE", headers: { Accept: "application/json" } })
    expect(controller.annotations).toEqual([])
    expect(changed).toHaveBeenCalled()
  })
})

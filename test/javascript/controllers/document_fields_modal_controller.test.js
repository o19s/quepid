import { beforeEach, describe, expect, it, vi } from "vitest"
import DocumentFieldsModalController from "controllers/document_fields_modal_controller"
import { getOrCreateBsModal, showBsModal } from "utils/bs_modal"

vi.mock("utils/bs_modal", () => ({
  getOrCreateBsModal: vi.fn(el => ({ el })),
  showBsModal: vi.fn()
}))

function buildController() {
  const controller = Object.create(DocumentFieldsModalController.prototype)
  controller.queryTextTarget = document.createElement("span")
  controller.docIdTarget = document.createElement("span")
  controller.contentTarget = document.createElement("pre")
  controller.modalTarget = document.createElement("div")
  return controller
}

function clickEvent(dataset) {
  const link = document.createElement("a")
  Object.assign(link.dataset, dataset)
  return { preventDefault: vi.fn(), currentTarget: link }
}

describe("DocumentFieldsModalController#show", () => {
  beforeEach(() => vi.clearAllMocks())

  it("fills the modal with the query, doc id and pretty-printed JSON, then opens it", () => {
    const controller = buildController()
    const event = clickEvent({ queryText: "star wars", docId: "d1", documentFields: '{"title":"A New Hope"}' })

    controller.show(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(controller.queryTextTarget.textContent).toBe("star wars")
    expect(controller.docIdTarget.textContent).toBe("d1")
    expect(controller.contentTarget.textContent).toBe(JSON.stringify({ title: "A New Hope" }, null, 2))
    expect(getOrCreateBsModal).toHaveBeenCalledWith(controller.modalTarget)
    expect(showBsModal).toHaveBeenCalledTimes(1)
  })

  it("shows the raw text when the fields are not valid JSON", () => {
    const controller = buildController()

    controller.show(clickEvent({ queryText: "q", docId: "d", documentFields: "not json {" }))

    expect(controller.contentTarget.textContent).toBe("not json {")
    expect(showBsModal).toHaveBeenCalledTimes(1)
  })
})

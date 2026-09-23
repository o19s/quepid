import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryNotesController from "controllers/query_notes_controller"

function controllerFor() {
  const element = document.createElement("div")
  element.innerHTML = `
    <form>
      <input data-query-notes-target="informationNeed">
      <textarea data-query-notes-target="notes"></textarea>
    </form>
  `
  const controller = Object.create(QueryNotesController.prototype)
  controller.element = element
  controller.urlValue = "api/cases/1/queries/2/notes"
  controller.informationNeedTarget = element.querySelector('[data-query-notes-target="informationNeed"]')
  controller.notesTarget = element.querySelector('[data-query-notes-target="notes"]')
  return { controller, element }
}

describe("QueryNotesController", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ""
  })

  it("loads notes without overwriting edits made while the request is pending", async () => {
    let resolveResponse
    vi.stubGlobal("fetch", vi.fn(() => new Promise(resolve => { resolveResponse = resolve })))
    const { controller } = controllerFor()

    const request = controller.load()
    controller.notesTarget.value = "typed while loading"
    resolveResponse(new Response(JSON.stringify({ notes: "server notes", information_need: "server need" }), { status: 200 }))
    await request

    expect(controller.notesTarget.value).toBe("typed while loading")
    expect(controller.informationNeedTarget.value).toBe("server need")
  })

  it("saves notes and closes the panel on success", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    window.quepidDom = { flash: { show: vi.fn() } }
    const { controller, element } = controllerFor()
    const close = vi.fn()
    element.addEventListener("query-notes:close", close)
    controller.notesTarget.value = "new notes"
    controller.informationNeedTarget.value = "new need"

    await controller.save({ preventDefault: vi.fn() })

    expect(fetch).toHaveBeenCalledWith(controller.urlValue, expect.objectContaining({ method: "PUT" }))
    expect(close).toHaveBeenCalled()
    expect(window.quepidDom.flash.show).toHaveBeenCalledWith("success", expect.stringContaining("saved"))
  })
})

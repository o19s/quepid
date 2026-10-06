import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryNotesController from "controllers/query_notes_controller"

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

function controllerFor() {
  const element = document.createElement("div")
  element.innerHTML = `
    <form>
      <input data-query-notes-target="informationNeed">
      <textarea data-query-notes-target="notes"></textarea>
    </form>
  `
  const controller = buildControllerFixture(QueryNotesController, {
    element,
    targets: {
      informationNeed: element.querySelector('[data-query-notes-target="informationNeed"]'),
      notes: element.querySelector('[data-query-notes-target="notes"]')
    },
    values: {
      url: "api/cases/1/queries/2/notes"
    }
  })
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
    const flash = { show: vi.fn() }
    Object.assign(coreFlash, flash)
    const { controller, element } = controllerFor()
    const close = vi.fn()
    element.addEventListener("query-notes:close", close)
    controller.notesTarget.value = "new notes"
    controller.informationNeedTarget.value = "new need"

    await controller.save({ preventDefault: vi.fn() })

    expect(fetch).toHaveBeenCalledWith(controller.urlValue, expect.objectContaining({ method: "PUT" }))
    expect(close).toHaveBeenCalled()
    expect(flash.show).toHaveBeenCalledWith("success", expect.stringContaining("saved"))

  })

  it("sends both fields and keeps the panel open with an error when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 500 }))))
    const flash = { show: vi.fn() }
    Object.assign(coreFlash, flash)
    const { controller, element } = controllerFor()
    const close = vi.fn()
    element.addEventListener("query-notes:close", close)
    controller.notesTarget.value = "n"
    controller.informationNeedTarget.value = "i"

    await controller.save({ preventDefault: vi.fn() })

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ query: { notes: "n", information_need: "i" } })
    expect(close).not.toHaveBeenCalled()
    expect(flash.show).toHaveBeenCalledWith("error", "Ooooops! Could not save your query details. Please try again.")

  })

  it("keeps the user's values when loading fails, and fills blanks for missing server fields", async () => {
    const { controller } = controllerFor()
    controller.notesTarget.value = "mine"
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 404 }))))
    await controller.load()
    expect(controller.notesTarget.value).toBe("mine")

    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    await controller.load()
    expect(controller.notesTarget.value).toBe("")
    expect(controller.informationNeedTarget.value).toBe("")
  })
})

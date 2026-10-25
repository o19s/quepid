import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { beforeEach, describe, expect, it, vi } from "vitest"
import QueryNotesController from "controllers/query_notes_controller"

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

let testStores
vi.mock("utils/core_store_access", () => ({ getCoreStores: () => testStores || {} }))

function controllerFor({ queryId } = {}) {
  const row = document.createElement("div")
  if (queryId != null) row.dataset.queryId = String(queryId)
  const element = document.createElement("div")
  element.innerHTML = `
    <form>
      <input data-query-notes-target="informationNeed">
      <textarea data-query-notes-target="notes"></textarea>
    </form>
  `
  row.appendChild(element)
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
    testStores = undefined
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
    expect(flash.show).toHaveBeenCalledWith("notice", expect.stringContaining("saved"))

  })

  it("publishes the saved values onto the live query so the row's tooltip updates without a refresh", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    const liveQuery = { queryId: 2, notes: "old notes", informationNeed: "old need" }
    const upsert = vi.fn()
    testStores = { queries: { liveQuery: vi.fn(() => liveQuery), upsert } }
    const { controller } = controllerFor({ queryId: 2 })
    controller.notesTarget.value = "new notes"
    controller.informationNeedTarget.value = "new need"

    await controller.save({ preventDefault: vi.fn() })

    expect(testStores.queries.liveQuery).toHaveBeenCalledWith("2")
    expect(liveQuery.notes).toBe("new notes")
    expect(liveQuery.informationNeed).toBe("new need")
    expect(upsert).toHaveBeenCalledWith(liveQuery)
  })

  it("does not throw when there is no live query to update (e.g. the row was removed)", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}", { status: 200 }))))
    testStores = { queries: { liveQuery: vi.fn(() => null), upsert: vi.fn() } }
    const { controller } = controllerFor({ queryId: 999 })

    await expect(controller.save({ preventDefault: vi.fn() })).resolves.not.toThrow()
    expect(testStores.queries.upsert).not.toHaveBeenCalled()
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

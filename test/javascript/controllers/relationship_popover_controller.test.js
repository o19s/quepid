import { beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import { createBsPopover } from "utils/bs_popover"
import RelationshipPopoverController from "controllers/relationship_popover_controller"
import { buildControllerFixture } from "../support/controller_fixture"

vi.mock("api/fetch", () => ({ apiFetch: vi.fn() }))
vi.mock("utils/bs_popover", () => ({ createBsPopover: vi.fn() }))

let handle

function buildController() {
  const element = document.createElement("button")
  document.body.append(element)
  const controller = buildControllerFixture(RelationshipPopoverController, {
    element,
    values: { url: "relationship_items/connection/2/embedders", title: "Embedders using Ollama" }
  })
  controller.connect()
  return controller
}

function respond(ok = true) {
  apiFetch.mockResolvedValue({
    ok,
    text: async () => '<div data-relationship-list><a href="embedders/1/edit">MiniLM</a></div>'
  })
}

describe("RelationshipPopoverController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = `
      <template id="relationshipPopoverLoading"><p>Loading…</p></template>
      <template id="relationshipPopoverError"><p>Unable to load this list. Close and try again.</p></template>
    `
    handle = {
      instance: { show: vi.fn(), hide: vi.fn() },
      setBody: vi.fn(),
      dispose: vi.fn()
    }
    createBsPopover.mockReturnValue(handle)
  })

  it("does no fetching or Bootstrap initialization until clicked", () => {
    buildController()

    expect(apiFetch).not.toHaveBeenCalled()
    expect(createBsPopover).not.toHaveBeenCalled()
  })

  it("loads the server-rendered list on click and reuses it on reopening", async () => {
    respond()
    const controller = buildController()

    await controller.toggle()

    expect(createBsPopover).toHaveBeenCalledWith(
      controller.element,
      expect.objectContaining({ placement: "bottom", fallbackPlacements: ["top"] })
    )
    expect(apiFetch).toHaveBeenCalledWith(controller.urlValue, {
      headers: { Accept: "text/html" },
      signal: expect.any(AbortSignal)
    })
    expect(handle.setBody.mock.lastCall[0].querySelector("a").textContent).toBe("MiniLM")
    controller.close()
    await controller.toggle()
    expect(apiFetch).toHaveBeenCalledTimes(1)
  })

  it("shows a failure and retries on the next click", async () => {
    respond(false)
    const controller = buildController()
    await controller.toggle()

    expect(handle.setBody.mock.lastCall[0].textContent).toContain("Unable to load this list")
    controller.close()
    respond()
    await controller.toggle()

    expect(apiFetch).toHaveBeenCalledTimes(2)
    expect(handle.setBody.mock.lastCall[0].textContent).toBe("MiniLM")
  })

  it("aborts a dismissed request and ignores a late response", async () => {
    let resolve
    apiFetch.mockReturnValue(new Promise((done) => (resolve = done)))
    const controller = buildController()
    const pending = controller.toggle()
    const { signal } = apiFetch.mock.lastCall[1]

    controller.close()
    resolve({ ok: true, text: async () => "<div data-relationship-list>Late</div>" })
    await pending

    expect(signal.aborted).toBe(true)
    expect(controller.loadedContent).toBeUndefined()
    expect(handle.setBody.mock.lastCall[0].textContent).toBe("Loading…")
  })

  it("disposes Bootstrap when the page disconnects", async () => {
    respond()
    const controller = buildController()
    await controller.toggle()

    controller.disconnect()

    expect(handle.dispose).toHaveBeenCalledOnce()
    expect(controller.element.getAttribute("aria-expanded")).toBe("false")
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import QueryOptionsModalController from "../../../app/javascript/controllers/query_options_modal_controller"
import { waitForController } from "../support/stimulus_helpers"

describe("QueryOptionsModalController", () => {
  let application

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.setAttribute("data-case-id", "7")
    document.body.innerHTML = `
      <div id="query-options-modal" data-controller="query-options-modal" class="modal fade">
        <textarea data-query-options-modal-target="textarea"></textarea>
        <button type="button" data-action="click->query-options-modal#save">Save</button>
      </div>
    `

    window.bootstrap = {
      Modal: {
        getOrCreateInstance: vi.fn(() => ({ show: vi.fn() })),
        getInstance: vi.fn(() => ({ hide: vi.fn() })),
      },
    }

    application = Application.start()
    application.register("query-options-modal", QueryOptionsModalController)
    await waitForController(application, "#query-options-modal", "query-options-modal")
  })

  afterEach(() => {
    application.stop()
    delete window.bootstrap
    vi.restoreAllMocks()
  })

  function getController() {
    return application.getControllerForElementAndIdentifier(
      document.getElementById("query-options-modal"),
      "query-options-modal",
    )
  }

  it("open loads options JSON into textarea", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ options: { depth: 10 } }),
    })

    try {
      const ctrl = getController()
      await ctrl.open({ queryId: 42 })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("api/cases/7/queries/42/options"),
        expect.anything(),
      )
      expect(ctrl.textareaTarget.value).toContain('"depth": 10')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("open uses empty object when API returns null options", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ options: null }),
    })

    try {
      const ctrl = getController()
      await ctrl.open({ queryId: 1 })
      expect(ctrl.textareaTarget.value.trim()).toBe("{}")
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it("save sends PUT and dispatches query-options-saved", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    const ctrl = getController()
    ctrl.queryId = 99
    ctrl.textareaTarget.value = '{"a":1}'

    const saved = vi.fn()
    document.addEventListener("query-options-saved", saved)

    try {
      await ctrl.save({ preventDefault: vi.fn() })

      const putCall = fetchSpy.mock.calls.find((c) => c[1]?.method === "PUT")
      expect(putCall).toBeDefined()
      expect(String(putCall[0])).toContain("api/cases/7/queries/99/options")
      expect(JSON.parse(putCall[1].body).query.options).toEqual({ a: 1 })
      expect(window.bootstrap.Modal.getInstance).toHaveBeenCalled()
      expect(saved).toHaveBeenCalled()
      expect(saved.mock.calls[0][0].detail.queryId).toBe(99)
    } finally {
      document.removeEventListener("query-options-saved", saved)
      fetchSpy.mockRestore()
    }
  })

  it("save does not PUT invalid JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const ctrl = getController()
    ctrl.queryId = 1
    ctrl.textareaTarget.value = "not-json{"

    await ctrl.save({ preventDefault: vi.fn() })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("save does not PUT when queryId was never set", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const ctrl = getController()
    ctrl.queryId = null
    ctrl.textareaTarget.value = "{}"

    await ctrl.save({ preventDefault: vi.fn() })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("save does not PUT a JSON array (must be an object)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const ctrl = getController()
    ctrl.queryId = 5
    ctrl.textareaTarget.value = "[1,2]"

    await ctrl.save({ preventDefault: vi.fn() })

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

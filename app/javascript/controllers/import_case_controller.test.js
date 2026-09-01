import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ImportCaseController from "./import_case_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

function buildController() {
  const controller = Object.create(ImportCaseController.prototype)
  controller.formTarget = { action: "/api/import/cases" }
  controller.fileInputTarget = { files: [] }
  controller.alertTarget = document.createElement("div")
  controller.submitButtonTarget = document.createElement("button")
  controller.submitTextTarget = document.createElement("span")
  controller.spinnerTarget = document.createElement("span")
  controller.showAlert = vi.fn()
  controller.hideAlert = vi.fn()
  controller.setLoading = vi.fn()
  controller.readFileAsText = vi.fn()
  return controller
}

describe("ImportCaseController submit redirect", () => {
  const originalLocation = window.location

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.dataset.quepidRootUrl = "https://example.com/quepid"
    window.location.href = "http://localhost/cases"
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    delete document.body.dataset.quepidRootUrl
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("redirects to quepid root + /case/:id after successful import", async () => {
    const controller = buildController()
    const file = new File(['{"case_name":"test"}'], "case.json", { type: "application/json" })
    controller.fileInputTarget.files = [file]
    controller.readFileAsText.mockResolvedValue('{"case_name":"test"}')

    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ case_id: 42 }),
    })

    const submitPromise = ImportCaseController.prototype.submit.call(controller, {
      preventDefault: vi.fn(),
    })
    await submitPromise
    await vi.runAllTimersAsync()

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(window.location.href).toBe("https://example.com/quepid/case/42")
  })

  it("reloads the page when the API omits case_id", async () => {
    const reload = vi.fn()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/cases", reload },
    })

    const controller = buildController()
    controller.fileInputTarget.files = [
      new File(['{"case_name":"test"}'], "case.json", { type: "application/json" }),
    ]
    controller.readFileAsText.mockResolvedValue('{"case_name":"test"}')

    apiFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })

    await ImportCaseController.prototype.submit.call(controller, {
      preventDefault: vi.fn(),
    })
    await vi.runAllTimersAsync()

    expect(reload).toHaveBeenCalledOnce()
  })
})

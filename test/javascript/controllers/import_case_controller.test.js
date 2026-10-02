import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import ImportCaseController from "controllers/import_case_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

function buildController() {
  const controller = buildControllerFixture(ImportCaseController, {
    targets: {
      form: { action: "/api/import/cases" },
      fileInput: { files: [] },
      alert: document.createElement("div"),
      submitButton: document.createElement("button"),
      submitText: document.createElement("span"),
      spinner: document.createElement("span")
    }
  })
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

  it("redirects to the API-provided case URL after successful import", async () => {
    const controller = buildController()
    const file = new File(['{"case_name":"test"}'], "case.json", { type: "application/json" })
    controller.fileInputTarget.files = [file]
    controller.readFileAsText.mockResolvedValue('{"case_name":"test"}')

    apiFetch.mockResolvedValue({
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
      ok: true,
      json: () => Promise.resolve({ redirect_url: "https://example.com/quepid/case/42" }),
    })

    const submitPromise = ImportCaseController.prototype.submit.call(controller, {
      preventDefault: vi.fn(),
    })
    await submitPromise
    await vi.runAllTimersAsync()

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(window.location.href).toBe("https://example.com/quepid/case/42")
  })

  it("reloads the page when the API omits redirect_url", async () => {
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
      async text() {
        return JSON.stringify(await this.json()) || ""
      },
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

describe("ImportCaseController validation and errors", () => {
  const jsonFile = () => new File(["{}"], "case.json", { type: "application/json" })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it("accepts .json files by type or extension and blocks anything else", () => {
    const controller = buildController()
    const select = (file) => controller.fileSelected({ target: { files: [file] } })

    select(new File(["x"], "notes.txt", { type: "text/plain" }))
    expect(controller.showAlert).toHaveBeenCalledWith("Please select a valid JSON file.", "danger")
    expect(controller.submitButtonTarget.disabled).toBe(true)

    select(new File(["{}"], "export.json", { type: "" }))
    expect(controller.hideAlert).toHaveBeenCalledOnce()
    expect(controller.submitButtonTarget.disabled).toBe(false)

    controller.submitButtonTarget.disabled = true
    select(new File(["{}"], "export", { type: "application/json" }))
    expect(controller.submitButtonTarget.disabled).toBe(false)
  })

  it("asks for a file before submitting, and rejects unparseable JSON without calling the API", async () => {
    const controller = buildController()

    await controller.submit({ preventDefault: vi.fn() })
    expect(controller.showAlert).toHaveBeenCalledWith("Please select a file to import.", "warning")

    controller.fileInputTarget.files = [jsonFile()]
    controller.readFileAsText.mockResolvedValue("{not json")
    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.showAlert).toHaveBeenLastCalledWith("Invalid JSON file. Please check the file format.", "danger")
    expect(controller.setLoading).toHaveBeenLastCalledWith(false)
    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("posts the case wrapped in a case key", async () => {
    const controller = buildController()
    controller.fileInputTarget.files = [jsonFile()]
    controller.readFileAsText.mockResolvedValue('{"case_name":"test"}')
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, json: () => Promise.resolve({}) })

    await controller.submit({ preventDefault: vi.fn() })

    expect(apiFetch).toHaveBeenCalledWith("/api/import/cases", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ case: { case_name: "test" } })
    }))
  })

  it.each([
    ["the server's error", { error: "Scorer not found" }, "Scorer not found"],
    ["the server's message", { message: "Bad payload" }, "Bad payload"],
    ["field validation errors", { case_name: ["can't be blank"], queries: ["is invalid", "is empty"] }, "case_name can't be blank. queries is invalid, is empty"],
    ["a generic message", {}, "Failed to import case. Please check the file format."]
  ])("reports %s when the import is rejected", async (_label, body, message) => {
    const controller = buildController()
    controller.fileInputTarget.files = [jsonFile()]
    controller.readFileAsText.mockResolvedValue("{}")
    apiFetch.mockResolvedValue({ text: async function () { return JSON.stringify(await this.json()) || "" },  ok: false, json: () => Promise.resolve(body) })

    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.showAlert).toHaveBeenLastCalledWith(message, "danger")
    expect(controller.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("reports a network failure and stops loading", async () => {
    const controller = buildController()
    controller.fileInputTarget.files = [jsonFile()]
    controller.readFileAsText.mockResolvedValue("{}")
    apiFetch.mockRejectedValue(new Error("offline"))
    vi.spyOn(console, "error").mockImplementation(() => {})

    await controller.submit({ preventDefault: vi.fn() })

    expect(controller.showAlert).toHaveBeenLastCalledWith("An error occurred while importing the case. Please try again.", "danger")
    expect(controller.setLoading).toHaveBeenLastCalledWith(false)
  })

  it("toggles the button label, spinner, and disabled state while loading", () => {
    const controller = Object.create(ImportCaseController.prototype)
    controller.submitButtonTarget = document.createElement("button")
    controller.submitTextTarget = document.createElement("span")
    controller.spinnerTarget = document.createElement("span")
    controller.spinnerTarget.classList.add("d-none")

    controller.setLoading(true)
    expect(controller.submitButtonTarget.disabled).toBe(true)
    expect(controller.submitTextTarget.textContent).toBe("Importing...")
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(false)

    controller.setLoading(false)
    expect(controller.submitButtonTarget.disabled).toBe(false)
    expect(controller.submitTextTarget.textContent).toBe("Import")
    expect(controller.spinnerTarget.classList.contains("d-none")).toBe(true)
  })

  it("reads the selected file as text", async () => {
    const controller = Object.create(ImportCaseController.prototype)

    await expect(controller.readFileAsText(new File(['{"a":1}'], "a.json"))).resolves.toBe('{"a":1}')
  })
})


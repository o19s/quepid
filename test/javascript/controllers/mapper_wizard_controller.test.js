import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import MapperWizardController from "controllers/mapper_wizard_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

function buildController(overrides = {}) {
  const controller = buildControllerFixture(MapperWizardController, {
    targets: {
      searchUrl: { value: "https://example.com/search" },
      httpMethod: { value: "GET" },
      testQuery: { value: "" },
      fetchButton: document.createElement("button"),
      htmlPreview: document.createElement("div"),
      htmlPreviewContainer: document.createElement("div"),
      step2: document.createElement("div"),
      status: document.createElement("div")
    },
    values: {
      fetchUrl: "/mapper_wizard/new/fetch_html"
    }
  })
  controller.hasCustomHeadersTarget = false
  controller.hasBasicAuthCredentialTarget = false

  controller.htmlPreviewContainerTarget.style = {}
  controller.step2Target.style = {}

  controller.setButtonLoading = vi.fn()
  controller.showStatus = vi.fn()

  // Editors live on their textarea targets, as CodeMirror's auto-init leaves them.
  const editorTargets = { numberOfResultsEditor: "numberOfResultsMapper", docsEditor: "docsMapper", customHeadersEditor: "customHeaders" }
  const { numberOfResultsEditor, docsEditor, customHeadersEditor, ...rest } = overrides
  Object.assign(controller, rest)
  Object.entries({ numberOfResultsEditor, docsEditor, customHeadersEditor }).forEach(([key, editor]) => {
    if (editor === undefined) return
    const target = editorTargets[key]
    controller[`has${target[0].toUpperCase()}${target.slice(1)}Target`] = true
    controller[`${target}Target`] = { ...(controller[`${target}Target`] || {}), editor }
  })
  return controller
}

describe("MapperWizardController fetchHtml", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("posts the fetch payload to fetchUrlValue and reveals step 2 on success", async () => {
    const controller = buildController({
      hasCustomHeadersTarget: true,
      customHeadersTarget: { value: '{"X-Test": "1"}' },
      hasBasicAuthCredentialTarget: true,
      basicAuthCredentialTarget: { value: "user:pass" },
    })

    apiFetch.mockResolvedValue(jsonResponse({
          success: true,
          html_preview: "<html>preview</html>",
          html_length: 1234,
        }))

    await MapperWizardController.prototype.fetchHtml.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith("/mapper_wizard/new/fetch_html", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        search_url: "https://example.com/search",
        http_method: "GET",
        test_query: "",
        custom_headers: '{"X-Test": "1"}',
        basic_auth_credential: "user:pass",
      }),
    })
    expect(controller.htmlPreviewTarget.textContent).toBe("<html>preview</html>")
    expect(controller.htmlPreviewContainerTarget.style.display).toBe("block")
    expect(controller.step2Target.style.display).toBe("block")
  })

  it("does not call apiFetch when custom headers are invalid JSON", async () => {
    const controller = buildController({
      hasCustomHeadersTarget: true,
      customHeadersTarget: { value: "not-json" },
    })
    controller.showStatus = vi.fn()

    await MapperWizardController.prototype.fetchHtml.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).not.toHaveBeenCalled()
    expect(controller.showStatus).toHaveBeenCalledWith(
      "Custom headers must be valid JSON",
      "error"
    )
  })
})

describe("MapperWizardController error responses", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("still renders the server's own message from a 422 JSON body", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValue(jsonResponse({ success: false, error: "Bad URL" }, 422))

    await MapperWizardController.prototype.fetchHtml.call(controller, { preventDefault: vi.fn() })

    expect(controller.showStatus).toHaveBeenCalledWith("Bad URL", "error")
  })

  it("reports a readable error when the server returns a non-JSON error page", async () => {
    const controller = buildController()
    apiFetch.mockResolvedValue(new Response("<html>boom</html>", { status: 500 }))

    await MapperWizardController.prototype.fetchHtml.call(controller, { preventDefault: vi.fn() })

    expect(controller.showStatus).toHaveBeenCalledWith("Error: Request failed (500)", "error")
  })
})

describe("MapperWizardController save", () => {
  const originalLocation = window.location

  beforeEach(() => {
    window.location.href = "http://localhost/mapper_wizard/new"
  })

  afterEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    })
  })

  it("posts save payload to saveUrlValue and redirects on success", async () => {
    const controller = buildController({
      endpointNameTarget: { value: "Solr Books" },
      numberOfResultsEditor: {
        getValue: () => "numberOfResultsMapper = function() { return 1; }",
      },
      docsEditor: {
        getValue: () => "docsMapper = function() { return []; }",
      },
      proxyRequestsTarget: { checked: true },
      hasTeamCheckboxTarget: true,
      teamCheckboxTargets: [
        { checked: true, value: "3" },
        { checked: false, value: "7" },
      ],
      saveButtonTarget: document.createElement("button"),
      saveUrlValue: "/mapper_wizard/new/save",
    })

    apiFetch.mockResolvedValue(jsonResponse({
          success: true,
          redirect_url: "/search_endpoints/42",
        }))

    await MapperWizardController.prototype.save.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith("/mapper_wizard/new/save", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Solr Books",
        number_of_results_mapper: "numberOfResultsMapper = function() { return 1; }",
        docs_mapper: "docsMapper = function() { return []; }",
        endpoint_url: "https://example.com/search",
        api_method: "GET",
        proxy_requests: true,
        test_query: "",
        custom_headers: "",
        basic_auth_credential: "",
        team_ids: [3],
      }),
    })
    expect(window.location.href).toBe("http://localhost/search_endpoints/42")
  })
})

describe("MapperWizardController showStep3Manually", () => {
  it("reveals step 3 and scrolls it into view", () => {
    const controller = buildController()
    controller.step3Target = document.createElement("div")
    controller.step3Target.style = {}
    controller.step3Target.scrollIntoView = vi.fn()

    MapperWizardController.prototype.showStep3Manually.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(controller.step3Target.style.display).toBe("block")
    expect(controller.step3Target.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
  })
})

describe("MapperWizardController testMapper", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("posts mapper_type and code to testUrlValue and shows success output", async () => {
    const controller = buildController({
      testUrlValue: "/mapper_wizard/new/test_mapper",
    })
    const resultTarget = document.createElement("div")
    const button = document.createElement("button")
    const logsTarget = document.createElement("div")
    const logsContainerTarget = document.createElement("div")
    logsContainerTarget.style = {}
    controller.showStatus = vi.fn()

    apiFetch.mockResolvedValue(jsonResponse({
          success: true,
          result: 42,
          logs: [],
        }))

    await MapperWizardController.prototype.testMapper.call(
      controller,
      "numberOfResultsMapper",
      { getValue: () => "numberOfResultsMapper = function() { return 42; }" },
      null,
      resultTarget,
      button,
      logsTarget,
      logsContainerTarget
    )

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith("/mapper_wizard/new/test_mapper", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        mapper_type: "numberOfResultsMapper",
        code: "numberOfResultsMapper = function() { return 42; }",
      }),
    })
    expect(resultTarget.innerHTML).toContain("42")
    expect(controller.showStatus).toHaveBeenCalledWith(
      "numberOfResultsMapper test successful!",
      "success"
    )
  })

  it("shows server error text when the mapper test fails", async () => {
    const controller = buildController({
      testUrlValue: "/mapper_wizard/new/test_mapper",
    })
    const resultTarget = document.createElement("div")
    const button = document.createElement("button")
    const logsTarget = document.createElement("div")
    const logsContainerTarget = document.createElement("div")
    logsContainerTarget.style = {}
    controller.showStatus = vi.fn()

    apiFetch.mockResolvedValue(jsonResponse({
          success: false,
          error: "ReferenceError: foo is not defined",
        }))

    await MapperWizardController.prototype.testMapper.call(
      controller,
      "docsMapper",
      { getValue: () => "docsMapper = function() { return foo; }" },
      null,
      resultTarget,
      button,
      logsTarget,
      logsContainerTarget
    )

    expect(resultTarget.innerHTML).toContain("ReferenceError: foo is not defined")
    expect(controller.showStatus).toHaveBeenCalledWith("docsMapper test failed", "error")
  })
})

describe("MapperWizardController AI generation and refinement", () => {
  const editor = (value = "") => ({ getValue: vi.fn(() => value), setValue: vi.fn() })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  function aiController(overrides = {}) {
    return buildController({
      apiKeyTarget: { value: "  sk-test  " },
      generateButtonTarget: document.createElement("button"),
      generateUrlValue: "/mapper_wizard/new/generate",
      refineUrlValue: "/mapper_wizard/new/refine",
      step3Target: { style: {} },
      ...overrides
    })
  }

  it("warns about truncated generation and refinement while applying the returned code", async () => {
    const docsEditor = editor()
    const controller = aiController({ docsEditor })
    apiFetch.mockResolvedValue(jsonResponse({ success: true, docs_mapper: "d()", number_of_results_mapper: "n()", truncated: true, original_length: 90000, sent_length: 50000 }))
    await controller.generateMappers({ preventDefault: vi.fn() })
    expect(docsEditor.setValue).toHaveBeenCalledWith("d()")
    expect(controller.showStatus).toHaveBeenLastCalledWith(expect.stringContaining("90,000 to 50,000"), "warning")

    apiFetch.mockResolvedValue(jsonResponse({ success: true, code: "refined()", truncated: true, original_length: 90000, sent_length: 30000 }))
    await controller.refineMapper("docsMapper", docsEditor, null, "fix", document.createElement("button"))
    expect(docsEditor.setValue).toHaveBeenLastCalledWith("refined()")
    expect(controller.showStatus).toHaveBeenLastCalledWith(expect.stringContaining("90,000 to 30,000"), "warning")
  })

  it("requires an OpenAI key before generating or refining", async () => {
    const controller = aiController({ apiKeyTarget: { value: "   " } })

    await controller.generateMappers({ preventDefault: vi.fn() })
    await controller.refineMapper("docsMapper", editor("x"), null, "faster", document.createElement("button"))

    expect(apiFetch).not.toHaveBeenCalled()
    expect(controller.showStatus).toHaveBeenCalledTimes(2)
    expect(controller.showStatus).toHaveBeenCalledWith("Please enter your OpenAI API key", "error")
  })

  it("fills both editors with the generated mappers and reveals step 3", async () => {
    const numberOfResultsEditor = editor()
    const docsEditor = editor()
    const controller = aiController({ numberOfResultsEditor, docsEditor })
    apiFetch.mockResolvedValue(jsonResponse({ success: true, number_of_results_mapper: "n()", docs_mapper: "d()" }))

    await controller.generateMappers({ preventDefault: vi.fn() })

    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({ api_key: "sk-test" })
    expect(apiFetch.mock.calls[0][0]).toBe("/mapper_wizard/new/generate")
    expect(numberOfResultsEditor.setValue).toHaveBeenCalledWith("n()")
    expect(docsEditor.setValue).toHaveBeenCalledWith("d()")
    expect(controller.step3Target.style.display).toBe("block")
    expect(controller.showStatus).toHaveBeenLastCalledWith("Mapper functions generated successfully!", "success")
    expect(controller.setButtonLoading).toHaveBeenNthCalledWith(1, controller.generateButtonTarget, true)
    expect(controller.setButtonLoading).toHaveBeenLastCalledWith(controller.generateButtonTarget, false)
  })

  it("falls back to the plain textareas when the code editors aren't ready", async () => {
    const controller = aiController({
      hasNumberOfResultsMapperTarget: true,
      numberOfResultsMapperTarget: { value: "" },
      hasDocsMapperTarget: true,
      docsMapperTarget: { value: "" }
    })
    apiFetch.mockResolvedValue(jsonResponse({ success: true, number_of_results_mapper: "n()", docs_mapper: "d()" }))

    await controller.generateMappers({ preventDefault: vi.fn() })

    expect(controller.numberOfResultsMapperTarget.value).toBe("n()")
    expect(controller.docsMapperTarget.value).toBe("d()")
  })

  it.each([
    ["the server's error from a 422 body", () => jsonResponse({ success: false, error: "Quota exceeded" }, 422), "Quota exceeded"],
    ["a generic message without one", () => jsonResponse({ success: false }), "Failed to generate mappers"],
    ["a network failure", () => Promise.reject(new Error("offline")), "Error: offline"]
  ])("reports %s when generation fails, and leaves step 3 hidden", async (_label, respond, message) => {
    const controller = aiController()
    apiFetch.mockImplementation(respond)

    await controller.generateMappers({ preventDefault: vi.fn() })

    expect(controller.showStatus).toHaveBeenLastCalledWith(message, "error")
    expect(controller.step3Target.style.display).toBeUndefined()
    expect(controller.setButtonLoading).toHaveBeenLastCalledWith(controller.generateButtonTarget, false)
  })

  it("refines the current code with the user's feedback and replaces it", async () => {
    const docsEditor = editor("docsMapper = old")
    const button = document.createElement("button")
    const controller = aiController()
    apiFetch.mockResolvedValue(jsonResponse({ success: true, code: "docsMapper = new" }))

    await controller.refineMapper("docsMapper", docsEditor, null, "handle empty hits", button)

    expect(apiFetch.mock.calls[0][0]).toBe("/mapper_wizard/new/refine")
    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toEqual({
      mapper_type: "docsMapper", current_code: "docsMapper = old", feedback: "handle empty hits", api_key: "sk-test"
    })
    expect(docsEditor.setValue).toHaveBeenCalledWith("docsMapper = new")
    expect(controller.showStatus).toHaveBeenLastCalledWith("docsMapper refined successfully!", "success")
    expect(controller.setButtonLoading).toHaveBeenLastCalledWith(button, false)
  })

  it("refines from and into the textarea when there is no editor, and reports a failed refinement", async () => {
    const textarea = { value: "numberOfResultsMapper = old" }
    const controller = aiController()
    apiFetch.mockResolvedValueOnce(jsonResponse({ success: true, code: "numberOfResultsMapper = new" }))
      .mockResolvedValueOnce(jsonResponse({ success: false }))

    await controller.refineMapper("numberOfResultsMapper", null, textarea, "fix", document.createElement("button"))
    expect(JSON.parse(apiFetch.mock.calls[0][1].body).current_code).toBe("numberOfResultsMapper = old")
    expect(textarea.value).toBe("numberOfResultsMapper = new")

    await controller.refineMapper("numberOfResultsMapper", null, textarea, "fix", document.createElement("button"))
    expect(controller.showStatus).toHaveBeenLastCalledWith("Refinement failed", "error")
    expect(textarea.value).toBe("numberOfResultsMapper = new")
  })

  it.each([
    ["refineDocsMapper", "docsMapper", "docsEditor", "refineDocsButtonTarget", "docsMapperTarget"],
    ["refineNumberOfResultsMapper", "numberOfResultsMapper", "numberOfResultsEditor", "refineNumberButtonTarget", "numberOfResultsMapperTarget"]
  ])("%s only refines when the user gives feedback", async (action, mapperType, editorKey, buttonKey, textareaKey) => {
    const controller = aiController({ [editorKey]: editor("old"), [buttonKey]: document.createElement("button") })
    controller.refineMapper = vi.fn()

    vi.stubGlobal("prompt", vi.fn(() => null))
    await controller[action]({ preventDefault: vi.fn() })
    expect(controller.refineMapper).not.toHaveBeenCalled()

    vi.stubGlobal("prompt", vi.fn(() => "be stricter"))
    await controller[action]({ preventDefault: vi.fn() })
    expect(controller.refineMapper).toHaveBeenCalledWith(mapperType, controller[editorKey], controller[textareaKey], "be stricter", controller[buttonKey])
  })
})

describe("MapperWizardController save validation and errors", () => {
  afterEach(() => vi.clearAllMocks())

  function saveController(overrides = {}) {
    return buildController({
      endpointNameTarget: { value: "Books" },
      numberOfResultsEditor: { getValue: () => "n()" },
      docsEditor: { getValue: () => "d()" },
      proxyRequestsTarget: { checked: false },
      hasTeamCheckboxTarget: false,
      saveButtonTarget: document.createElement("button"),
      saveUrlValue: "/mapper_wizard/new/save",
      ...overrides
    })
  }

  it("requires a name and both mapper functions before saving", async () => {
    const unnamed = saveController({ endpointNameTarget: { value: "  " } })
    await unnamed.save({ preventDefault: vi.fn() })
    expect(unnamed.showStatus).toHaveBeenCalledWith("Please enter a name for the search endpoint", "error")

    const missingDocs = saveController({ docsEditor: { getValue: () => "   " } })
    await missingDocs.save({ preventDefault: vi.fn() })
    expect(missingDocs.showStatus).toHaveBeenCalledWith("Both mapper functions are required", "error")

    expect(apiFetch).not.toHaveBeenCalled()
  })

  it("sends POST, test query, headers, and credentials from the form fields", async () => {
    const controller = saveController({
      httpMethodTarget: { value: "POST" },
      testQueryTarget: { value: ' {"q":"x"} ' },
      hasCustomHeadersTarget: true,
      customHeadersTarget: { value: ' {"X-Key":"k"} ' },
      hasBasicAuthCredentialTarget: true,
      basicAuthCredentialTarget: { value: " user:pass " }
    })
    apiFetch.mockResolvedValue(jsonResponse({ success: false, errors: ["x"] }))

    await controller.save({ preventDefault: vi.fn() })

    expect(JSON.parse(apiFetch.mock.calls[0][1].body)).toMatchObject({
      api_method: "POST", test_query: '{"q":"x"}', custom_headers: '{"X-Key":"k"}', basic_auth_credential: "user:pass", team_ids: []
    })
  })

  it.each([
    [{ success: false, errors: ["Name has already been taken", "URL is invalid"] }, "Name has already been taken, URL is invalid"],
    [{ success: false }, "Save failed"]
  ])("reports the save errors and re-enables Save", async (body, message) => {
    const controller = saveController()
    apiFetch.mockResolvedValue(jsonResponse(body, 422))

    await controller.save({ preventDefault: vi.fn() })

    expect(controller.showStatus).toHaveBeenLastCalledWith(message, "error")
    expect(controller.setButtonLoading).toHaveBeenLastCalledWith(controller.saveButtonTarget, false)
  })
})

describe("MapperWizardController helpers", () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  function realHelpers(overrides = {}) {
    const controller = buildController(overrides)
    delete controller.showStatus
    delete controller.setButtonLoading
    return controller
  }

  it("shows mapper logs with a level label, escaping their text, and hides an empty log", () => {
    const controller = realHelpers()
    const logs = document.createElement("div")
    const container = { style: {} }

    controller.displayLogs([
      { level: "error", message: "<b>bad</b>" },
      { level: "warn", message: "careful" },
      { level: "info", message: "fyi" },
      { level: "log", message: "plain" }
    ], logs, container)

    expect(container.style.display).toBe("block")
    expect([...logs.children].map((el) => [el.className, el.textContent])).toEqual([
      ["text-danger", "[ERROR] <b>bad</b>"],
      ["text-warning", "[WARN] careful"],
      ["text-info", "[INFO] fyi"],
      ["text-light", "[LOG] plain"]
    ])
    expect(logs.querySelector("b")).toBeNull()

    controller.displayLogs([], logs, container)
    expect(container.style.display).toBe("none")
  })

  it("shows the server-rendered test query hint for the chosen HTTP method", () => {
    const hint = (httpMethod, placeholder) => {
      const element = document.createElement("div")
      element.dataset.httpMethod = httpMethod
      element.dataset.placeholder = placeholder
      return element
    }
    const postHint = hint("POST", '{"query": "test", "size": 10}')
    const getHint = hint("GET", "q=shirts&rows=10")
    const controller = realHelpers({
      testQueryHintTargets: [postHint, getHint],
      testQueryTarget: {}
    })

    controller.httpMethodTarget.value = "POST"
    controller.updateTestQueryHint()
    expect([postHint.hidden, getHint.hidden]).toEqual([false, true])
    expect(controller.testQueryTarget.placeholder).toBe('{"query": "test", "size": 10}')

    controller.httpMethodTarget.value = "GET"
    controller.updateTestQueryHint()
    expect([postHint.hidden, getHint.hidden]).toEqual([true, false])
    expect(controller.testQueryTarget.placeholder).toBe("q=shirts&rows=10")
  })

  it("styles status messages by type and auto-hides only success", () => {
    vi.useFakeTimers()
    const controller = realHelpers()

    controller.showStatus("Nope", "error")
    expect(controller.statusTarget.className).toBe("alert alert-danger")
    expect(controller.statusTarget.textContent).toBe("Nope")

    controller.showStatus("Working", "info")
    expect(controller.statusTarget.className).toBe("alert alert-info")
    vi.advanceTimersByTime(10000)
    expect(controller.statusTarget.style.display).toBe("block")

    controller.showStatus("Done", "success")
    expect(controller.statusTarget.className).toBe("alert alert-success")
    vi.advanceTimersByTime(5000)
    expect(controller.statusTarget.style.display).toBe("none")
  })

  it("shows a spinner while loading and restores the button label after", () => {
    const controller = realHelpers()
    const button = document.createElement("button")
    button.innerHTML = "Generate"

    controller.setButtonLoading(button, true)
    expect(button.disabled).toBe(true)
    expect(button.textContent).toContain("Loading...")

    controller.setButtonLoading(button, false)
    expect(button.disabled).toBe(false)
    expect(button.innerHTML).toBe("Generate")
  })

  it("reads each code editor from its textarea when used, including ones attached after connect", () => {
    const docs = document.createElement("textarea")
    const controller = realHelpers({
      hasNumberOfResultsMapperTarget: true,
      numberOfResultsMapperTarget: { editor: "n-editor" },
      hasDocsMapperTarget: true,
      docsMapperTarget: docs,
      hasCustomHeadersTarget: false
    })

    expect(controller.numberOfResultsEditor).toBe("n-editor")
    expect(controller.docsEditor).toBe(null)
    expect(controller.customHeadersEditor).toBe(null)

    docs.editor = "d-editor"
    expect(controller.docsEditor).toBe("d-editor")
  })

  it("copies the HTML preview, briefly confirming on the button", async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const controller = realHelpers()
    controller.htmlPreviewTarget.textContent = "<html>results</html>"
    const button = document.createElement("button")
    button.innerHTML = "Copy"

    await controller.copyHtmlPreview({ preventDefault: vi.fn(), currentTarget: button })

    expect(writeText).toHaveBeenCalledWith("<html>results</html>")
    expect(button.textContent).toContain("Copied!")
    vi.advanceTimersByTime(2000)
    expect(button.innerHTML).toBe("Copy")
  })

  it("reports an empty preview or a clipboard failure instead of copying", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("denied")))
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
    const controller = buildController()
    const event = () => ({ preventDefault: vi.fn(), currentTarget: document.createElement("button") })

    await controller.copyHtmlPreview(event())
    expect(controller.showStatus).toHaveBeenLastCalledWith("No content to copy", "error")
    expect(writeText).not.toHaveBeenCalled()

    controller.htmlPreviewTarget.textContent = "x"
    await controller.copyHtmlPreview(event())
    expect(controller.showStatus).toHaveBeenLastCalledWith("Failed to copy: denied", "error")
  })
})


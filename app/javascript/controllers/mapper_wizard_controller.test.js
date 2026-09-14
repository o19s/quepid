import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import MapperWizardController from "./mapper_wizard_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

function buildController(overrides = {}) {
  const controller = Object.create(MapperWizardController.prototype)

  controller.searchUrlTarget = { value: "https://example.com/search" }
  controller.hasHttpMethodTarget = true
  controller.httpMethodTarget = { value: "GET" }
  controller.hasTestQueryTarget = true
  controller.testQueryTarget = { value: "" }
  controller.hasCustomHeadersTarget = false
  controller.hasBasicAuthCredentialTarget = false

  controller.fetchButtonTarget = document.createElement("button")
  controller.fetchUrlValue = "/mapper_wizard/new/fetch_html"
  controller.htmlPreviewTarget = document.createElement("div")
  controller.htmlPreviewContainerTarget = document.createElement("div")
  controller.htmlPreviewContainerTarget.style = {}
  controller.step2Target = document.createElement("div")
  controller.step2Target.style = {}

  controller.statusTarget = document.createElement("div")
  controller.hasStatusTarget = true
  controller.captureEditors = vi.fn()
  controller.setButtonLoading = vi.fn()

  Object.assign(controller, overrides)
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

    apiFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          html_preview: "<html>preview</html>",
          html_length: 1234,
        }),
    })

    await MapperWizardController.prototype.fetchHtml.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith("/mapper_wizard/new/fetch_html", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    apiFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          redirect_url: "/search_endpoints/42",
        }),
    })

    await MapperWizardController.prototype.save.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).toHaveBeenCalledOnce()
    expect(apiFetch).toHaveBeenCalledWith("/mapper_wizard/new/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

    apiFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: true,
          result: 42,
          logs: [],
        }),
    })

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
      headers: { "Content-Type": "application/json" },
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

    apiFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          success: false,
          error: "ReferenceError: foo is not defined",
        }),
    })

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

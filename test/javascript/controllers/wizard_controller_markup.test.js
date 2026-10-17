import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import WizardController from "controllers/wizard_controller"
import { getWizardCapabilities } from "utils/core_capabilities_runtime"
import { importSnapshotsToCase } from "utils/snapshot_import"
import { persistQueries } from "utils/query_lifecycle"

vi.mock("@hotwired/stimulus", () => import("../../../node_modules/@hotwired/stimulus/dist/stimulus.js"))
vi.mock("utils/core_capabilities_runtime", () => ({ getWizardCapabilities: vi.fn() }))
vi.mock("utils/snapshot_import", () => ({ importSnapshotsToCase: vi.fn() }))
vi.mock("utils/query_lifecycle", () => ({ persistQueries: vi.fn() }))
vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: () => ({ hide: hideModal }) }))

const fixture = JSON.parse(readFileSync("test/fixtures/files/wizard_markup.json", "utf8"))
const hideModal = vi.fn()

// Migrated from wizard_controller.test.js's hand-built guidance/suggestion tests.
// Rails renders both fixtures; no targets, actions or controller methods are replaced.
// This tests DOM wiring and hidden states, not CSS layout or browser actionability.
describe("wizard Rails markup with real Stimulus", () => {
  let application
  let element
  let controller
  let capability
  let validateUrl
  let stimulusErrors

  const find = selector => {
    const node = element.querySelector(selector)
    expect(node, `Required wizard control: ${selector}`).not.toBeNull()
    return node
  }
  const shown = node => node.closest("[hidden]") === null
  const input = (selector, value, type = "input") => {
    const node = find(selector)
    node.value = value
    node.dispatchEvent(new Event(type, { bubbles: true }))
    return node
  }
  const step = () => [...element.querySelectorAll("section")].find(shown)
  const next = () => {
    const button = [...step().querySelectorAll("button")].find(node => node.textContent.trim().startsWith("Continue"))
    expect(button).toBeDefined()
    expect(button.disabled).toBe(false)
    button.click()
  }
  const engine = name => input(`input[name="wizardEngine"][value="${name}"]`, name, "change")
  const ping = () => find("button[data-wizard-target~='pingButton']").click()
  const endpoint = () => {
    next()
    expect(step().textContent).toContain("Name Your Case")
    input("#wizardCaseName", "Wiring test")
    next()
    expect(step().textContent).toContain("What Search Endpoint")
  }
  const finishStep = async () => {
    await mount()
    endpoint()
    next()
    await vi.waitFor(() => expect(step().textContent).toContain("How Should We Display"))
    next()
    input('[aria-label="Search query"]', "star wars")
    next()
    expect(step().textContent).toContain("That's It!")
  }
  const mount = async (variant = "default") => {
    document.body.dataset.quepidRootUrl = "http://www.example.com/"
    document.body.innerHTML = readFileSync(`test/fixtures/files/${fixture[variant]}`, "utf8")
    element = document.querySelector("#wizardModal")
    application = Application.start()
    stimulusErrors = []
    application.handleError = error => stimulusErrors.push(error)
    application.register("wizard", WizardController)
    await vi.waitFor(() => {
      controller = application.getControllerForElementAndIdentifier(element, "wizard")
      expect(controller?.loaded).toBe(true)
    })
    expect(step().textContent).toContain("Welcome To Quepid")
  }

  beforeEach(() => {
    vi.clearAllMocks()
    validateUrl = vi.fn().mockResolvedValue(undefined)
    capability = {
      settings: {
        editable: () => ({ searchEngine: "solr", searchUrl: "http://solr/select" }),
        pick: preset => ({
          searchEngine: preset,
          apiMethod: "GET",
          insecureSearchUrl: "http://solr/select",
          secureSearchUrl: "https://solr/select",
          searchUrl: "http://engine/search",
          queryParams: "q=#$query##",
          urlFormat: "http://host/index/select",
          supportsBasicAuth: preset !== "algolia",
          titleField: "title",
          idField: "id",
          additionalFields: []
        }),
        registerMapper: vi.fn(),
        applicable: () => ({ tryNo: 1 }),
        update: vi.fn().mockResolvedValue(undefined),
        demoChosen: () => true,
        proxyUrlFor: () => "http://www.example.com/proxy/4/",
        troubleshootingWikiUrl: () => "https://example.com/troubleshooting"
      },
      endpoints: {
        list: vi.fn().mockResolvedValue(undefined),
        isEsOrOs: () => false,
        all: () => [
          { id: 7, name: "Existing API", searchEngine: "searchapi", endpointUrl: "http://api/search", apiMethod: "GET" },
          { id: 8, name: "Offline", searchEngine: "static" }
        ]
      },
      mapper: { list: vi.fn().mockResolvedValue(undefined), all: () => [] },
      user: { current: () => ({ completedCaseWizard: false }), shownIntroWizard: vi.fn().mockResolvedValue(undefined) },
      navigation: {
        needToRedirectProtocol: vi.fn().mockReturnValue(false),
        swapUrlTls: () => ["https://www.example.com", "https"],
        caseNo: () => 123,
        navigateTo: vi.fn()
      },
      search: { createValidator: vi.fn(() => ({ validateUrl, fields: ["id", "title", "body", "year", "poster_path", "cast"], idFields: ["id"] })) },
      case: { selected: () => ({ id: 123 }), delete: vi.fn().mockResolvedValue(undefined), rename: vi.fn().mockResolvedValue(undefined) }
    }
    getWizardCapabilities.mockResolvedValue({ capability })
  })

  afterEach(async () => {
    element?.remove()
    if (application && element) {
      await vi.waitFor(() => {
        expect(application.getControllerForElementAndIdentifier(element, "wizard")).toBeNull()
        expect(controller.connected).toBe(false)
      })
    }
    application?.stop()
    document.body.replaceChildren()
    delete document.body.dataset.quepidRootUrl
    vi.unstubAllGlobals()
    expect(stimulusErrors || []).toEqual([])
    application = null
    element = null
  })

  it("uses fixtures rendered from the current partials", () => {
    for (const [path, digest] of Object.entries(fixture.sources)) {
      expect(createHash("sha256").update(readFileSync(path)).digest("hex"),
        `Stale Rails fixture: run RAILS_ENV=test bin/rails test:render_wizard_fixture in the server container (${path})`).toBe(digest)
    }
  })

  it("pings without advancing and continues to the discovered field choices", async () => {
    await mount()
    endpoint()
    ping()
    await vi.waitFor(() => expect(shown(find(".alert-success"))).toBe(true))
    expect(step().textContent).toContain("What Search Endpoint")
    next()
    await vi.waitFor(() => expect(step().textContent).toContain("How Should We Display"))
    expect([...find("#wizardSearchFields").options].map(option => option.value)).toEqual(["id", "title", "body", "year", "poster_path", "cast"])
    expect([...find("#wizardIdFields").options].map(option => option.value)).toEqual(["id"])
    expect(find("#wizardTitleField").value).toBe("title")
    expect(find("#wizardIdField").value).toBe("id")
  })

  it.each(["solr", "es", "os", "searchapi"])("shows %s troubleshooting and hides proxy hints after proxying", async name => {
    await mount()
    endpoint()
    engine(name)
    validateUrl.mockRejectedValue(new Error("Network error"))
    ping()
    const panel = find('[data-wizard-when="url-invalid"]')
    await vi.waitFor(() => expect(shown(panel)).toBe(true))
    for (const other of ["solr", "es", "os", "searchapi"]) {
      expect(shown(panel.querySelector(`[data-wizard-when="${other}"]`))).toBe(other === name)
    }
    const hints = panel.querySelector(`[data-wizard-when="${name}"] [data-wizard-when="no-proxy"]`)
    expect(shown(hints)).toBe(true)
    find("#wizardProxy").click()
    ping()
    await vi.waitFor(() => expect(shown(panel)).toBe(true))
    expect(shown(hints)).toBe(false)
  })

  it("replaces connection troubleshooting with TLS guidance on a protocol mismatch", async () => {
    await mount()
    endpoint()
    validateUrl.mockRejectedValue(new Error("Network error"))
    ping()
    await vi.waitFor(() => expect(shown(find('[data-wizard-when="url-invalid"]'))).toBe(true))
    capability.navigation.needToRedirectProtocol.mockReturnValue(true)
    input('[data-wizard-target="searchUrl"]', "https://engine/search")
    expect(shown(find('[data-wizard-target="tlsWarning"]'))).toBe(true)
    expect(shown(find('[data-wizard-when="url-invalid"]'))).toBe(false)
    expect(shown(find('[data-wizard-target~="endpointContinue"]'))).toBe(false)
  })

  it("shows mapper errors without offering Skip Validation, but permits skipping a connection error", async () => {
    await mount()
    endpoint()
    const skip = find('[data-wizard-target="skipButton"]')
    expect(shown(skip)).toBe(false)
    validateUrl.mockRejectedValue(new Error("MapperError: docsMapper is not a function"))
    ping()
    await vi.waitFor(() => expect(shown(find('[data-wizard-when="mapper-invalid"]'))).toBe(true))
    expect(find('[data-wizard-target="mapperMessage"]').textContent).toContain("docsMapper")
    expect(shown(find('[data-wizard-when="url-invalid"]'))).toBe(false)
    expect(shown(skip)).toBe(false)
    validateUrl.mockRejectedValue(new Error("Network error"))
    ping()
    await vi.waitFor(() => expect(shown(skip)).toBe(true))
    skip.click()
    expect(step().textContent).toContain("How Should We Display")
  })

  it("requires a mapper for a new generic API, but permits an existing endpoint", async () => {
    await mount()
    endpoint()
    engine("searchapi")
    expect(shown(find('[data-wizard-when="mapper-required"]'))).toBe(true)
    expect(shown(find('[data-wizard-target~="endpointContinue"]'))).toBe(false)
    expect(shown(find('[data-wizard-target~="pingButton"]'))).toBe(true)
    input("#wizardEndpoint", "7", "change")
    expect(shown(find('[data-wizard-when="mapper-required"]'))).toBe(false)
    expect(shown(find('[data-wizard-target~="endpointContinue"]'))).toBe(true)
  })

  it("requires a test query before continuing with an existing Search API endpoint", async () => {
    await mount()
    endpoint()
    input("#wizardEndpoint", "7", "change")
    const continueButton = find('[data-wizard-target~="endpointContinue"]')
    expect(shown(find('[data-wizard-when="test-query-required"]'))).toBe(true)
    expect(continueButton.disabled).toBe(true)
    expect(find("button[data-wizard-target~='pingButton']").disabled).toBe(false)
    input("#wizardTestQuery", "shirts")
    expect(shown(find('[data-wizard-when="test-query-required"]'))).toBe(false)
    expect(continueButton.disabled).toBe(false)
  })

  it("submits the case name and adds a query on Enter", async () => {
    await mount()
    next()
    input("#wizardCaseName", "Enter test")
    find("#wizardCaseName").form.requestSubmit()
    expect(step().textContent).toContain("What Search Endpoint")
    next()
    await vi.waitFor(() => expect(step().textContent).toContain("How Should We Display"))
    next()
    input('[aria-label="Search query"]', "star wars")
    find('[aria-label="Search query"]').form.requestSubmit()
    expect(step().textContent).toContain("Add Your Search Queries")
    expect(find('[data-wizard-target="queryList"]').textContent).toContain("star wars")
  })

  it("deletes the draft before following the Rails-provided Mapper Wizard URL", async () => {
    await mount()
    endpoint()
    engine("searchapi")
    const assign = vi.fn()
    vi.stubGlobal("location", { assign })
    find('[data-action="wizard#goToMapperWizard"]').click()
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith("http://www.example.com/search_endpoints/mapper_wizard"))
    expect(capability.case.delete).toHaveBeenCalledWith({ id: 123 })
    expect(hideModal).toHaveBeenCalledOnce()
  })

  it("keeps static Continue disabled until the file change imports its CSV", async () => {
    await mount()
    endpoint()
    engine("static")
    const proceed = find('[data-wizard-target~="endpointContinue"]')
    expect(proceed.disabled).toBe(true)
    expect(shown(find('[data-wizard-target="staticFile"]'))).toBe(true)
    expect(shown(find('[data-wizard-target="searchUrl"]'))).toBe(false)
    importSnapshotsToCase.mockResolvedValue([{ id: 42 }])
    Object.defineProperty(find('input[type="file"]'), "files", {
      value: [{ text: async () => "Query Text,Doc ID,Doc Position,title\nstar wars,1,1,Star Wars" }]
    })
    find('input[type="file"]').dispatchEvent(new Event("change", { bubbles: true }))
    await vi.waitFor(() => expect(proceed.disabled).toBe(false))
    expect(controller.snapshotSearchUrlTemplateValue).toContain("/123/snapshots/__SNAPSHOT_ID__/search")
    expect(controller.settings.searchUrl).toContain("/123/snapshots/42/search")
  })

  it("shows URL and auth guidance only for engines that support it, and warns about static sharing", async () => {
    await mount()
    endpoint()
    expect(shown(find('[data-wizard-when="static-endpoints"]'))).toBe(true)
    expect(find('[data-wizard-target="urlFormat"]').textContent).toBe("http://host/index/select")
    expect(shown(find('[data-wizard-target="basicAuth"]'))).toBe(true)
    engine("algolia")
    expect(shown(find('[data-wizard-target="basicAuth"]'))).toBe(false)
    input("#wizardEndpoint", "7", "change")
    expect(shown(find('[data-wizard-when="url-format"]'))).toBe(false)
  })

  it("offers the API method only for Solr, leaving other engines' preset method alone", async () => {
    await mount()
    endpoint()
    const apiMethod = find("#wizardApiMethod")
    expect(shown(apiMethod)).toBe(true)
    expect([...apiMethod.options].map(option => option.value)).toEqual(["JSONP", "GET"])
    for (const name of ["es", "os", "vectara", "algolia", "searchapi"]) {
      engine(name)
      expect(shown(apiMethod), name).toBe(false)
    }
    engine("solr")
    expect(shown(apiMethod)).toBe(true)
  })

  it("fills the actual Solr curl command and troubleshooting links from entered settings", async () => {
    await mount()
    endpoint()
    input('[data-wizard-target="basicAuth"]', "u:p")
    find("#wizardProxy").click()
    expect(find('[data-wizard-target="curlAuth"]').textContent).toBe("-u u:p ")
    expect(find('[data-wizard-target="solrConfigUrl"]').textContent).toBe("http://solr/config")
    expect(find('[data-wizard-target="endpointLink"]').href).toBe("http://www.example.com/proxy/4/http://solr/select")
    expect(find('[data-wizard-target="wikiLink"]').href).toBe("https://example.com/troubleshooting")
  })

  it("adds a clicked discovered field once and filters suggestions while preserving modifiers", async () => {
    await mount()
    endpoint()
    next()
    await vi.waitFor(() => expect(step().textContent).toContain("How Should We Display"))
    const suggestions = find('[data-wizard-target="fieldSuggestions"]')
    expect([...suggestions.children].map(node => node.textContent)).toEqual(["body", "year", "poster_path", "cast"])
    const year = [...suggestions.children].find(node => node.textContent === "year")
    year.click()
    expect(find("#wizardAdditionalFields").value).toBe("year")
    expect(suggestions.textContent).not.toContain("year")
    const fields = find("#wizardAdditionalFields")
    fields.focus()
    input("#wizardAdditionalFields", "cast, thumb:pos")
    expect(suggestions.textContent).toBe("thumb:poster_path")
    // Stimulus observes the newly rendered suggestion before the next user event.
    await new Promise(resolve => setTimeout(resolve, 0))
    suggestions.firstElementChild.click()
    expect(controller.settings.additionalFields).toEqual(["cast", "thumb:poster_path"])
    input("#wizardAdditionalFields", "cast, thumb:poster_path, ")
    expect([...suggestions.children].map(node => node.textContent)).toEqual(["body", "year"])
    expect(fields.value).toBe("cast, thumb:poster_path, ")
    fields.blur()
    input("#wizardTitleField", "title")
    expect(fields.value).toBe("cast, thumb:poster_path")
  })

  it("resolves the required-proxy value from Rails and omits the optional proxy/JSONP controls", async () => {
    await mount("proxy_required")
    endpoint()
    expect(controller.proxyRequiredValue).toBe(true)
    expect(controller.settings.proxyRequests).toBe(true)
    expect(element.querySelector("#wizardProxy")).toBeNull()
    expect(element.querySelector('[data-wizard-target="apiMethod"]')).toBeNull()
  })

  it("keeps Finish disabled and waits for queries and onboarding before navigating", async () => {
    await finishStep()
    let saveQueries
    let saveUser
    persistQueries.mockReturnValue(new Promise(resolve => { saveQueries = resolve }))
    capability.user.shownIntroWizard.mockReturnValue(new Promise(resolve => { saveUser = resolve }))
    const finish = find('[data-wizard-target="finishButton"]')
    finish.click()
    await vi.waitFor(() => expect(persistQueries).toHaveBeenCalledWith(123, ["star wars"]))
    expect(finish.disabled).toBe(true)
    expect(capability.settings.update).toHaveBeenCalledWith(expect.anything(), { navigateAfterSave: false })
    expect(capability.navigation.navigateTo).not.toHaveBeenCalled()
    expect(capability.user.shownIntroWizard).not.toHaveBeenCalled()
    saveQueries({})
    await vi.waitFor(() => expect(capability.user.shownIntroWizard).toHaveBeenCalledOnce())
    expect(capability.navigation.navigateTo).not.toHaveBeenCalled()
    expect(hideModal).not.toHaveBeenCalled()
    saveUser()
    await vi.waitFor(() => expect(capability.navigation.navigateTo).toHaveBeenCalledWith({ tryNo: 1, startTour: true }))
  })

  it("keeps the wizard open after a failed query save and lets Finish retry", async () => {
    await finishStep()
    persistQueries.mockRejectedValueOnce({ data: { error: "query save failed" } }).mockResolvedValueOnce({})
    const finish = find('[data-wizard-target="finishButton"]')
    finish.click()
    await vi.waitFor(() => expect(find('[role="alert"]').textContent).toContain("query save failed"))
    expect(shown(find('[role="alert"]'))).toBe(true)
    expect(finish.disabled).toBe(false)
    expect(capability.navigation.navigateTo).not.toHaveBeenCalled()
    expect(capability.user.shownIntroWizard).not.toHaveBeenCalled()
    expect(hideModal).not.toHaveBeenCalled()
    finish.click()
    await vi.waitFor(() => expect(capability.navigation.navigateTo).toHaveBeenCalledOnce())
    expect(persistQueries).toHaveBeenCalledTimes(2)
  })
})

import { readFileSync } from "node:fs"
import { buildControllerFixture } from "../support/controller_fixture"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import WizardController from "controllers/wizard_controller"
import { getOrCreateBsModal } from "utils/bs_modal"
import { getWizardCapabilities } from "utils/core_capabilities_runtime"
import { getCoreCapabilities } from "utils/core_capability_access"
import { importSnapshotsToCase } from "utils/snapshot_import"
import { persistQueries } from "utils/query_lifecycle"
import { createSettingsRuntime } from "utils/settings_runtime"

const modal = { show: vi.fn(), hide: vi.fn() }

vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => modal) }))
vi.mock("utils/core_capabilities_runtime", () => ({ getWizardCapabilities: vi.fn() }))
vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: vi.fn() }))
vi.mock("utils/snapshot_import", () => ({ importSnapshotsToCase: vi.fn() }))
vi.mock("utils/query_lifecycle", () => ({ persistQueries: vi.fn() }))
vi.mock("utils/quepid_root", () => ({ getQuepidRootUrl: () => "http://quepid" }))

const STEPS = { welcome: 0, name: 1, endpoint: 2, fields: 3, query: 4, finish: 5 }
const WIZARD_ERB = readFileSync("app/views/shared/_wizard_modal.html.erb", "utf8")
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function makeCapability() {
  return {
    settings: {
      editable: vi.fn(() => ({ searchEngine: "solr", searchUrl: "http://solr", caseName: "" })),
      pick: vi.fn(preset => ({ searchEngine: preset || "solr", apiMethod: "GET", secureSearchUrl: "https://s", insecureSearchUrl: "http://s" })),
      registerMapper: vi.fn(),
      proxyUrlFor: vi.fn(() => "/proxy/1"),
      demoChosen: vi.fn(() => false),
      defaultSolrQueryParams: vi.fn(() => "q=#$query##"),
      applicable: vi.fn(() => ({ tryNo: 1 })),
      update: vi.fn(() => Promise.resolve())
    },
    endpoints: { list: vi.fn(() => Promise.resolve()), all: vi.fn(() => []), isEsOrOs: vi.fn(() => false) },
    mapper: { list: vi.fn(() => Promise.resolve()), all: vi.fn(() => []) },
    user: { current: vi.fn(() => ({ completedCaseWizard: false })), shownIntroWizard: vi.fn() },
    navigation: {
      needToRedirectProtocol: vi.fn(() => false),
      swapUrlTls: vi.fn(() => ["https://q", "https"]),
      appendQueryParams: vi.fn((url, qs) => `${url}?${qs}`),
      rootUrl: vi.fn(() => "/root"),
      caseNo: vi.fn(() => 5),
      navigateTo: vi.fn()
    },
    search: { createValidator: vi.fn() },
    case: {
      selected: vi.fn(() => ({ id: 5 })),
      rename: vi.fn(() => Promise.resolve()),
      delete: vi.fn(() => Promise.resolve())
    },
    documents: { cache: { invalidate: vi.fn(), update: vi.fn() } }
  }
}

function mount({ step = 0, settings = {} } = {}) {
  const element = document.createElement("div")
  const controller = buildControllerFixture(WizardController, {
    element,
    targets: {
      step: Array.from({ length: 6 }, () => element.appendChild(document.createElement("div"))),
      tracker: Array.from({ length: 6 }, () => element.appendChild(document.createElement("button"))),
      continueButton: [element.appendChild(document.createElement("button"))],
      tlsProtocol: [],
      engineName: [],
      endpointLink: [],
      wikiLink: [],
      engineOption: [],
      pingButton: [],
      alert: document.createElement("div")
    },
    overrides: {
      connected: true,
      searchEndpoints: [],
      mapperEngines: [],
      searchFields: [],
      idFields: [],
      newQueries: [],
      staticRows: [],
      stepIndex: step,
      loaded: true,
      capability: makeCapability(),
      settings: { searchEngine: "solr", searchUrl: "http://solr", caseName: "My Case", ...settings }
    }
  })
  return controller
}

function passingValidator(overrides = {}) {
  return { validateUrl: vi.fn(() => Promise.resolve()), fields: ["title", "body"], idFields: ["id"], ...overrides }
}

describe("WizardController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, "error").mockImplementation(() => {})
    window.confirm = vi.fn(() => true)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete window.confirm
  })

  describe("universal proxy", () => {
    it("normalizes Solr presets without changing the default-off behavior", () => {
      const controller = mount()
      controller.capability.settings.pick.mockReturnValue({ searchEngine: "solr", apiMethod: "JSONP", proxyRequests: false })
      controller.applySettings("solr")
      expect(controller.settings.apiMethod).toBe("JSONP")
      expect(controller.settings.proxyRequests).toBe(false)
      controller.proxyRequiredValue = true
      controller.applySettings("solr")
      expect(controller.settings.apiMethod).toBe("GET")
      expect(controller.settings.proxyRequests).toBe(true)
      controller.settings.apiMethod = "JSONP"
      controller.forceProxyIfRequired()
      expect(controller.settings.apiMethod).toBe("GET")
      expect(controller.tlsMismatch()).toBe(false)
    })

    it.each([
      { apiMethod: "JSONP", proxyRequests: false },
      { apiMethod: "GET", proxyRequests: false },
      { apiMethod: "JSONP", proxyRequests: true }
    ])("rejects incompatible existing endpoints before validation or saving: %j", async (transport) => {
      const controller = mount()
      controller.proxyRequiredValue = true
      const endpoint = { id: 7, searchEngine: "solr", endpointUrl: "http://solr", ...transport }
      controller.searchEndpoints = [endpoint]
      const originalSettings = { ...controller.settings }
      controller.selectEndpoint({ target: { value: "7" } })
      expect(controller.error).toContain("Edit the endpoint first")
      expect(controller.settings).toEqual(originalSettings)
      expect(endpoint).toMatchObject(transport)

      // A current try can already reference an incompatible endpoint when the wizard opens.
      controller.settings = { ...controller.settings, searchEndpointId: 7, apiMethod: "GET", proxyRequests: true }
      await controller.validate()
      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
      await controller.finish()
      expect(controller.capability.settings.update).not.toHaveBeenCalled()
      expect(controller.capability.case.rename).not.toHaveBeenCalled()
      expect(modal.hide).not.toHaveBeenCalled()
      expect(controller.saving).toBeFalsy()
    })

    it("keeps existing endpoint selection unchanged when the flag is off", () => {
      const controller = mount()
      controller.searchEndpoints = [{ id: 7, searchEngine: "solr", apiMethod: "JSONP", proxyRequests: false }]
      controller.selectEndpoint({ target: { value: "7" } })
      expect(controller.settings).toMatchObject({ searchEndpointId: 7, apiMethod: "JSONP", proxyRequests: false })
      expect(controller.proxyEndpointError()).toBeNull()
    })

    it("saves a compatible existing endpoint by its original ID after a rejected selection", async () => {
      const controller = mount()
      controller.proxyRequiredValue = true
      controller.searchEndpoints = [
        { id: 7, searchEngine: "solr", apiMethod: "JSONP", proxyRequests: false },
        { id: 8, searchEngine: "solr", endpointUrl: "http://solr", apiMethod: "GET", proxyRequests: true }
      ]
      controller.selectEndpoint({ target: { value: "7" } })
      controller.selectEndpoint({ target: { value: "8" } })
      expect(controller.error).toBeNull()
      const runtime = createSettingsRuntime({ caseNo: () => 5, tryNo: () => 1 })
      runtime.setCaseTries([{ try_number: 1, search_endpoint_id: 8, api_method: "GET", proxy_requests: true }])
      runtime.setCurrentTry(1)
      controller.capability.settings.applicable = runtime.applicable
      controller.capability.settings.update = vi.fn(runtime.update)
      const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"))
      getCoreCapabilities.mockReturnValue({ queryCapabilities: { changeSettings: vi.fn() } })
      await controller.finish()
      expect(controller.capability.settings.update).toHaveBeenCalledWith(expect.objectContaining({
        searchEndpointId: 8, apiMethod: "GET", proxyRequests: true
      }), { navigateAfterSave: false })
      const payload = JSON.parse(request.mock.calls[0][1].body)
      expect(payload.try.search_endpoint_id).toBe(8)
      expect(payload).not.toHaveProperty("search_endpoint")
      expect(modal.hide).toHaveBeenCalledOnce()
    })
  })

  describe("loading", () => {
    it("keeps steps hidden until loaded, then shows the current one", async () => {
      const controller = mount()
      controller.loaded = false
      controller.render()
      expect(controller.stepTargets.every(step => step.hidden)).toBe(true)

      const capability = makeCapability()
      getWizardCapabilities.mockResolvedValue({ capability })
      controller.stepIndex = 0
      await controller.loadWizard()

      expect(controller.loaded).toBe(true)
      expect(controller.stepTargets[0].hidden).toBe(false)
      expect(controller.stepTargets[1].hidden).toBe(true)
      expect(controller.settings.caseName).toBe("Movies Search")
    })

    it("skips the welcome step for users who already completed the wizard", async () => {
      const capability = makeCapability()
      capability.user.current.mockReturnValue({ completedCaseWizard: true })
      getWizardCapabilities.mockResolvedValue({ capability })
      const controller = mount()
      controller.stepIndex = 0

      await controller.loadWizard()

      expect(controller.stepIndex).toBe(STEPS.name)
    })

    it("still loads when endpoint choices cannot be fetched", async () => {
      const capability = makeCapability()
      capability.endpoints.list.mockRejectedValue(new Error("nope"))
      getWizardCapabilities.mockResolvedValue({ capability })
      const controller = mount()

      await controller.loadWizard()

      expect(controller.loaded).toBe(true)
    })

    it("shows an error once, without polling, when capabilities cannot load", async () => {
      vi.useFakeTimers()
      getWizardCapabilities.mockRejectedValue(new Error("not ready"))
      const controller = mount()
      controller.loaded = false

      await controller.loadWizard()
      await vi.advanceTimersByTimeAsync(10000)

      expect(getWizardCapabilities).toHaveBeenCalledTimes(1)
      expect(controller.error).toMatch(/Unable to load the case wizard/)
      vi.useRealTimers()
    })

    it("stops loading when disconnected mid-load", async () => {
      const capability = makeCapability()
      let resolveEndpoints
      capability.endpoints.list.mockReturnValue(new Promise(resolve => { resolveEndpoints = resolve }))
      getWizardCapabilities.mockResolvedValue({ capability })
      const controller = mount()
      controller.loaded = false

      const loading = controller.loadWizard()
      await flush()
      controller.disconnect()
      resolveEndpoints()
      await loading

      expect(controller.loaded).toBe(false)
      expect(capability.mapper.list).toHaveBeenCalled()
    })
  })

  describe("navigation", () => {
    it("does not leave the name step without a case name", () => {
      const controller = mount({ step: STEPS.name, settings: { caseName: "   " } })
      controller.next()
      expect(controller.stepIndex).toBe(STEPS.name)
      controller.render()
      expect(controller.continueButtonTargets[0].disabled).toBe(true)
    })

    it("advances from welcome and name", () => {
      const controller = mount({ step: STEPS.welcome })
      controller.next()
      expect(controller.stepIndex).toBe(STEPS.name)
      controller.next()
      expect(controller.stepIndex).toBe(STEPS.endpoint)
    })

    it("does not advance past the query step for searchapi without a query pattern", () => {
      const controller = mount({ step: STEPS.query, settings: { searchEngine: "searchapi", queryParams: " " } })
      controller.next()
      expect(controller.stepIndex).toBe(STEPS.query)
    })

    it("adds any typed query and moves to finish from the query step", () => {
      const controller = mount({ step: STEPS.query, settings: { text: "star wars" } })
      controller.next()
      expect(controller.newQueries).toEqual([{ queryString: "star wars" }])
      expect(controller.stepIndex).toBe(STEPS.finish)
    })

    it("never goes below the first or past the last step", () => {
      const controller = mount({ step: STEPS.welcome })
      controller.previous()
      expect(controller.stepIndex).toBe(0)

      controller.stepIndex = STEPS.finish
      controller.stepIndex = Math.min(controller.stepIndex + 1, 5)
      expect(controller.stepIndex).toBe(STEPS.finish)
    })

    it("lets breadcrumbs jump back but not ahead", () => {
      const controller = mount({ step: STEPS.fields })
      controller.setStep({ params: { index: 1 } })
      expect(controller.stepIndex).toBe(STEPS.name)
      controller.setStep({ params: { index: 4 } })
      expect(controller.stepIndex).toBe(STEPS.name)
    })

    it("ignores tracker clicks and disables the tracker while validating", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.validating = true

      controller.setStep({ params: { index: 1 } })
      controller.render()

      expect(controller.stepIndex).toBe(STEPS.endpoint)
      expect(controller.trackerTargets.every(item => item.disabled)).toBe(true)
    })

    it("marks the current step in the tracker and disables steps not yet reached", () => {
      const controller = mount({ step: STEPS.endpoint })

      controller.render()

      const states = controller.trackerTargets.map(item => [item.classList.contains("active"), item.disabled])
      expect(states).toEqual([[false, false], [false, false], [true, false], [false, true], [false, true], [false, true]])
      expect(controller.trackerTargets[STEPS.endpoint].getAttribute("aria-current")).toBe("step")
      expect(controller.trackerTargets[STEPS.name].hasAttribute("aria-current")).toBe(false)
    })

    it("shows only the elements for the current step", () => {
      const controller = mount({ step: STEPS.query })
      controller.element.innerHTML = '<i data-wizard-only="query"></i><i data-wizard-only="name"></i>'

      controller.render()

      const [query, name] = controller.element.querySelectorAll("i")
      expect(query.hidden).toBe(false)
      expect(name.hidden).toBe(true)
    })
  })

  describe("validate (endpoint step)", () => {
    it("moves to the fields step with the preset's display fields and records the discovered ones", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEnginePreset: "solr", searchUrl: "http://solr/tmdb/select" } })
      controller.capability.settings.pick.mockReturnValue({ idField: "id", titleField: "title", additionalFields: ["overview"] })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate()

      expect(controller.capability.settings.pick).toHaveBeenCalledWith("solr", "http://solr/tmdb/select")
      expect(controller.stepIndex).toBe(STEPS.fields)
      expect(controller.searchFields).toEqual(["title", "body"])
      expect(controller.settings.idField).toBe("id")
      expect(controller.settings.titleField).toBe("title")
      expect(controller.settings.additionalFields).toEqual(["overview"])
      expect(controller.settings.fieldSpec).toBe("id:id, title:title, overview")
      expect(controller.validating).toBe(false)
    })

    it("leaves Title blank when the preset has none, instead of using the first discovered field", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "static", searchEnginePreset: "static" } })
      controller.capability.settings.pick.mockReturnValue({ idField: "id", titleField: "" })
      controller.capability.search.createValidator.mockReturnValue(passingValidator({ fields: ["id", "MovieTitle"] }))

      await controller.validate()

      expect(controller.settings.titleField).toBe("")
      expect(controller.settings.idField).toBe("id")
      controller.validateFields()
      expect(controller.stepIndex).toBe(STEPS.fields)
      expect(controller.fieldError).toBe("This field is required. Please select a title field.")
    })

    it("stays on the step when only validating, and keeps fields the user already edited", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.settings.pick.mockReturnValue({ idField: "id", titleField: "" })
      const edit = (field, value) => controller.updateSetting({ target: { type: "text", value, dataset: { wizardField: field } } })
      edit("idField", "mine")
      edit("titleField", "mine_title")
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate(true)

      expect(controller.stepIndex).toBe(STEPS.endpoint)
      expect([controller.settings.idField, controller.settings.titleField]).toEqual(["mine", "mine_title"])
      expect(controller.urlValid).toBe(true)
    })

    it("applies the new engine's display fields again after the engine changes", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.updateSetting({ target: { type: "text", value: "mine", dataset: { wizardField: "titleField" } } })
      controller.updateSetting({ target: { type: "radio", value: "es", dataset: { wizardField: "searchEnginePreset" } } })
      controller.capability.settings.pick.mockReturnValue({ idField: "_id", titleField: "title" })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate()

      expect([controller.settings.idField, controller.settings.titleField]).toEqual(["_id", "title"])
    })

    it("shows the validator's error, stripping the Error: prefix", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.search.createValidator.mockReturnValue(
        passingValidator({ validateUrl: vi.fn(() => Promise.reject(new Error("CORS blocked"))) })
      )

      await controller.validate()

      expect(controller.stepIndex).toBe(STEPS.endpoint)
      expect(controller.urlInvalid).toBe(true)
      expect(controller.error).toBe("CORS blocked")
      expect(controller.alertTarget.textContent).toBe("CORS blocked")
      expect(controller.validating).toBe(false)
    })

    it("falls back to a generic message when the validator gives none", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.search.createValidator.mockReturnValue(
        passingValidator({ validateUrl: vi.fn(() => Promise.reject("")) })
      )

      await controller.validate()

      expect(controller.error).toBe("Quepid could not search this endpoint.")
    })

    it("requires a query pattern for Search API endpoints", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "searchapi", queryParams: "" } })

      await controller.validate()

      expect(controller.error).toBe("Query pattern is required for Search API endpoints.")
      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
      expect(controller.validating).toBe(false)
    })

    it("rejects custom headers that are not a JSON object", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { customHeaders: "[1,2]" } })

      await controller.validate()

      expect(controller.error).toBe("Custom Headers must be a valid JSON object")
      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
    })

    it("rejects proxying with JSONP", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { proxyRequests: true, apiMethod: "JSONP" } })

      await controller.validate()

      expect(controller.error).toBe("You must change from JSONP to another API method when proxying.")
    })

    it("validates a static engine as solr and a proxied request through the proxy url", async () => {
      const controller = mount({
        step: STEPS.endpoint,
        settings: { searchEngine: "static", proxyRequests: true, searchEndpointId: 8 }
      })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate()

      const passed = controller.capability.search.createValidator.mock.calls[0][0]
      expect(passed.searchEngine).toBe("solr")
      expect(passed.proxyUrl).toBe("/proxy/1")
      expect(controller.capability.settings.proxyUrlFor).toHaveBeenCalledWith(8)
    })

    it("derives searchapi test args by substituting the query placeholder", async () => {
      const controller = mount({
        step: STEPS.endpoint,
        settings: { searchEngine: "searchapi", queryParams: "q=#$query##&x=1" }
      })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate()

      expect(controller.capability.search.createValidator.mock.calls[0][0].args).toBe("q=test&x=1")
    })

    it("does not validate while the protocol mismatches; shows the TLS warning instead", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.navigation.needToRedirectProtocol.mockReturnValue(true)
      controller.hasTlsWarningTarget = true
      controller.tlsWarningTarget = document.createElement("div")

      await controller.validate()

      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
      expect(controller.tlsWarningTarget.hidden).toBe(false)
    })

    it("reloads Quepid on the other protocol, reopening the wizard with its settings", () => {
      const assign = vi.fn()
      vi.stubGlobal("location", { assign })
      const controller = mount({ step: STEPS.endpoint })

      controller.reloadInOtherProtocol()

      expect(assign).toHaveBeenCalledOnce()
      expect(assign.mock.calls[0][0]).toContain("showWizard=true")
      vi.unstubAllGlobals()
    })

    it("skipValidation jumps straight to the fields step with the preset's display fields", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.settings.pick.mockReturnValue({ idField: "id", titleField: "" })
      controller.skipValidation()
      expect(controller.stepIndex).toBe(STEPS.fields)
      expect([controller.settings.idField, controller.settings.titleField]).toEqual(["id", ""])
    })
  })

  describe("validateFields", () => {
    it("requires an ID field, then a title field", () => {
      const controller = mount({ step: STEPS.fields, settings: { idField: "", titleField: "t" } })
      controller.validateFields()
      expect(controller.fieldError).toMatch(/select an ID field/)
      expect(controller.stepIndex).toBe(STEPS.fields)

      controller.settings.idField = "id"
      controller.settings.titleField = " "
      controller.validateFields()
      expect(controller.fieldError).toMatch(/select a title field/)
    })

    it("builds the fieldSpec including additional fields and continues", () => {
      const controller = mount({
        step: STEPS.fields,
        settings: { idField: "id", titleField: "title", additionalFields: ["body", "year"] }
      })

      controller.validateFields()

      expect(controller.fieldError).toBeNull()
      expect(controller.settings.fieldSpec).toBe("id:id, title:title, body, year")
      expect(controller.stepIndex).toBe(STEPS.query)
    })
  })

  describe("queries", () => {
    it("adds a query once, clears the input, and ignores blanks and duplicates", () => {
      const controller = mount({ step: STEPS.query, settings: { text: "star wars" } })
      controller.addQuery()
      expect(controller.settings.text).toBe("")

      controller.settings.text = "star wars"
      controller.addQuery()
      controller.settings.text = ""
      controller.addQuery()

      expect(controller.newQueries).toEqual([{ queryString: "star wars" }])
    })

    it("removes a query by index", () => {
      const controller = mount({ step: STEPS.query })
      controller.newQueries = [{ queryString: "a" }, { queryString: "b" }, { queryString: "c" }]

      controller.removeQuery({ params: { index: 1 } })

      expect(controller.newQueries.map(q => q.queryString)).toEqual(["a", "c"])
    })

    it("renders each query with a remove button", () => {
      const controller = mount({ step: STEPS.query })
      controller.hasQueryListTarget = true
      controller.queryListTarget = document.createElement("div")
      controller.newQueries = [{ queryString: "a" }, { queryString: "b" }]

      controller.render()

      expect(controller.queryListTarget.querySelectorAll(".badge")).toHaveLength(2)
      expect(controller.queryListTarget.querySelector("button").dataset.wizardIndexParam).toBe("0")
    })
  })

  describe("settings", () => {
    it("splits additional fields on commas and whitespace", () => {
      const controller = mount({ step: STEPS.fields })
      controller.updateSetting({ target: { dataset: { wizardField: "additionalFields" }, type: "text", value: "a, b  c,,d" } })
      expect(controller.settings.additionalFields).toEqual(["a", "b", "c", "d"])
    })

    it("reads checkboxes by checked state", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.updateSetting({ target: { dataset: { wizardField: "proxyRequests" }, type: "checkbox", checked: true, value: "on" } })
      expect(controller.settings.proxyRequests).toBe(true)
    })

    it("clears a previous validation result when the url changes", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.urlInvalid = true
      controller.error = "old"

      controller.updateSetting({ target: { dataset: { wizardField: "searchUrl" }, type: "text", value: "http://new" } })

      expect(controller.urlInvalid).toBe(false)
      expect(controller.error).toBeNull()
    })

    it("resets the chosen endpoint and applies presets when the engine changes", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEndpointId: 3 } })

      controller.updateSetting({ target: { dataset: { wizardField: "searchEnginePreset" }, type: "select-one", value: "es" } })

      expect(controller.settings.searchEndpointId).toBeNull()
      expect(controller.capability.settings.pick).toHaveBeenCalledWith("es", undefined)
      expect(controller.settings.searchEngine).toBe("es")
    })

    it("picks the secure or insecure solr url based on page protocol", () => {
      const controller = mount()
      controller.applySettings("solr")
      expect(controller.settings.searchUrl).toBe("http://s")
    })

    it("applies a saved endpoint's settings and formats object headers as JSON", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.searchEndpoints = [{
        id: 4, name: "Prod", searchEngine: "es", endpointUrl: "http://es", apiMethod: "POST",
        proxyRequests: false, customHeaders: { a: "b" }, mapperCode: "code", testQuery: "t"
      }]
      controller.capability.settings.pick.mockReturnValue({ apiMethod: "GET", queryParams: "" })

      controller.selectEndpoint({ target: { value: "4" } })

      expect(controller.settings).toMatchObject({
        searchEndpointId: 4, searchEngine: "es", searchEnginePreset: "es", searchUrl: "http://es", apiMethod: "POST"
      })
      expect(controller.settings.customHeaders).toBe(JSON.stringify({ a: "b" }, null, 2))
    })

    it("seeds a searchapi endpoint's query pattern from its test query when it has a placeholder", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.searchEndpoints = [{ id: 4, searchEngine: "searchapi", endpointUrl: "http://x", testQuery: "q=#$query##" }]
      controller.capability.settings.pick.mockReturnValue({ apiMethod: "GET" })

      controller.selectEndpoint({ target: { value: "4" } })

      expect(controller.settings.queryParams).toBe("q=#$query##")
    })

    it.each([undefined, null, ""])("retains wizard defaults for absent endpoint method %s", apiMethod => {
      const controller = mount({ step: STEPS.endpoint })
      controller.searchEndpoints = [{ id: 4, searchEngine: "searchapi", mapperBasedSearchEngineId: "vespa", apiMethod, customHeaders: null, testQuery: "q=#$query##" }]
      controller.capability.settings.pick.mockReturnValue({ apiMethod: "POST", queryParams: "preset query", titleField: "title" })
      controller.selectEndpoint({ target: { value: "4" } })
      expect(controller.capability.settings.pick).toHaveBeenCalledWith("vespa", undefined)
      expect(controller.settings).toMatchObject({ apiMethod: "POST", queryParams: "preset query", searchEnginePreset: "vespa", customHeaders: null, titleField: "title" })
    })

    it("ignores an unknown endpoint id", () => {
      const controller = mount({ step: STEPS.endpoint })
      const before = controller.settings
      controller.selectEndpoint({ target: { value: "999" } })
      expect(controller.settings).toBe(before)
    })

    it("excludes static endpoints from the endpoint dropdown", () => {
      const controller = mount()
      controller.hasEndpointSelectTarget = true
      controller.endpointSelectTarget = document.createElement("select")
      controller.searchEndpoints = [
        { id: 1, name: "Live", searchEngine: "solr" },
        { id: 2, name: "Snap", searchEngine: "static" }
      ]

      controller.renderEndpointChoices()

      expect([...controller.endpointSelectTarget.options].map(o => o.textContent)).toEqual([
        "Select a search endpoint…", "Live"
      ])
      expect(controller.endpointSelectTarget.disabled).toBe(false)
    })

    it("adds a logo tile per mapper-based engine after the ERB-rendered built-ins without duplicating them on reopen", () => {
      const controller = mount()
      const row = document.createElement("div")
      row.innerHTML = `<label class="wizard-engine-tile"><input value="vectara"><img alt="Vectara"></label>`
      const template = document.createElement("template")
      template.innerHTML = `<label class="wizard-engine-tile" data-mapper-engine><input type="radio"><img alt=""></label>`
      Object.assign(controller, {
        mapperEnginesTarget: row, hasMapperEnginesTarget: true,
        engineTileTemplateTarget: template, hasEngineTileTemplateTarget: true,
        mapperEngines: [{ id: "vespa", name: "Vespa", logo: "vespa" }]
      })

      controller.renderEndpointChoices()
      controller.renderEndpointChoices()

      const tiles = [...row.querySelectorAll("label")].map((label) => {
        const input = label.querySelector("input")
        const img = label.querySelector("img")
        return [input.value, input.getAttribute("aria-label"), img.getAttribute("src"), img.alt]
      })
      expect(tiles).toEqual([
        ["vectara", null, null, "Vectara"],
        ["vespa", "Vespa", "images/vespa.png", "Vespa"]
      ])
    })

    it("checks the chosen engine's tile and names it from its logo", () => {
      const controller = mount({ settings: { searchEngine: "es", searchEnginePreset: "es" } })
      const tile = (value, alt) => {
        const label = document.createElement("label")
        label.innerHTML = `<input type="radio" value="${value}"><img alt="${alt}">`
        return label.querySelector("input")
      }
      controller.engineOptionTargets = [tile("solr", "Solr"), tile("es", "Elasticsearch")]

      controller.render()

      expect(controller.engineOptionTargets.map((option) => option.checked)).toEqual([false, true])
      expect(controller.engineDisplayName()).toBe("Elasticsearch")
    })

    it("fills a header template for the chosen header type and makes None read-only", () => {
      const controller = mount({ step: STEPS.endpoint })
      Object.assign(controller, {
        headerTypeTarget: document.createElement("select"), hasHeaderTypeTarget: true,
        customHeadersTarget: document.createElement("textarea"), hasCustomHeadersTarget: true
      })
      controller.headerTypeTarget.innerHTML = "<option>None</option><option>API Key</option><option>Custom</option>"

      controller.changeHeaderType({ target: { value: "API Key" } })
      expect(controller.customHeadersTarget.value).toBe('{\n  "Authorization": "ApiKey XXX"\n}')
      expect(controller.customHeadersTarget.readOnly).toBe(false)

      controller.changeHeaderType({ target: { value: "None" } })
      expect(controller.customHeadersTarget.value).toBe("")
      expect(controller.customHeadersTarget.readOnly).toBe(true)
    })

    it("shows an existing endpoint's headers as Custom even though presets default to None", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { headerType: "None", customHeaders: { "X-Key": "1" } } })
      Object.assign(controller, {
        headerTypeTarget: document.createElement("select"), hasHeaderTypeTarget: true,
        customHeadersTarget: document.createElement("textarea"), hasCustomHeadersTarget: true
      })
      controller.headerTypeTarget.innerHTML = "<option>None</option><option>API Key</option><option>Custom</option>"

      controller.render()

      expect(controller.headerTypeTarget.value).toBe("Custom")
      expect(controller.customHeadersTarget.readOnly).toBe(false)
    })

    it("disables the dropdown when there are no endpoints", () => {
      const controller = mount()
      controller.hasEndpointSelectTarget = true
      controller.endpointSelectTarget = document.createElement("select")

      controller.renderEndpointChoices()

      expect(controller.endpointSelectTarget.disabled).toBe(true)
    })
  })

  describe("importStatic", () => {
    const csvFile = text => ({ target: { files: [{ text: async () => text }] } })
    const HEADER = "Query Text,Doc ID,Doc Position,title"

    it("does nothing when no file is chosen", async () => {
      const controller = mount()
      await controller.importStatic({ target: { files: [] } })
      expect(importSnapshotsToCase).not.toHaveBeenCalled()
    })

    it("reports missing required headers and imports nothing", async () => {
      const controller = mount()

      await controller.importStatic(csvFile("Foo,Bar\n1,2"))

      expect(controller.staticAlert).toMatch(/Required headers mismatch/)
      expect(importSnapshotsToCase).not.toHaveBeenCalled()
    })

    it("rejects malformed rows before posting an import", async () => {
      const controller = mount()
      await controller.importStatic(csvFile(`${HEADER}\nq,d`))
      expect(controller.staticAlert).toMatch(/CSV format error: line 2: expected 4 columns but found 2/)
      expect(importSnapshotsToCase).not.toHaveBeenCalled()
    })

    it("rejects unclosed quoted fields before posting an import", async () => {
      const controller = mount()
      await controller.importStatic(csvFile(`${HEADER}\nq,d,1,"unfinished`))
      expect(controller.staticAlert).toMatch(/unclosed quote/)
      expect(importSnapshotsToCase).not.toHaveBeenCalled()
    })

    it("imports rows as a snapshot, switches to static, and collects unique queries", async () => {
      importSnapshotsToCase.mockResolvedValue([{ id: 11 }])
      const controller = mount()
      controller.snapshotSearchUrlTemplateValue = "http://quepid/api/cases/5/snapshots/__SNAPSHOT_ID__/search"

      await controller.importStatic(csvFile(`${HEADER}\nstar wars,d1,1,A\n\n   \nstar wars,d2,2,B\nalien,d3,1,C\n,,,\n\n`))

      expect(importSnapshotsToCase).toHaveBeenCalledWith(
        [
          { "Query Text": "star wars", "Doc ID": "d1", "Doc Position": "1", title: "A" },
          { "Query Text": "star wars", "Doc ID": "d2", "Doc Position": "2", title: "B" },
          { "Query Text": "alien", "Doc ID": "d3", "Doc Position": "1", title: "C" }
        ],
        5,
        "http://quepid"
      )
      expect(controller.settings.searchEngine).toBe("static")
      expect(controller.settings.searchUrl).toBe("http://quepid/api/cases/5/snapshots/11/search")
      expect(controller.newQueries).toEqual([{ queryString: "star wars" }, { queryString: "alien" }])
      expect(controller.staticAlert).toBe("Static data imported successfully.")
    })

    it("reports a failed import", async () => {
      importSnapshotsToCase.mockRejectedValue(new Error("boom"))
      const controller = mount()

      await controller.importStatic(csvFile(`${HEADER}\nq,d,1,x`))

      expect(controller.staticAlert).toBe("Could not import static data successfully.")
    })
  })

  describe("finish", () => {
    let queryCapabilities
    let queryLifecycle

    beforeEach(() => {
      queryCapabilities = { changeSettings: vi.fn(() => Promise.resolve()) }
      queryLifecycle = {
        commitPersistedQueries: vi.fn(() => Promise.resolve())
      }
      persistQueries.mockReset().mockResolvedValue(["p"])
      getCoreCapabilities.mockReturnValue({ queryCapabilities, queryLifecycle })
      getOrCreateBsModal.mockReturnValue(modal)
    })

    it("renames the case, saves settings with the new queries, persists queries, and closes", async () => {
      const controller = mount({ step: STEPS.finish, settings: { caseName: "Named", searchEngine: "solr" } })
      controller.newQueries = [{ queryString: "a" }, { queryString: "b" }]

      await controller.finish()

      const { case: c, settings } = controller.capability
      expect(c.rename).toHaveBeenCalledWith({ id: 5 }, "Named")
      expect(settings.update).toHaveBeenCalledWith(expect.objectContaining({ newQueries: controller.newQueries }), { navigateAfterSave: false })
      expect(persistQueries).toHaveBeenCalledWith(5, ["a", "b"])
      expect(controller.capability.navigation.navigateTo).toHaveBeenCalledWith({ tryNo: 1, startTour: true })
      expect(controller.capability.user.shownIntroWizard).toHaveBeenCalled()
      expect(modal.hide).toHaveBeenCalled()
    })

    it("uses the default solr query params unless a demo was chosen", async () => {
      const controller = mount({ step: STEPS.finish, settings: { searchEngine: "solr" } })

      await controller.finish()
      expect(controller.settings.queryParams).toBe("q=#$query##")

      const demo = mount({ step: STEPS.finish, settings: { searchEngine: "solr", queryParams: "keep" } })
      demo.capability.settings.demoChosen.mockReturnValue(true)
      await demo.finish()
      expect(demo.settings.queryParams).toBe("keep")
    })

    it("fills REPLACE_ME with the title field for ES/OS query params", async () => {
      const controller = mount({
        step: STEPS.finish,
        settings: { searchEngine: "es", queryParams: '{"fields":["REPLACE_ME"]}', titleField: "name" }
      })
      controller.capability.endpoints.isEsOrOs.mockReturnValue(true)

      await controller.finish()

      expect(controller.settings.queryParams).toBe('{"fields":["name"]}')
    })

    it("does not persist queries when none were added", async () => {
      const controller = mount({ step: STEPS.finish })

      await controller.finish()

      expect(persistQueries).not.toHaveBeenCalled()
    })

    it("waits for queries and the onboarding write before navigating", async () => {
      const controller = mount({ step: STEPS.finish })
      controller.newQueries = [{ queryString: "a" }]
      let saveQueries
      let saveUser
      persistQueries.mockReturnValue(new Promise(resolve => { saveQueries = resolve }))
      controller.capability.user.shownIntroWizard.mockReturnValue(new Promise(resolve => { saveUser = resolve }))
      const pending = controller.finish()
      await flush()
      expect(controller.capability.navigation.navigateTo).not.toHaveBeenCalled()
      expect(controller.capability.user.shownIntroWizard).not.toHaveBeenCalled()
      saveQueries({})
      await flush()
      expect(controller.capability.navigation.navigateTo).not.toHaveBeenCalled()
      saveUser()
      await pending
      expect(controller.capability.navigation.navigateTo).toHaveBeenCalledOnce()
    })

    it("keeps the wizard open when query persistence fails", async () => {
      const controller = mount({ step: STEPS.finish })
      controller.newQueries = [{ queryString: "a" }]
      persistQueries.mockRejectedValueOnce({ data: { error: "query save failed" } })
      await controller.finish()
      expect(controller.error).toContain("query save failed")
      expect(controller.saving).toBe(false)
      expect(controller.capability.navigation.navigateTo).not.toHaveBeenCalled()
      expect(controller.capability.user.shownIntroWizard).not.toHaveBeenCalled()
      expect(modal.hide).not.toHaveBeenCalled()
    })

    it("requests the tour on the loaded workspace only for first-time wizard users", async () => {
      const first = mount({ step: STEPS.finish })
      await first.finish()
      expect(first.capability.navigation.navigateTo).toHaveBeenCalledWith({ tryNo: 1, startTour: true })

      const returning = mount({ step: STEPS.finish })
      returning.capability.user.current.mockReturnValue({ completedCaseWizard: true })
      await returning.finish()
      expect(returning.capability.navigation.navigateTo).toHaveBeenCalledWith({ tryNo: 1, startTour: false })

    })

    it("shows the save error, re-enables Finish, and lets the user retry", async () => {
      const controller = mount({ step: STEPS.finish })
      controller.hasFinishButtonTarget = true
      controller.finishButtonTarget = document.createElement("button")
      controller.capability.settings.update.mockRejectedValueOnce({ data: { error: "bad url" } })

      await controller.finish()

      expect(controller.error).toBe("Could not save your case settings: bad url. Please click Finish to try again.")
      expect(controller.saving).toBe(false)
      expect(controller.finishButtonTarget.disabled).toBe(false)
      expect(modal.hide).not.toHaveBeenCalled()

      await controller.finish()
      expect(modal.hide).toHaveBeenCalled()
    })

    it("ignores a second click while saving", async () => {
      const controller = mount({ step: STEPS.finish })
      const first = controller.finish()
      await controller.finish()
      await first

      expect(controller.capability.settings.update).toHaveBeenCalledTimes(1)
    })
  })

  describe("close", () => {
    it("does nothing when the user declines to abandon the case", () => {
      window.confirm.mockReturnValue(false)
      const controller = mount()

      controller.close({ preventDefault: vi.fn() })

      expect(controller.capability.case.delete).not.toHaveBeenCalled()
      expect(modal.hide).not.toHaveBeenCalled()
    })

    it("deletes the abandoned case and returns to the root", async () => {
      const assign = vi.fn()
      vi.stubGlobal("location", { assign, search: "", protocol: "http:" })
      const controller = mount()

      controller.close({ preventDefault: vi.fn() })
      await flush()

      expect(controller.capability.case.delete).toHaveBeenCalledWith({ id: 5 })
      expect(modal.hide).toHaveBeenCalled()
      expect(assign).toHaveBeenCalledWith("/root")
      vi.unstubAllGlobals()
    })

    it("just hides the modal if the wizard never finished loading", () => {
      const controller = mount()
      controller.capability = null

      controller.close({ preventDefault: vi.fn() })

      expect(modal.hide).toHaveBeenCalled()
    })
  })

  describe("endpoint guidance (restored from the Angular wizard)", () => {
    // Adds an element gated by `data-wizard-when`, as the ERB declares it.
    const gated = (controller, when) => {
      const element = document.createElement("div")
      element.dataset.wizardWhen = when
      controller.element.appendChild(element)
      return element
    }
    const failingValidator = (message) =>
      passingValidator({ validateUrl: vi.fn(() => Promise.reject(new Error(message))) })

    it("shows only the failed engine's troubleshooting, with proxy hints only while not proxying", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "es", proxyRequests: false } })
      const panel = gated(controller, "url-invalid")
      const es = gated(controller, "es")
      const solr = gated(controller, "solr")
      const quickFix = gated(controller, "no-proxy")
      controller.capability.search.createValidator.mockReturnValue(failingValidator("Network error"))

      await controller.validate()

      expect([panel.hidden, es.hidden, solr.hidden, quickFix.hidden]).toEqual([false, false, true, false])
      controller.settings.proxyRequests = true
      controller.render()
      expect(quickFix.hidden).toBe(true)
    })

    it("hides the troubleshooting while the protocol mismatches", async () => {
      const controller = mount({ step: STEPS.endpoint })
      const panel = gated(controller, "url-invalid")
      controller.urlInvalid = true
      controller.capability.navigation.needToRedirectProtocol.mockReturnValue(true)

      controller.render()

      expect(panel.hidden).toBe(true)
    })

    it("treats a MapperError as mapper guidance, not a connection failure", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "searchapi", queryParams: "q=#$query##" } })
      controller.mapperMessageTarget = document.createElement("code")
      controller.hasMapperMessageTarget = true
      const mapperPanel = gated(controller, "mapper-invalid")
      const urlPanel = gated(controller, "url-invalid")
      controller.capability.search.createValidator.mockReturnValue(failingValidator("MapperError: docsMapper is not a function"))

      await controller.validate()

      expect(controller.mapperInvalid).toBe(true)
      expect(controller.urlInvalid).toBe(false)
      expect(controller.error).toBeNull()
      expect([mapperPanel.hidden, urlPanel.hidden]).toEqual([false, true])
      expect(controller.mapperMessageTarget.textContent).toBe("MapperError: docsMapper is not a function")
    })

    it("pings without leaving the step and confirms Quepid can search", async () => {
      const controller = mount({ step: STEPS.endpoint })
      const success = gated(controller, "url-valid")
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.ping({ preventDefault: vi.fn() })

      expect(controller.stepIndex).toBe(STEPS.endpoint)
      expect(success.hidden).toBe(false)
    })

    it("offers Skip Validation only after the endpoint could not be reached, not after a mapper error", async () => {
      const skipWhen = WIZARD_ERB.match(/<button\b[^>]*data-wizard-target="skipButton"[^>]*>/)?.[0]
        .match(/data-wizard-when="([^"]+)"/)?.[1]
      expect(skipWhen).toBeDefined()
      const controller = mount({ step: STEPS.endpoint })
      const skip = gated(controller, skipWhen)
      controller.render()
      expect(skip.hidden).toBe(true)

      controller.capability.search.createValidator.mockReturnValue(failingValidator("MapperError: docsMapper is not a function"))
      await controller.validate()
      expect(skip.hidden).toBe(true)

      controller.capability.search.createValidator.mockReturnValue(failingValidator("nope"))
      await controller.validate()
      expect(skip.hidden).toBe(false)
    })

    it("knows every condition the wizard partial names in data-wizard-when", () => {
      // An unknown name is silently falsy, which would hide that element for good.
      const names = new Set([...WIZARD_ERB.matchAll(/data-wizard-when="([^"]+)"/g)].flatMap((match) => match[1].split(/\s+/)))
      const known = Object.keys(mount({ step: STEPS.endpoint }).conditions())

      expect(names.size).toBeGreaterThan(10)
      expect([...names].filter((name) => !known.includes(name))).toEqual([])
    })

    it("requires the Mapper Wizard for a new generic Search API endpoint, but not an existing one", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "searchapi", searchEnginePreset: "searchapi" } })
      const notice = gated(controller, "mapper-required")
      const continueButton = gated(controller, "can-validate")
      const ping = gated(controller, "can-ping")
      controller.render()
      expect([notice.hidden, continueButton.hidden, ping.hidden]).toEqual([false, true, false])

      controller.settings.searchEndpointId = 7
      controller.render()
      expect([notice.hidden, continueButton.hidden]).toEqual([true, false])
    })

    it("abandons the draft case before opening the Mapper Wizard", async () => {
      const assign = vi.fn()
      vi.stubGlobal("location", { assign, search: "", protocol: "http:" })
      const controller = mount({ step: STEPS.endpoint })
      controller.mapperWizardUrlValue = "http://quepid/search_endpoints/mapper_wizard"

      await controller.goToMapperWizard({ preventDefault: vi.fn() })

      expect(controller.capability.case.delete).toHaveBeenCalledWith({ id: 5 })
      expect(modal.hide).toHaveBeenCalled()
      expect(assign).toHaveBeenCalledWith("http://quepid/search_endpoints/mapper_wizard")
      vi.unstubAllGlobals()
    })

    it("keeps Continue disabled for a static endpoint until its CSV is imported", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "static" } })
      const live = gated(controller, "live")
      const staticSection = gated(controller, "static")
      controller.render()
      expect(controller.continueButtonTargets[0].disabled).toBe(true)
      expect([live.hidden, staticSection.hidden]).toEqual([true, false])

      controller.staticImported = true
      controller.render()
      expect(controller.continueButtonTargets[0].disabled).toBe(false)
    })

    it("ignores a leftover URL's protocol for a static endpoint, whose URL import replaces", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "static", searchUrl: "https://example.com/api/search" } })
      controller.capability.navigation.needToRedirectProtocol.mockReturnValue(true)

      expect(controller.tlsMismatch()).toBe(false)
      controller.settings.searchEngine = "solr"
      expect(controller.tlsMismatch()).toBe(true)
    })

    it("shows the URL tip and basic auth only where the engine supports them", () => {
      const controller = mount({ step: STEPS.endpoint, settings: { urlFormat: "http://host:8983/<index>/select", supportsBasicAuth: false } })
      const tip = gated(controller, "url-format")
      const basicAuth = gated(controller, "basic-auth")
      controller.render()
      expect([tip.hidden, basicAuth.hidden]).toEqual([false, true])

      controller.settings.searchEndpointId = 3
      controller.render()
      expect(tip.hidden).toBe(true)
    })

    it("notes that static endpoints cannot be shared when the user has any", () => {
      const controller = mount({ step: STEPS.endpoint })
      const note = gated(controller, "static-endpoints")
      controller.searchEndpoints = [{ id: 1, searchEngine: "static" }]
      controller.render()
      expect(note.hidden).toBe(false)
    })

    it("fills the Solr curl command, direct link and wiki link from the pending settings", () => {
      const controller = mount({
        step: STEPS.endpoint,
        settings: { searchEngine: "solr", searchUrl: "http://solr:8983/solr/tmdb/select", basicAuthCredential: "u:p", proxyRequests: true, searchEndpointId: 4 }
      })
      const link = document.createElement("a")
      const wiki = document.createElement("a")
      Object.assign(controller, {
        curlAuthTarget: document.createElement("span"), hasCurlAuthTarget: true,
        solrConfigUrlTarget: document.createElement("span"), hasSolrConfigUrlTarget: true,
        endpointLinkTargets: [link], wikiLinkTargets: [wiki]
      })
      controller.capability.settings.troubleshootingWikiUrl = vi.fn(() => "https://github.com/o19s/quepid/wiki/Troubleshooting-Solr-and-Quepid")

      controller.render()

      expect(controller.curlAuthTarget.textContent).toBe("-u u:p ")
      expect(controller.solrConfigUrlTarget.textContent).toBe("http://solr:8983/solr/tmdb/config")
      expect(link.getAttribute("href")).toBe("/proxy/1http://solr:8983/solr/tmdb/select")
      expect(wiki.getAttribute("href")).toBe("https://github.com/o19s/quepid/wiki/Troubleshooting-Solr-and-Quepid")
      expect(controller.capability.settings.proxyUrlFor).toHaveBeenCalledWith(4)
    })
  })

  describe("display field suggestions", () => {
    it("offers discovered fields, excluding ones already chosen, and adds a clicked one", async () => {
      const controller = mount({ step: STEPS.endpoint })
      Object.assign(controller, {
        searchFieldListTarget: document.createElement("datalist"), hasSearchFieldListTarget: true,
        idFieldListTarget: document.createElement("datalist"), hasIdFieldListTarget: true,
        fieldSuggestionsTarget: document.createElement("div"), hasFieldSuggestionsTarget: true
      })
      controller.capability.settings.pick.mockReturnValue({ idField: "id", titleField: "title" })
      controller.capability.search.createValidator.mockReturnValue(passingValidator({ fields: ["title", "body", "year"], idFields: ["id"] }))

      await controller.validate()

      expect([...controller.searchFieldListTarget.options].map((option) => option.value)).toEqual(["title", "body", "year"])
      expect([...controller.idFieldListTarget.options].map((option) => option.value)).toEqual(["id"])
      expect([...controller.fieldSuggestionsTarget.children].map((button) => button.textContent)).toEqual(["body", "year"])

      controller.addDisplayField({ params: { field: "year" } })
      controller.addDisplayField({ params: { field: "year" } })

      expect(controller.settings.additionalFields).toEqual(["year"])
      expect([...controller.fieldSuggestionsTarget.children].map((button) => button.textContent)).toEqual(["body"])
    })

    it("filters by the token being typed, keeps a thumb: modifier, and replaces the partial token", () => {
      const controller = mount({ step: STEPS.fields, settings: { titleField: "title", idField: "id" } })
      controller.searchFields = ["title", "overview", "poster_path", "cast"]
      const typed = (value) => controller.updateSetting({ target: { type: "text", value, dataset: { wizardField: "additionalFields" } } })

      typed("cast, thumb:pos")
      expect(controller.fieldSuggestions()).toEqual(["thumb:poster_path"])

      controller.addDisplayField({ params: { field: "thumb:poster_path" } })
      expect(controller.settings.additionalFields).toEqual(["cast", "thumb:poster_path"])

      typed("cast, thumb:poster_path, ")
      expect(controller.fieldSuggestions()).toEqual(["overview"])
    })

    it("does not rewrite the field list while the user is typing in it", () => {
      const controller = mount({ step: STEPS.fields })
      const input = document.body.appendChild(document.createElement("input"))
      Object.assign(controller, { additionalFieldsTarget: input, hasAdditionalFieldsTarget: true })
      input.focus()
      input.value = "overview, "

      controller.updateSetting({ target: { type: "text", value: input.value, dataset: { wizardField: "additionalFields" } } })

      expect(input.value).toBe("overview, ")
      input.blur()
      controller.render()
      expect(input.value).toBe("overview")
      input.remove()
    })
  })

  it("opens the modal statically (no backdrop dismiss, no escape) when opened", () => {
    const controller = mount()
    controller.open()
    expect(getOrCreateBsModal).toHaveBeenCalledWith(controller.element, { backdrop: "static", keyboard: false })
    expect(modal.show).toHaveBeenCalled()
  })
})

it("validates Vespa parameter lists and bare YQL using named scalar arguments", async () => {
  for (const [input, expected] of [
    ["yql=select * from movies&ranking.profile=bm25", { yql: "select * from movies", "ranking.profile": "bm25" }],
    ["select * from movies", { yql: "select * from movies" }]
  ]) {
    const controller = mount({ step: STEPS.endpoint, settings: { searchEngine: "searchapi", bareQueryParam: "yql", queryParams: input, testQuery: input } })
    controller.capability.search.createValidator.mockReturnValue(passingValidator())
    await controller.validate()
    expect(controller.capability.search.createValidator).toHaveBeenCalledWith(expect.objectContaining({ args: expected }))
  }
})

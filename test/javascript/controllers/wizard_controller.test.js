import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import WizardController from "controllers/wizard_controller"
import { getOrCreateBsModal } from "utils/bs_modal"
import { getWizardCapabilities } from "utils/core_capabilities_runtime"
import { getCoreCapabilities } from "utils/core_capability_access"
import { importSnapshotsToCase } from "utils/snapshot_import"

const modal = { show: vi.fn(), hide: vi.fn() }

vi.mock("utils/bs_modal", () => ({ getOrCreateBsModal: vi.fn(() => modal) }))
vi.mock("utils/core_capabilities_runtime", () => ({ getWizardCapabilities: vi.fn() }))
vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: vi.fn() }))
vi.mock("utils/snapshot_import", () => ({ importSnapshotsToCase: vi.fn() }))
vi.mock("utils/quepid_root", () => ({ getQuepidRootUrl: () => "http://quepid" }))

const STEPS = { welcome: 0, name: 1, endpoint: 2, fields: 3, query: 4, finish: 5 }
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
      caseNo: vi.fn(() => 5)
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
  const controller = Object.create(WizardController.prototype)
  controller.element = element
  controller.stepTargets = Array.from({ length: 6 }, () => element.appendChild(document.createElement("div")))
  controller.trackerTargets = Array.from({ length: 6 }, () => element.appendChild(document.createElement("button")))
  controller.continueButtonTargets = [element.appendChild(document.createElement("button"))]
  controller.tlsProtocolTargets = []
  controller.searchEndpoints = []
  controller.mapperEngines = []
  controller.newQueries = []
  controller.staticRows = []
  controller.stepIndex = step
  controller.loaded = true
  controller.capability = makeCapability()
  controller.settings = { searchEngine: "solr", searchUrl: "http://solr", caseName: "My Case", ...settings }
  const alert = document.createElement("div")
  controller.hasAlertTarget = true
  controller.alertTarget = alert
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

    it("retries when capabilities are not ready, then gives up with an error after 100 attempts", async () => {
      vi.useFakeTimers()
      getWizardCapabilities.mockRejectedValue(new Error("not ready"))
      const controller = mount()
      controller.loaded = false

      await controller.loadWizard()
      await vi.advanceTimersByTimeAsync(100)
      expect(getWizardCapabilities).toHaveBeenCalledTimes(2)

      controller.loadAttempts = 100
      await controller.loadWizard()
      expect(controller.error).toMatch(/Unable to load the case wizard/)
      vi.useRealTimers()
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
    it("moves to the fields step and derives id/title fields and fieldSpec on success", async () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate()

      expect(controller.stepIndex).toBe(STEPS.fields)
      expect(controller.searchFields).toEqual(["title", "body"])
      expect(controller.settings.idField).toBe("id")
      expect(controller.settings.titleField).toBe("title")
      expect(controller.settings.fieldSpec).toBe("id:id, title:title")
      expect(controller.validating).toBe(false)
    })

    it("stays on the step when only validating, and keeps fields the user already chose", async () => {
      const controller = mount({ step: STEPS.endpoint, settings: { idField: "mine", titleField: "mine_title" } })
      controller.capability.search.createValidator.mockReturnValue(passingValidator())

      await controller.validate(true)

      expect(controller.stepIndex).toBe(STEPS.endpoint)
      expect(controller.settings.idField).toBe("mine")
      expect(controller.urlValid).toBe(true)
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
      controller.hasTlsReloadLinkTarget = true
      controller.tlsReloadLinkTarget = document.createElement("a")

      await controller.validate()

      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
      expect(controller.tlsWarningTarget.hidden).toBe(false)
      expect(controller.tlsReloadLinkTarget.getAttribute("href")).toContain("showWizard=true")
    })

    it("skipValidation jumps straight to the fields step", () => {
      const controller = mount({ step: STEPS.endpoint })
      controller.skipValidation()
      expect(controller.stepIndex).toBe(STEPS.fields)
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

      expect(controller.queryListTarget.querySelectorAll(".wiz_new_query")).toHaveLength(2)
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

    it("imports rows as a snapshot, switches to static, and collects unique queries", async () => {
      importSnapshotsToCase.mockResolvedValue([{ id: 11 }])
      const controller = mount()

      await controller.importStatic(csvFile(`${HEADER}\nstar wars,d1,1,A\nstar wars,d2,2,B\nalien,d3,1,C\n,,,`))

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
      expect(controller.settings.searchUrl).toBe("/root/api/cases/5/snapshots/11/search")
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
        persistQueries: vi.fn(() => Promise.resolve(["p"])),
        commitPersistedQueries: vi.fn(() => Promise.resolve())
      }
      getCoreCapabilities.mockReturnValue({ queryCapabilities, queryLifecycle })
      getOrCreateBsModal.mockReturnValue(modal)
    })

    it("renames the case, saves settings with the new queries, persists queries, and closes", async () => {
      const controller = mount({ step: STEPS.finish, settings: { caseName: "Named", searchEngine: "solr" } })
      controller.newQueries = [{ queryString: "a" }, { queryString: "b" }]

      await controller.finish()

      const { case: c, settings } = controller.capability
      expect(c.rename).toHaveBeenCalledWith({ id: 5 }, "Named")
      expect(settings.update).toHaveBeenCalledWith(expect.objectContaining({ newQueries: controller.newQueries }))
      expect(queryCapabilities.changeSettings).toHaveBeenCalledWith(5, expect.anything())
      expect(queryLifecycle.persistQueries).toHaveBeenCalledWith(5, ["a", "b"])
      expect(queryLifecycle.commitPersistedQueries).toHaveBeenCalledWith(["p"])
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

      expect(queryLifecycle.persistQueries).not.toHaveBeenCalled()
    })

    it("starts the tour only for first-time wizard users", async () => {
      vi.useFakeTimers()
      window.setupAndStartTour = vi.fn()
      const first = mount({ step: STEPS.finish })
      await first.finish()
      vi.advanceTimersByTime(1500)
      expect(window.setupAndStartTour).toHaveBeenCalledTimes(1)

      const returning = mount({ step: STEPS.finish })
      returning.capability.user.current.mockReturnValue({ completedCaseWizard: true })
      await returning.finish()
      vi.advanceTimersByTime(1500)
      expect(window.setupAndStartTour).toHaveBeenCalledTimes(1)

      delete window.setupAndStartTour
      vi.useRealTimers()
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

  it("opens the modal statically (no backdrop dismiss, no escape) on wizard:open", () => {
    const controller = mount()
    controller.open()
    expect(getOrCreateBsModal).toHaveBeenCalledWith(controller.element, { backdrop: "static", keyboard: false })
    expect(modal.show).toHaveBeenCalled()
  })
})

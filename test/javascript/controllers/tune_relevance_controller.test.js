import { buildControllerFixture } from "../support/controller_fixture"
import coreFlash from "utils/core_flash"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TuneRelevanceController from "controllers/tune_relevance_controller"
import { getTuneRelevanceCapabilities } from "utils/core_capabilities_runtime"

vi.mock("utils/core_flash", () => ({ default: { show: vi.fn(), hide: vi.fn() } }))
beforeEach(() => {
  coreFlash.show = vi.fn()
  coreFlash.hide = vi.fn()
})

vi.mock("utils/core_capabilities_runtime", () => ({
  getTuneRelevanceCapabilities: vi.fn()
}))

let flash

function makeTry(overrides = {}) {
  return { tryNo: 1, name: "Try 1", queryParams: "q=#$query##", searchUrl: "http://a", endpointName: "A", ...overrides }
}

function makeCapability(settingsOverrides = {}) {
  const settings = {
    searchEngine: "solr",
    searchUrl: "http://a",
    fieldSpec: "id title",
    numberOfRows: 10,
    escapeQuery: false,
    selectedTry: makeTry(),
    tries: [makeTry(), makeTry({ tryNo: 2, name: "Try 2", searchUrl: "http://b" })],
    ...settingsOverrides
  }
  Object.assign(settings, {
    endpointName: settings.selectedTry.endpointName,
    endpointArchived: settings.selectedTry.endpointArchived,
    mapperBasedSearchEngineId: settings.selectedTry.mapperBasedSearchEngineId,
    mapperBasedSearchEngineName: settings.selectedTry.mapperBasedSearchEngineName,
    searchEndpointId: settings.selectedTry.searchEndpointId
  })
  settings.tryNo = settings.selectedTry.tryNo
  settings.curatorVars = settings.selectedTry.curatorVars
  settings.updateVars = () => settings.selectedTry.updateVars?.()
  settings.applyEndpoint = values => {
    Object.assign(settings, values)
    Object.assign(settings.selectedTry, values)
  }
  Object.defineProperty(settings, "queryParams", {
    get: () => settings.selectedTry.queryParams,
    set: value => { settings.selectedTry.queryParams = value }
  })
  const capability = {
    settings: {
      editable: vi.fn(() => settings.selectedTry ? settings : null),
      tries: vi.fn(() => settings.tries),
      save: vi.fn(),
      duplicateTry: vi.fn(() => Promise.resolve({ name: "Try 3" })),
      renameTry: vi.fn(() => Promise.resolve()),
      deleteTry: vi.fn(() => Promise.resolve()),
      supportsEscapeQuery: vi.fn(() => true),
      troubleshootingWikiUrl: vi.fn(() => null)
    },
    endpoints: {
      fetchForCase: vi.fn(() => Promise.resolve()),
      all: vi.fn(() => []),
      usesJsonQueryParams: vi.fn(() => false),
      isEsOrOs: vi.fn(() => false)
    },
    navigation: {
      currentCaseNo: vi.fn(() => 5),
      goToTry: vi.fn(),
      rootUrl: vi.fn(() => "/"),
      needToRedirectProtocol: vi.fn(() => false),
      swapUrlTls: vi.fn(() => ["https://x", "https"]),
      appendQueryParams: vi.fn((url, qs) => `${url}?${qs}`)
    },
    case: {
      selected: vi.fn(() => ({ nightly: false })),
      updateNightly: vi.fn(),
      runEvaluation: vi.fn(() => Promise.resolve())
    },
    search: { isTemplateCall: vi.fn(() => false) }
  }
  return { capability, settings }
}

// Logic-only specs: these call controller methods on hand-built targets and so cannot detect drift in the
// ERB's data-action/target wiring. That wiring, and everything the user clicks, is covered against the
// live app in test/playwright/tune_relevance.spec.ts.
function template(html) {
  const node = document.createElement("template")
  node.innerHTML = html
  return node
}

function mount(settingsOverrides) {
  const element = document.createElement("div")
  element.innerHTML = `
    <button data-tune-relevance-tab-param="developer"></button>
    <button data-tune-relevance-tab-param="curator"></button>
    <button data-tune-relevance-tab-param="history"></button>
    <div data-tune-panel="developer"></div>
    <div data-tune-panel="curator"></div>
    <div data-tune-panel="history"></div>
    <button data-tune-relevance-target="action" data-action="click->tune-relevance#save"></button>`
  const targets = {
    tab: [...element.querySelectorAll("[data-tune-relevance-tab-param]")],
    panel: [...element.querySelectorAll("[data-tune-panel]")],
    action: [...element.querySelectorAll('[data-tune-relevance-target="action"]')],
    sectionBody: []
  }
  targets.saveButton = targets.action[0]
  const target = (name, node) => {
    targets[name] = node
    element.appendChild(node)
  }

  target("fieldSpec", Object.assign(document.createElement("input"), { value: "" }))
  target("numberOfRows", Object.assign(document.createElement("input"), { value: "10" }))
  target("escapeQuery", Object.assign(document.createElement("input"), { type: "checkbox" }))
  target("nightly", Object.assign(document.createElement("input"), { type: "checkbox" }))
  target("runEvaluation", document.createElement("button"))
  target("historyList", document.createElement("ul"))
  target("queryWarning", document.createElement("div"))
  target("curatorVars", document.createElement("div"))
  target("curatorVarTemplate", template('<div class="slider-wrap"><label class="mb-0"></label><input type="text" class="slider-val form-control form-control-sm" data-action="input->tune-relevance#updateCuratorVariable"></div>'))
  target("historyItemTemplate", template('<li class="try-history-item" data-action="click->tune-relevance#navigateToTry"><button type="button" class="btn btn-circle try-details" data-try-details data-action="click->tune-relevance#openTryDetails">...</button><span data-try-name></span> <span data-try-query></span>... <span data-try-endpoint></span></li>'))
  target("tlsWarning", document.createElement("div"))
  target("tlsProtocol", document.createElement("span"))
  target("endpointSelect", document.createElement("select"))
  target("endpointSearch", document.createElement("input"))
  target("endpointSuggestions", document.createElement("div"))
  target("endpointNoResults", document.createElement("div"))
  target("tryModal", document.createElement("div"))
  target("tryTitle", document.createElement("div"))
  target("tryQueryParams", document.createElement("div"))
  target("tryEndpointLink", document.createElement("a"))
  target("tryBrowseLink", document.createElement("a"))
  target("tryFieldSpec", document.createElement("div"))
  target("tryVariables", document.createElement("div"))
  target("tryNameInput", document.createElement("input"))
  target("tryRenameForm", document.createElement("form"))
  target("tryRenameAction", document.createElement("button"))
  target("tryDelete", document.createElement("button"))

  const { capability, settings } = makeCapability(settingsOverrides)
  const controller = buildControllerFixture(TuneRelevanceController, {
    element,
    targets,
    overrides: { capability, settings, tab: "developer", searchEndpoints: [] }
  })
  return { controller, capability, settings, element }
}

const errorFlash = () => flash.show.mock.calls.filter(([kind]) => kind === "error").map(([, msg]) => msg)
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe("TuneRelevanceController", () => {
  beforeEach(() => {
    flash = { show: vi.fn(), hide: vi.fn() }
    Object.assign(coreFlash, flash)
    // happy-dom does not implement the Option constructor
    vi.stubGlobal("Option", function Option(text, value) {
      return Object.assign(document.createElement("option"), { textContent: text, value })
    })
    window.bootstrap = { Modal: { getOrCreateInstance: vi.fn(() => ({ show: vi.fn(), hide: vi.fn() })) } }
  })
  afterEach(() => {
    delete window.bootstrap
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe("loading", () => {
    it("shows an error when capabilities fail to load", async () => {
      getTuneRelevanceCapabilities.mockRejectedValue(new Error("boom"))
      const { controller } = mount()

      controller.loadCapabilities()
      await flush()

      expect(errorFlash()).toEqual(["boom"])
    })

    it("retries until the selected try is available", () => {
      vi.useFakeTimers()
      const { controller, capability, settings } = mount()
      settings.selectedTry = null
      const refresh = vi.spyOn(controller, "refresh").mockImplementation(() => {})

      controller.load()
      expect(refresh).not.toHaveBeenCalled()

      settings.selectedTry = makeTry()
      vi.advanceTimersByTime(200)

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(capability.endpoints.fetchForCase).toHaveBeenCalledWith(5)
    })

    it("reopens on the tab the drawer was handed off with", () => {
      const { controller } = mount()
      vi.spyOn(controller, "refresh").mockImplementation(() => {})
      controller.hasPaneOutlet = true
      controller.paneOutlet = { handoff: { tab: "history", width: 450 } }

      controller.load()

      expect(controller.tab).toBe("history")
    })

    it("ignores a handed-off tab that does not exist", () => {
      const { controller } = mount()
      vi.spyOn(controller, "refresh").mockImplementation(() => {})
      controller.hasPaneOutlet = true
      controller.paneOutlet = { handoff: { tab: "bogus" } }

      controller.load()

      expect(controller.tab).toBe("developer")
    })
  })

  describe("tabs", () => {
    it.each([
      ["q=star%26wars&defType=edismax&tie=1", "q=star%26wars\n&defType=edismax\n&tie=1"],
      ["q=star\n&tie=1", "q=star\n&tie=1"],
      ['{"query":{"query_string":{"query":"a&b"}}}', '{"query":{"query_string":{"query":"a&b"}}}'],
      ['{"query":"a&b"', '{"query":"a&b"']
    ])("formats URL parameters for display without changing saved input: %s", (value, displayed) => {
      const { controller, settings } = mount()
      settings.selectedTry.queryParams = value
      const textarea = document.createElement("textarea")
      controller.element.append(textarea)
      controller.hasQueryEditorTarget = true
      controller.queryEditorTarget = textarea
      controller.mountEditor()
      try {
        controller.refreshQueryEditor()
        expect(controller.editor.getValue()).toBe(displayed)
        expect(settings.selectedTry.queryParams).toBe(value)
        controller.refreshQueryEditor()
        expect(controller.editor.getValue()).toBe(displayed)
      } finally {
        controller.editor.view.destroy()
      }
    })

    it("keeps CodeMirror edits in the selected try when extracting knobs and switching tabs", () => {
      const { controller, settings } = mount()
      const textarea = document.createElement("textarea")
      controller.element.append(textarea)
      controller.hasQueryEditorTarget = true
      controller.queryEditorTarget = textarea
      controller.editor = null
      settings.selectedTry.updateVars = vi.fn()
      controller.mountEditor()
      const edited = "q=#$query##&boost=##titleBoost##&deftype=edismax"

      controller.editor.setValue(edited)
      controller.showTab("curator")
      controller.refreshQueryEditor()

      expect(settings.selectedTry.queryParams).toBe(edited)
      expect(controller.editor.getValue()).toBe(edited.replaceAll("&", "\n&"))
      expect(settings.selectedTry.updateVars).toHaveBeenCalled()
      expect(controller.queryWarningTarget.textContent).toContain("defType")
      controller.editor.view.destroy()
    })
  })

  describe("curator variables", () => {
    it.each(["8", "1.12", "true", "-0.5"])("retains knob text %s at its original variable index", (value) => {
      const variables = [{ name: "unused", value: "query", inQueryParams: false }, { name: "boost", value: "2", inQueryParams: true }]
      const { controller, settings } = mount({ selectedTry: makeTry({ curatorVars: variables }) })
      controller.refreshCuratorVars()
      const input = controller.curatorVarsTarget.querySelector("input")
      expect(input.dataset.tuneRelevanceIndexParam).toBe("1")
      input.value = value
      controller.updateCuratorVariable({ currentTarget: input, params: { index: 1 } })
      expect(settings.selectedTry.curatorVars[1].value).toBe(value)
      expect(settings.selectedTry.curatorVars[0].value).toBe("query")
      controller.refreshCuratorVars()
      expect(controller.curatorVarsTarget.querySelector("input").value).toBe(value)
    })
  })

  describe("displayed field selections", () => {
    it("preserves unchanged syntax, supports modifiers and custom values, refreshes, and cleans up", () => {
      const { controller, settings } = mount({ fieldSpec: "id:movie_id, title:title overview thumb:poster_path" })
      controller.refreshSettings()
      const select = controller.displayedFieldsSelect
      expect(select.items).toEqual(["id:movie_id", "title:title", "overview", "thumb:poster_path"])
      expect(controller.displayedFieldsValue()).toBe(settings.fieldSpec)
      select.removeItem("overview")
      select.createItem("cast")
      select.setTextboxValue("image:backdrop_path")
      expect(controller.displayedFieldsValue()).toBe("id:movie_id, title:title, thumb:poster_path, cast, image:backdrop_path")
      settings.fieldSpec = "id:id title:name"
      controller.refreshSettings()
      expect(select.items).toEqual(["id:id", "title:name"])
      controller.disconnect()
      expect(controller.fieldSpecTarget.tomselect).toBeUndefined()
    })
  })

  describe("displayed field discovery", () => {
    it("uses the wizard validator with proxy/auth settings and discovers fields without editing selections", async () => {
      const { controller, capability } = mount({ fieldSpec: "id:id title:title", proxyRequests: true, customHeaders: '{"X-Test":"value"}' })
      capability.settings.proxyUrlFor = vi.fn(() => "http://proxy/")
      const validator = { fields: ["id", "title", "title_bidirect", "poster_path"], validateUrl: vi.fn().mockResolvedValue() }
      capability.search.createValidator = vi.fn(() => validator)
      controller.refreshSettings()
      await controller.discoverDisplayedFields()
      expect(capability.search.createValidator).toHaveBeenCalledWith(expect.objectContaining({ proxyUrl: "http://proxy/", customHeaders: { "X-Test": "value" } }))
      expect(controller.displayedFieldsSelect.options.title_bidirect).toBeDefined()
      controller.addDiscoveredFieldOptions("thumb:pos")
      expect(controller.displayedFieldsSelect.options["thumb:poster_path"]).toBeDefined()
      expect(controller.displayedFieldsSelect.items).toEqual(["id:id", "title:title"])
      await controller.discoverDisplayedFields()
      expect(validator.validateUrl).toHaveBeenCalledTimes(1)
      controller.disconnect()
    })

    it("ignores stale endpoint responses and retries failures without losing edits", async () => {
      const { controller, capability, settings } = mount({ fieldSpec: "id:id title:title" })
      let resolve
      const validator = { fields: ["old_field"], validateUrl: vi.fn(() => new Promise(done => { resolve = done })) }
      capability.search.createValidator = vi.fn(() => validator)
      controller.refreshSettings()
      const pending = controller.discoverDisplayedFields()
      settings.searchUrl = "http://other"
      resolve()
      await pending
      expect(controller.displayedFieldsSelect.options.old_field).toBeUndefined()
      validator.validateUrl.mockRejectedValueOnce(new Error("offline"))
      await controller.discoverDisplayedFields()
      expect(controller.displayedFieldsValue()).toBe("id:id title:title")
      validator.fields = ["new_field"]
      validator.validateUrl.mockResolvedValue()
      await controller.discoverDisplayedFields()
      expect(controller.displayedFieldsSelect.options.new_field).toBeDefined()
      controller.disconnect()
    })
  })

  describe("save", () => {
    it("keeps the drawer open on the drawer's current tab once the save is under way", () => {
      const { controller } = mount()
      controller.hasPaneOutlet = true
      controller.paneOutlet = { keepOpenAcrossNavigation: vi.fn() }
      controller.showTab("curator")

      controller.keepDrawerOpen()

      expect(controller.paneOutlet.keepOpenAcrossNavigation).toHaveBeenCalledWith({ tab: "curator" })
    })

    it("hands off the drawer and navigates only after the new try is saved", async () => {
      const { controller, capability } = mount()
      controller.hasPaneOutlet = true
      controller.paneOutlet = { keepOpenAcrossNavigation: vi.fn() }
      controller.showTab("curator")
      let resolve
      capability.settings.save.mockReturnValue(new Promise(done => { resolve = done }))

      const pending = controller.save()
      expect(controller.paneOutlet.keepOpenAcrossNavigation).not.toHaveBeenCalled()
      expect(capability.navigation.goToTry).not.toHaveBeenCalled()
      resolve({ tryNo: 4 })
      await pending

      expect(controller.paneOutlet.keepOpenAcrossNavigation).toHaveBeenCalledWith({ tab: "curator" })
      expect(capability.navigation.goToTry).toHaveBeenCalledWith(4)
      expect(controller.paneOutlet.keepOpenAcrossNavigation.mock.invocationCallOrder[0])
        .toBeLessThan(capability.navigation.goToTry.mock.invocationCallOrder[0])
    })

    it("rejects a non-numeric number of results", () => {
      const { controller, capability } = mount()
      controller.numberOfRowsTarget.value = "abc"

      controller.save()

      expect(capability.settings.save).not.toHaveBeenCalled()
    })

    it("rejects invalid JSON for engines that need a JSON query DSL", () => {
      const { controller, capability, settings } = mount()
      capability.endpoints.usesJsonQueryParams.mockReturnValue(true)
      settings.selectedTry.queryParams = "{not json"

      controller.save()

      expect(capability.settings.save).not.toHaveBeenCalled()
      expect(errorFlash()).toEqual(["Please provide a valid formatted JSON object for the query DSL."])
    })

    it("pretty-prints valid JSON before saving", () => {
      const { controller, capability, settings } = mount()
      capability.endpoints.usesJsonQueryParams.mockReturnValue(true)
      settings.selectedTry.queryParams = '{"query":{"match_all":{}}}'

      controller.save()

      expect(settings.selectedTry.queryParams).toBe(JSON.stringify({ query: { match_all: {} } }, null, 2))
      expect(capability.settings.save).toHaveBeenCalledWith(settings)
    })

    it("treats searchapi params starting with { as JSON but leaves plain text alone", async () => {
      const { controller, capability, settings } = mount({ searchEngine: "searchapi" })
      settings.selectedTry.queryParams = "q=hello"

      await controller.save()

      expect(settings.selectedTry.queryParams).toBe("q=hello")
      expect(capability.settings.save).toHaveBeenCalled()

      capability.settings.save.mockClear()
      settings.selectedTry.queryParams = "{bad"
      await controller.save()
      expect(capability.settings.save).not.toHaveBeenCalled()
    })

    it("blocks repeat submissions while a save is pending", async () => {
      const { controller, capability } = mount()
      let resolve
      capability.settings.save.mockImplementationOnce(() => new Promise(resolveSave => { resolve = resolveSave }))
      const pending = controller.save()
      await controller.save()

      expect(controller.saveButtonTarget.disabled).toBe(true)
      expect(capability.settings.save).toHaveBeenCalledOnce()
      resolve()
      await pending
      expect(controller.saveButtonTarget.disabled).toBe(false)
    })

  })

  describe("endpoints", () => {
    const endpoint = { id: 9, name: "Prod", searchEngine: "es", endpointUrl: "http://es", apiMethod: "POST", customHeaders: { a: 1 }, proxyRequests: true }

    it("copies the chosen endpoint into settings and the selected try", () => {
      const { controller, settings } = mount()
      controller.searchEndpoints = [endpoint]
      vi.spyOn(controller, "refresh").mockImplementation(() => {})

      controller.updateEndpoint({ target: { value: "9" } })

      expect(settings.searchEndpointId).toBe(9)
      expect(settings.searchUrl).toBe("http://es")
      expect(settings.customHeaders).toBe(JSON.stringify({ a: 1 }, null, 2))
      expect(settings.selectedTry).toMatchObject({ searchEngine: "es", endpointName: "Prod", proxyRequests: true })
    })

    it.each([undefined, null, ""])("copies absent endpoint method %s without wizard defaults", apiMethod => {
      const { controller, settings } = mount()
      controller.searchEndpoints = [{ id: 9, apiMethod, customHeaders: null, mapperBasedSearchEngineId: "vespa" }]
      const queryParams = settings.selectedTry.queryParams
      vi.spyOn(controller, "refresh").mockImplementation(() => {})
      controller.updateEndpoint({ target: { value: "9" } })
      expect(settings.apiMethod).toBe(apiMethod)
      expect(settings.selectedTry.apiMethod).toBe(apiMethod)
      expect(settings.selectedTry.customHeaders).toBeNull()
      expect(settings.selectedTry.mapperBasedSearchEngineId).toBe("vespa")
      expect(settings.selectedTry.queryParams).toBe(queryParams)
    })

    it("ignores a selection that matches no endpoint", () => {
      const { controller, settings } = mount()
      controller.searchEndpoints = [endpoint]
      const refresh = vi.spyOn(controller, "refresh").mockImplementation(() => {})

      controller.updateEndpoint({ target: { value: "" } })

      expect(settings.searchEndpointId).toBeUndefined()
      expect(refresh).not.toHaveBeenCalled()
    })

  })

  describe("try management", () => {
    it("ignores try actions when no try is open", () => {
      const { controller, capability } = mount()
      controller.tryRenameFormTarget.hidden = true
      controller.toggleRename()
      controller.duplicateTry()
      controller.deleteTry()
      expect(controller.tryRenameFormTarget.hidden).toBe(true)
      expect(capability.settings.duplicateTry).not.toHaveBeenCalled()
      expect(capability.settings.deleteTry).not.toHaveBeenCalled()
    })

  })

  describe("nightly and evaluation", () => {
    it("does nothing when no case is selected", () => {
      const { controller, capability } = mount()
      capability.case.selected.mockReturnValue(null)

      controller.updateNightly()

      expect(capability.case.updateNightly).not.toHaveBeenCalled()
    })

  })
})

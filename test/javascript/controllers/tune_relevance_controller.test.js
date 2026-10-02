import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import TuneRelevanceController from "controllers/tune_relevance_controller"
import { getTuneRelevanceCapabilities } from "utils/core_capabilities_runtime"

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
  const capability = {
    settings: {
      editable: vi.fn(() => settings),
      reload: vi.fn(() => settings),
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
  const target = (name, node) => {
    const key = name.charAt(0).toUpperCase() + name.slice(1)
    controller[`has${key}Target`] = true
    controller[`${name}Target`] = node
    element.appendChild(node)
  }
  const controller = Object.create(TuneRelevanceController.prototype)
  controller.element = element
  controller.tabTargets = [...element.querySelectorAll("[data-tune-relevance-tab-param]")]
  controller.panelTargets = [...element.querySelectorAll("[data-tune-panel]")]
  controller.actionTargets = [...element.querySelectorAll('[data-tune-relevance-target="action"]')]
  controller.sectionBodyTargets = []
  controller.hasSaveButtonTarget = true
  controller.saveButtonTarget = controller.actionTargets[0]

  target("fieldSpec", Object.assign(document.createElement("input"), { value: "" }))
  target("numberOfRows", Object.assign(document.createElement("input"), { value: "10" }))
  target("escapeQuery", Object.assign(document.createElement("input"), { type: "checkbox" }))
  target("nightly", Object.assign(document.createElement("input"), { type: "checkbox" }))
  target("runEvaluation", document.createElement("button"))
  target("historyList", document.createElement("ul"))
  target("queryWarning", document.createElement("div"))
  target("curatorVars", document.createElement("div"))
  target("tlsWarning", document.createElement("div"))
  target("tlsReloadLink", document.createElement("a"))
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
  controller.capability = capability
  controller.settings = settings
  controller.tab = "developer"
  controller.searchEndpoints = []
  return { controller, capability, settings, element }
}

const errorFlash = () => flash.show.mock.calls.filter(([kind]) => kind === "error").map(([, msg]) => msg)
const flush = () => new Promise(resolve => setTimeout(resolve, 0))

describe("TuneRelevanceController", () => {
  beforeEach(() => {
    flash = { show: vi.fn(), hide: vi.fn() }
    window.quepidDom = { flash }
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
  })

  describe("declared Stimulus actions", () => {
    it("shows the tab and toggles the section named by the action params", () => {
      const { controller } = mount()
      controller.selectTab({ params: { tab: "history" } })
      expect(controller.tab).toBe("history")

      const body = document.createElement("div")
      body.dataset.sectionBody = "fields"
      controller.sectionBodyTargets = [body]
      controller.toggleSection({ params: { section: "fields" } })
      expect(body.classList.contains("d-none")).toBe(true)
      controller.toggleSection({ params: { section: "fields" } })
      expect(body.classList.contains("d-none")).toBe(false)
    })

    it("filters endpoints from the search input and submits renames without navigating", () => {
      const { controller } = mount()
      controller.renderEndpointSuggestions = vi.fn()
      controller.renameTry = vi.fn()
      controller.endpointSearchTarget.value = "movies"
      controller.filterEndpoints({ currentTarget: controller.endpointSearchTarget })
      expect(controller.renderEndpointSuggestions).toHaveBeenCalledWith("movies")
      const preventDefault = vi.fn()
      controller.submitRename({ preventDefault })
      expect(preventDefault).toHaveBeenCalledOnce()
      expect(controller.renameTry).toHaveBeenCalledOnce()
    })
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
  })

  describe("tabs", () => {
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
      expect(controller.editor.getValue()).toBe(edited)
      expect(settings.selectedTry.updateVars).toHaveBeenCalled()
      expect(controller.queryWarningTarget.textContent).toContain("defType")
      controller.editor.view.destroy()
    })
    it("activates the chosen tab, shows only its panel, and hides save on read-only tabs", () => {
      const { controller, element } = mount()

      controller.showTab("history")

      expect(element.querySelector('[data-tune-relevance-tab-param="history"]').classList.contains("active")).toBe(true)
      expect(element.querySelector('[data-tune-relevance-tab-param="history"]').getAttribute("aria-selected")).toBe("true")
      expect(element.querySelector('[data-tune-panel="history"]').hidden).toBe(false)
      expect(element.querySelector('[data-tune-panel="developer"]').hidden).toBe(true)
      expect(element.querySelector('[data-tune-relevance-target="action"]').hidden).toBe(true)

      controller.showTab("curator")
      expect(element.querySelector('[data-tune-relevance-target="action"]').hidden).toBe(false)
    })
  })

  describe("curator variables", () => {
    it("updates the original variable index when unused variables are filtered out", () => {
      const variables = [{ name: "unused", value: "query", inQueryParams: false }, { name: "boost", value: "2", inQueryParams: true }]
      const { controller, settings } = mount({ selectedTry: makeTry({ curatorVars: variables }) })
      controller.refreshCuratorVars()
      const input = controller.curatorVarsTarget.querySelector("input")
      expect(input.dataset.action).toBe("input->tune-relevance#updateCuratorVariable")
      expect(input.dataset.tuneRelevanceIndexParam).toBe("1")
      input.value = "8"
      controller.updateCuratorVariable({ currentTarget: input, params: { index: 1 } })
      expect(settings.selectedTry.curatorVars[1].value).toBe("8")
      expect(settings.selectedTry.curatorVars[0].value).toBe("query")
      controller.refreshCuratorVars()
      expect(controller.curatorVarsTarget.querySelector("input").value).toBe("8")
    })
  })

  describe("save", () => {
    it("rejects an out-of-range number of results without saving", () => {
      const { controller, capability } = mount()
      controller.numberOfRowsTarget.value = "101"

      controller.save()

      expect(capability.settings.save).not.toHaveBeenCalled()
      expect(errorFlash()).toEqual(["Number of Results to Show must be between 1 and 100."])
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

    it("treats searchapi params starting with { as JSON but leaves plain text alone", () => {
      const { controller, capability, settings } = mount({ searchEngine: "searchapi" })
      settings.selectedTry.queryParams = "q=hello"

      controller.save()

      expect(settings.selectedTry.queryParams).toBe("q=hello")
      expect(capability.settings.save).toHaveBeenCalled()

      capability.settings.save.mockClear()
      settings.selectedTry.queryParams = "{bad"
      controller.save()
      expect(capability.settings.save).not.toHaveBeenCalled()
    })

    it("copies the form fields into settings before saving", () => {
      const { controller, capability, settings } = mount()
      controller.fieldSpecTarget.value = "id title body"
      controller.numberOfRowsTarget.value = "25"
      controller.escapeQueryTarget.checked = true

      controller.save()

      expect(settings.fieldSpec).toBe("id title body")
      expect(settings.numberOfRows).toBe("25")
      expect(settings.escapeQuery).toBe(true)
      expect(capability.settings.save).toHaveBeenCalledWith(settings)
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

    it("ignores a selection that matches no endpoint", () => {
      const { controller, settings } = mount()
      controller.searchEndpoints = [endpoint]
      const refresh = vi.spyOn(controller, "refresh").mockImplementation(() => {})

      controller.updateEndpoint({ target: { value: "" } })

      expect(settings.searchEndpointId).toBeUndefined()
      expect(refresh).not.toHaveBeenCalled()
    })

    it("suggests matching endpoints, capped at eight, and reports no results", () => {
      const { controller } = mount()
      controller.searchEndpoints = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `Prod ${i}` }))

      controller.renderEndpointSuggestions("prod")
      expect(controller.endpointSuggestionsTarget.children).toHaveLength(8)
      expect(controller.endpointNoResultsTarget.hidden).toBe(true)

      controller.renderEndpointSuggestions("zzz")
      expect(controller.endpointSuggestionsTarget.children).toHaveLength(0)
      expect(controller.endpointNoResultsTarget.hidden).toBe(false)

      controller.renderEndpointSuggestions("  ")
      expect(controller.endpointNoResultsTarget.hidden).toBe(true)
    })

    it("selecting a suggestion updates the endpoint", () => {
      const { controller } = mount()
      controller.searchEndpoints = [endpoint]
      const update = vi.spyOn(controller, "updateEndpoint").mockImplementation(() => {})

      controller.renderEndpointSuggestions("prod")
      const button = controller.endpointSuggestionsTarget.querySelector("button")
      expect(button.dataset.action).toBe("click->tune-relevance#selectEndpointSuggestion")
      expect(button.dataset.tuneRelevanceEndpointIdParam).toBe("9")
      controller.selectEndpointSuggestion({ params: { endpointId: 9 } })

      expect(update).toHaveBeenCalledWith({ target: controller.endpointSelectTarget })
    })
  })

  describe("warnings", () => {
    it("shows the TLS warning and hides save when the protocol mismatches", () => {
      const { controller, capability, element } = mount()
      capability.navigation.needToRedirectProtocol.mockReturnValue(true)

      controller.refreshTls()

      expect(controller.tlsWarningTarget.hidden).toBe(false)
      expect(controller.tlsProtocolTarget.textContent).toBe("https")
      expect(controller.tlsReloadLinkTarget.getAttribute("href")).toContain("https://x?")
      expect(element.querySelector('[data-tune-relevance-target="action"]').hidden).toBe(true)
    })

    it("does not warn when requests are proxied", () => {
      const { controller, capability } = mount({ proxyRequests: true })
      capability.navigation.needToRedirectProtocol.mockReturnValue(true)

      controller.refreshTls()

      expect(controller.tlsWarningTarget.hidden).toBe(true)
    })

    it("flags a likely Solr param typo in the query", () => {
      const { controller, settings } = mount()
      settings.selectedTry.queryParams = "q=foo&deftype=edismax"

      controller.refreshQueryEditor()

      expect(controller.queryWarningTarget.hidden).toBe(false)
      expect(controller.queryWarningTarget.innerHTML).toContain("defType")
    })

    it("hides the static-engine messages unless the engine is static", () => {
      const { controller, settings } = mount()
      controller.hasStaticEngineMessageTarget = true
      controller.staticEngineMessageTarget = document.createElement("div")

      controller.refreshQueryEditor()
      expect(controller.staticEngineMessageTarget.hidden).toBe(true)

      settings.searchEngine = "static"
      controller.refreshQueryEditor()
      expect(controller.staticEngineMessageTarget.hidden).toBe(false)
    })
  })

  describe("history", () => {
    it("lists non-deleted tries and navigates to a try when clicked", () => {
      const { controller, capability, settings } = mount()
      settings.tries.push(makeTry({ tryNo: 3, deleted: true }))

      controller.refreshHistory()

      const rows = controller.historyListTarget.querySelectorAll("li")
      expect(rows).toHaveLength(2)
      expect(rows[1].dataset.action).toBe("click->tune-relevance#navigateToTry")
      expect(rows[1].dataset.tuneRelevanceTryNoParam).toBe("2")
      controller.navigateToTry({ params: { tryNo: 2 } })
      expect(capability.navigation.goToTry).toHaveBeenCalledWith(2)
    })

    it("opens try details without navigating", () => {
      const { controller, capability } = mount()
      controller.refreshHistory()

      const details = controller.historyListTarget.querySelector("[data-try-details]")
      expect(details.dataset.action).toBe("click->tune-relevance#openTryDetails")
      expect(details.dataset.tuneRelevanceTryNoParam).toBe("1")
      const stopPropagation = vi.fn()
      controller.openTryDetails({ params: { tryNo: 1 }, stopPropagation })
      expect(stopPropagation).toHaveBeenCalledOnce()

      expect(capability.navigation.goToTry).not.toHaveBeenCalled()
      expect(controller.tryTitleTarget.textContent).toBe("Try 1")
      expect(controller.activeTry.tryNo).toBe(1)
    })
  })

  describe("try management", () => {
    it("disables delete when only one try remains", () => {
      const { controller, settings } = mount()
      settings.tries = [makeTry()]

      controller.showTryDetails(settings.tries[0])

      expect(controller.tryDeleteTarget.disabled).toBe(true)
    })

    it("toggles the rename form", () => {
      const { controller, settings } = mount()
      controller.showTryDetails(settings.tries[0])

      controller.toggleRename()
      expect(controller.tryRenameFormTarget.hidden).toBe(false)
      expect(controller.tryRenameActionTarget.textContent).toBe("Cancel Rename")

      controller.toggleRename()
      expect(controller.tryRenameFormTarget.hidden).toBe(true)
      expect(controller.tryRenameActionTarget.textContent).toBe("Rename")
    })

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

    it("renames a try, reloads settings, and confirms", async () => {
      const { controller, capability, settings } = mount()
      controller.showTryDetails(settings.tries[1])
      controller.tryNameInputTarget.value = "  Better name  "

      controller.renameTry()
      await flush()

      expect(capability.settings.renameTry).toHaveBeenCalledWith(2, "Better name")
      expect(capability.settings.reload).toHaveBeenCalled()
      expect(flash.show).toHaveBeenCalledWith("success", "Try renamed successfully.")
    })

    it("does not rename to a blank name", () => {
      const { controller, capability, settings } = mount()
      controller.showTryDetails(settings.tries[1])
      controller.tryNameInputTarget.value = "   "

      controller.renameTry()

      expect(capability.settings.renameTry).not.toHaveBeenCalled()
    })

    it("reports a failed rename", async () => {
      const { controller, capability, settings } = mount()
      capability.settings.renameTry.mockRejectedValue(new Error("x"))
      controller.showTryDetails(settings.tries[1])
      controller.tryNameInputTarget.value = "New"

      controller.renameTry()
      await flush()

      expect(errorFlash()).toEqual(["Unable to rename try."])
    })

    it("refuses to delete the active try", () => {
      const { controller, capability, settings } = mount()
      controller.showTryDetails(settings.tries[0])

      controller.deleteTry()

      expect(capability.settings.deleteTry).not.toHaveBeenCalled()
      expect(errorFlash()[0]).toMatch(/can not delete the currently active try \(Try 1\)/)
    })

    it("deletes a non-active try and reloads", async () => {
      const { controller, capability, settings } = mount()
      controller.showTryDetails(settings.tries[1])

      controller.deleteTry()
      await flush()

      expect(capability.settings.deleteTry).toHaveBeenCalledWith(2)
      expect(flash.show).toHaveBeenCalledWith("success", "Successfully deleted try!")
    })

    it("reports a failed delete", async () => {
      const { controller, capability, settings } = mount()
      capability.settings.deleteTry.mockRejectedValue(new Error("x"))
      controller.showTryDetails(settings.tries[1])

      controller.deleteTry()
      await flush()

      expect(errorFlash()).toEqual(["Unable to delete try."])
    })

    it("duplicates a try and reports the new name", async () => {
      const { controller, capability, settings } = mount()
      controller.showTryDetails(settings.tries[0])

      controller.duplicateTry()
      await flush()

      expect(capability.settings.duplicateTry).toHaveBeenCalledWith(1)
      expect(flash.show).toHaveBeenCalledWith("success", "Try Try 1 duplicated successfully as Try 3.")
    })

    it("reports a failed duplicate", async () => {
      const { controller, capability, settings } = mount()
      capability.settings.duplicateTry.mockReturnValue(Promise.reject(new Error("x")))
      controller.showTryDetails(settings.tries[0])

      controller.duplicateTry()
      await flush()

      expect(errorFlash()).toEqual(["Unable to duplicate try."])
    })
  })

  describe("nightly and evaluation", () => {
    it("persists the nightly checkbox on the selected case", () => {
      const { controller, capability } = mount()
      const kase = { nightly: false }
      capability.case.selected.mockReturnValue(kase)
      controller.nightlyTarget.checked = true

      controller.updateNightly()

      expect(kase.nightly).toBe(true)
      expect(capability.case.updateNightly).toHaveBeenCalledWith(kase)
    })

    it("does nothing when no case is selected", () => {
      const { controller, capability } = mount()
      capability.case.selected.mockReturnValue(null)

      controller.updateNightly()

      expect(capability.case.updateNightly).not.toHaveBeenCalled()
    })

    it("queues an evaluation for the selected try, disabling the button while it runs", async () => {
      const assign = vi.fn()
      vi.stubGlobal("location", { assign })
      const { controller, capability } = mount()

      controller.runEvaluation()
      expect(controller.runEvaluationTarget.disabled).toBe(true)
      expect(controller.runEvaluationTarget.textContent).toBe("Queuing evaluation job...")
      await flush()

      expect(capability.case.runEvaluation).toHaveBeenCalledWith(5, 1)
      expect(flash.show).toHaveBeenCalledWith("success", "Evaluation queued successfully.")
      expect(assign).toHaveBeenCalledWith("/")
      expect(controller.runEvaluationTarget.disabled).toBe(false)
      expect(controller.runEvaluationTarget.textContent).toBe("Rerun My Searches in the Background!")
      vi.unstubAllGlobals()
    })

    it("reports a failed evaluation and re-enables the button", async () => {
      const assign = vi.fn()
      vi.stubGlobal("location", { assign })
      const { controller, capability } = mount()
      capability.case.runEvaluation.mockReturnValue(Promise.reject(new Error("x")))

      controller.runEvaluation()
      await flush()

      expect(errorFlash()).toEqual(["Unable to queue evaluation."])
      expect(assign).not.toHaveBeenCalled()
      expect(controller.runEvaluationTarget.disabled).toBe(false)
      vi.unstubAllGlobals()
    })
  })
})

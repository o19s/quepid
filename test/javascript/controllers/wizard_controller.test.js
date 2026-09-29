import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import WizardController from "controllers/wizard_controller"
import { getOrCreateBsModal } from "utils/bs_modal"

const modal = vi.hoisted(() => ({ show: vi.fn(), hide: vi.fn() }))
vi.mock("utils/bs_modal", async (importOriginal) => ({
  ...(await importOriginal()),
  getOrCreateBsModal: vi.fn(() => modal)
}))

function buildController({ needToRedirect = false } = {}) {
  const element = document.createElement("div")
  const controller = Object.create(WizardController.prototype)
  controller.element = element
  controller.stepTargets = []
  controller.continueButtonTargets = []
  controller.stepIndex = 2
  controller.searchEndpoints = []
  controller.mapperEngines = []
  controller.settings = { searchEngine: "solr", searchEnginePreset: "solr", searchUrl: "http://solr.example/select" }
  controller.capability = {
    case: { selected: vi.fn(() => ({ caseNo: 6 })), delete: vi.fn(() => Promise.resolve()) },
    settings: { pick: vi.fn(() => ({ searchEngine: "solr", apiMethod: "JSONP" })) },
    navigation: {
      rootUrl: () => "/",
      needToRedirectProtocol: vi.fn(() => needToRedirect),
      swapUrlTls: () => ["https://quepid.example/case/6/try/1?protocolToSwitchTo=https", "https"],
      appendQueryParams: (url, params) => `${url}&${params}`
    }
  }
  return controller
}

function stubEndpointSelect(controller) {
  controller.hasEndpointSelectTarget = true
  controller.endpointSelectTarget = document.createElement("select")
  return controller.endpointSelectTarget
}

function stubTlsTargets(controller) {
  Object.assign(controller, {
    hasTlsWarningTarget: true,
    tlsWarningTarget: document.createElement("div"),
    tlsReloadLinkTarget: document.createElement("a"),
    tlsProtocolTargets: [document.createElement("code"), document.createElement("code")],
    hasEndpointContinueTarget: true,
    endpointContinueTarget: document.createElement("button"),
    hasSkipButtonTarget: true,
    skipButtonTarget: document.createElement("button")
  })
}

describe("WizardController", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    window.history.pushState({}, "", "/")
  })

  describe("close", () => {
    it("deletes the abandoned case before leaving, so no empty case is left behind", async () => {
      const controller = buildController()
      window.confirm = vi.fn(() => true)
      const navigate = vi.spyOn(window.location, "assign").mockImplementation(() => {})

      controller.close()
      await Promise.resolve()

      expect(controller.capability.case.delete).toHaveBeenCalledWith({ caseNo: 6 })
      expect(modal.hide).toHaveBeenCalled()
      expect(navigate).toHaveBeenCalledWith("/")
    })

    it("keeps the wizard open when the user declines", () => {
      const controller = buildController()
      window.confirm = vi.fn(() => false)

      controller.close()

      expect(controller.capability.case.delete).not.toHaveBeenCalled()
      expect(getOrCreateBsModal).not.toHaveBeenCalled()
    })

    it("just hides the modal when capabilities never loaded", () => {
      const controller = buildController()
      controller.capability = undefined
      window.confirm = vi.fn(() => true)

      controller.close()

      expect(modal.hide).toHaveBeenCalled()
    })
  })

  describe("existing endpoint choices", () => {
    it("starts with a blank option so the first endpoint can be chosen", () => {
      const controller = buildController()
      const select = stubEndpointSelect(controller)
      controller.searchEndpoints = [
        { id: 1, name: "TMDB Solr", searchEngine: "solr", endpointUrl: "http://solr.example/select" },
        { id: 2, name: "Static", searchEngine: "static" }
      ]

      controller.renderEndpointChoices()
      controller.render()

      expect([...select.options].map((option) => option.textContent)).toEqual(["Select a search endpoint…", "TMDB Solr"])
      expect(select.value).toBe("")
      expect(select.disabled).toBe(false)

      select.value = "1"
      controller.selectEndpoint({ target: select })

      expect(controller.settings.searchEndpointId).toBe(1)
      expect(select.value).toBe("1")
    })

    it("says so when there are no endpoints to reuse", () => {
      const controller = buildController()
      const select = stubEndpointSelect(controller)

      controller.renderEndpointChoices()

      expect(select.options[0].textContent).toBe("You do not have any Search Endpoints created yet.")
      expect(select.disabled).toBe(true)
    })

    it("forgets the chosen endpoint when the user switches to creating a new one", () => {
      const controller = buildController()
      controller.settings.searchEndpointId = 1
      const engine = document.createElement("select")
      engine.innerHTML = '<option value="es">Elasticsearch</option>'
      engine.dataset.wizardField = "searchEnginePreset"

      controller.updateSetting({ target: engine })

      expect(controller.settings.searchEndpointId).toBeNull()
    })
  })

  describe("protocol mismatch", () => {
    it("warns and offers a reload link that carries the pending settings", () => {
      const controller = buildController({ needToRedirect: true })
      stubTlsTargets(controller)
      controller.settings = { ...controller.settings, caseName: "Movies", apiMethod: "JSONP" }

      controller.render()

      expect(controller.tlsWarningTarget.hidden).toBe(false)
      expect(controller.endpointContinueTarget.hidden).toBe(true)
      expect(controller.skipButtonTarget.hidden).toBe(true)
      expect(controller.tlsProtocolTargets.map((target) => target.textContent)).toEqual(["https", "https"])
      const params = new URL(controller.tlsReloadLinkTarget.href).searchParams
      expect(params.get("showWizard")).toBe("true")
      expect(params.get("searchEngine")).toBe("solr")
      expect(params.get("searchUrl")).toBe("http://solr.example/select")
      expect(params.get("caseName")).toBe("Movies")
    })

    it("does not warn when requests are proxied through Quepid", () => {
      const controller = buildController({ needToRedirect: true })
      stubTlsTargets(controller)
      controller.settings.proxyRequests = true

      controller.render()

      expect(controller.tlsWarningTarget.hidden).toBe(true)
      expect(controller.endpointContinueTarget.hidden).toBe(false)
    })

    it("does not try to validate across protocols", async () => {
      const controller = buildController({ needToRedirect: true })
      controller.capability.search = { createValidator: vi.fn() }

      await controller.validate()

      expect(controller.capability.search.createValidator).not.toHaveBeenCalled()
    })

    it("restores the pending settings after the reload", () => {
      window.history.pushState({}, "", "/case/6/try/1?showWizard=true&searchEngine=es&searchUrl=https%3A%2F%2Fes.example%2F_search&caseName=Movies&apiMethod=POST")
      const controller = buildController()
      controller.capability.settings.pick = vi.fn(() => ({ searchEngine: "es", apiMethod: "GET", searchUrl: "http://default" }))

      controller.applyReloadParams()

      expect(controller.capability.settings.pick).toHaveBeenCalledWith("es", undefined)
      expect(controller.settings).toEqual(expect.objectContaining({
        searchEngine: "es",
        searchEnginePreset: "es",
        searchUrl: "https://es.example/_search",
        caseName: "Movies",
        apiMethod: "POST"
      }))
    })
  })
})

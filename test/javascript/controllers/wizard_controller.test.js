import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { Application } from "@hotwired/stimulus"
import WizardController from "../../../app/javascript/controllers/wizard_controller"
import { waitForController } from "../support/stimulus_helpers"

// Mock modules
vi.mock("modules/flash_helper", () => ({
  showFlash: vi.fn(),
}))

vi.mock("modules/settings_validator", () => ({
  validateEndpoint: vi.fn(),
  validateHeaders: vi.fn(() => true),
  isInvalidProxyApiMethod: vi.fn(() => false),
  validateMapperCode: vi.fn(() => ({ valid: true, error: null })),
}))

import { validateEndpoint } from "modules/settings_validator"

// Mock bootstrap modal
const mockModal = { show: vi.fn(), hide: vi.fn() }
window.bootstrap = {
  Modal: { getOrCreateInstance: () => mockModal },
}

function buildFixture() {
  return `
    <div data-controller="wizard"
         data-wizard-case-id-value="1"
         data-wizard-try-number-value="1"
         data-wizard-case-name-value="Test Case"
         data-wizard-show-wizard-value="false">
      <div data-wizard-target="modal" class="modal">
        <div data-wizard-target="step">Step 0: Intro</div>
        <div data-wizard-target="step" class="d-none">
          <input data-wizard-target="caseNameInput" value="Test Case" />
        </div>
        <div data-wizard-target="step" class="d-none">
          <div data-wizard-target="newEndpointSection">
            <input type="radio" data-wizard-target="searchEngineRadio" value="solr"
                   data-action="change->wizard#changeSearchEngine" checked />
            <input type="radio" data-wizard-target="searchEngineRadio" value="es"
                   data-action="change->wizard#changeSearchEngine" />
            <input data-wizard-target="searchUrlInput" value="" />
            <span data-wizard-target="urlFormatHint"></span>
            <div data-wizard-target="solrPanel"></div>
            <select data-wizard-target="apiMethodSelect">
              <option value="JSONP">JSONP</option>
              <option value="POST">POST</option>
              <option value="GET">GET</option>
            </select>
            <div data-wizard-target="staticPanel" class="d-none"></div>
            <div data-wizard-target="searchapiPanel" class="d-none"></div>
            <div data-wizard-target="advancedPanel">
              <input type="checkbox" data-wizard-target="proxyCheckbox" />
              <input data-wizard-target="basicAuthInput" />
              <textarea data-wizard-target="customHeadersInput"></textarea>
            </div>
            <input data-wizard-target="testQueryInput" />
            <div data-wizard-target="testQuerySection" class="d-none"></div>
          </div>
          <div data-wizard-target="existingEndpointSection" class="d-none">
            <select data-wizard-target="existingEndpointSelect">
              <option value="">-- Select --</option>
            </select>
          </div>
          <div data-wizard-target="validationMessage" class="d-none"></div>
          <div data-wizard-target="tlsWarning" class="d-none"></div>
          <button data-wizard-target="validateButton">Ping it</button>
          <button data-wizard-target="skipValidationButton" class="d-none">Skip</button>
          <button data-wizard-target="continueStep3Button" disabled>Continue</button>
        </div>
        <div data-wizard-target="step" class="d-none">
          <input data-wizard-target="titleFieldInput" />
          <datalist data-wizard-target="titleFieldList"></datalist>
          <input data-wizard-target="idFieldInput" />
          <datalist data-wizard-target="idFieldList"></datalist>
          <input data-wizard-target="additionalFieldInput" />
          <datalist data-wizard-target="additionalFieldList"></datalist>
          <div data-wizard-target="additionalFieldsContainer"></div>
          <div data-wizard-target="fieldValidationMessage" class="d-none"></div>
        </div>
        <div data-wizard-target="step" class="d-none">
          <input data-wizard-target="queryInput" />
          <div data-wizard-target="queryTagsContainer"></div>
          <div data-wizard-target="queryPatternSection" class="d-none">
            <input data-wizard-target="queryPatternInput" />
          </div>
        </div>
        <div data-wizard-target="step" class="d-none">
          <button data-wizard-target="finishButton">Finish</button>
        </div>
      </div>
    </div>
  `
}

describe("WizardController", () => {
  let application
  const originalFetch = global.fetch

  beforeEach(async () => {
    document.head.innerHTML = '<meta name="csrf-token" content="test-csrf">'
    document.body.dataset.quepidRootUrl = "/"
    document.body.innerHTML = buildFixture()

    application = Application.start()
    application.register("wizard", WizardController)
    await waitForController(application, '[data-controller="wizard"]', "wizard")
  })

  afterEach(() => {
    application.stop()
    global.fetch = originalFetch
    vi.clearAllMocks()
  })

  function getController() {
    return application.getControllerForElementAndIdentifier(
      document.querySelector('[data-controller="wizard"]'),
      "wizard",
    )
  }

  describe("connect", () => {
    it("initializes with Solr defaults", () => {
      const ctrl = getController()
      expect(ctrl.currentStep).toBe(0)
      expect(ctrl.searchEngine).toBe("solr")
      expect(ctrl.urlValid).toBe(false)
      expect(ctrl.apiMethod).toBe("JSONP")
    })
  })

  describe("step navigation", () => {
    it("open shows modal at step 0", () => {
      const ctrl = getController()
      ctrl.open()
      expect(ctrl.currentStep).toBe(0)
      expect(ctrl.stepTargets[0].classList.contains("d-none")).toBe(false)
      expect(ctrl.stepTargets[1].classList.contains("d-none")).toBe(true)
      expect(mockModal.show).toHaveBeenCalled()
    })

    it("nextStep advances to next step", () => {
      const ctrl = getController()
      ctrl.nextStep()
      expect(ctrl.currentStep).toBe(1)
      expect(ctrl.stepTargets[0].classList.contains("d-none")).toBe(true)
      expect(ctrl.stepTargets[1].classList.contains("d-none")).toBe(false)
    })

    it("prevStep goes back", () => {
      const ctrl = getController()
      ctrl.nextStep()
      ctrl.nextStep()
      ctrl.prevStep()
      expect(ctrl.currentStep).toBe(1)
    })

    it("prevStep does nothing at step 0", () => {
      const ctrl = getController()
      ctrl.prevStep()
      expect(ctrl.currentStep).toBe(0)
    })

    it("nextStep does not go past last step", () => {
      const ctrl = getController()
      for (let i = 0; i < 20; i++) ctrl.nextStep()
      expect(ctrl.currentStep).toBe(ctrl.stepTargets.length - 1)
    })

    it("goToStep jumps to specific step", () => {
      const ctrl = getController()
      ctrl.goToStep({
        preventDefault: () => {},
        currentTarget: { dataset: { wizardStep: "3" } },
      })
      expect(ctrl.currentStep).toBe(3)
      expect(ctrl.stepTargets[3].classList.contains("d-none")).toBe(false)
    })
  })

  describe("case name", () => {
    it("returns trimmed input value", () => {
      const ctrl = getController()
      ctrl.caseNameInputTarget.value = "  My Case  "
      expect(ctrl.caseName).toBe("My Case")
    })
  })

  describe("changeSearchEngine", () => {
    it("switches to ES and resets validation", () => {
      const ctrl = getController()
      ctrl.urlValid = true
      ctrl.changeSearchEngine({ currentTarget: { value: "es" } })

      expect(ctrl.searchEngine).toBe("es")
      expect(ctrl.urlValid).toBe(false)
      expect(ctrl.apiMethod).toBe("POST")
    })

    it("switches to algolia and enables proxy", () => {
      const ctrl = getController()
      ctrl.changeSearchEngine({ currentTarget: { value: "algolia" } })

      expect(ctrl.proxyRequests).toBe(true)
    })
  })

  describe("validate", () => {
    it("calls validateEndpoint and sets urlValid on success", async () => {
      validateEndpoint.mockResolvedValue({
        fields: ["id", "title", "overview"],
        idFields: ["id"],
      })

      const ctrl = getController()
      ctrl.searchUrl = "http://localhost:8983/solr/test/select"
      await ctrl.validate({ preventDefault: () => {} })

      expect(ctrl.urlValid).toBe(true)
      expect(ctrl.discoveredFields).toEqual(["id", "title", "overview"])
      expect(ctrl.validationMessageTarget.classList.contains("d-none")).toBe(false)
    })

    it("shows error when validateEndpoint throws", async () => {
      validateEndpoint.mockRejectedValue(new Error("Connection refused"))

      const ctrl = getController()
      ctrl.searchUrl = "http://localhost:8983/solr/bad/select"
      await ctrl.validate({ preventDefault: () => {} })

      expect(ctrl.urlValid).toBe(false)
      expect(ctrl.validationMessageTarget.textContent).toContain("Connection refused")
    })
  })

  describe("skipValidation", () => {
    it("sets urlValid and populates field step from settings", () => {
      const ctrl = getController()
      ctrl.searchEngine = "solr"
      ctrl.searchUrl = null

      ctrl.skipValidation({ preventDefault: () => {} })

      expect(ctrl.urlValid).toBe(true)
    })
  })

  describe("field management (step 4)", () => {
    it("addAdditionalField adds to array and renders tag", () => {
      const ctrl = getController()
      ctrl.additionalFieldInput = { value: "" }
      ctrl.additionalFieldInputTarget.value = "overview"

      ctrl.addAdditionalField({ preventDefault: () => {} })

      expect(ctrl.additionalFields).toContain("overview")
      expect(ctrl.additionalFieldsContainerTarget.innerHTML).toContain("overview")
    })

    it("addAdditionalField ignores duplicates", () => {
      const ctrl = getController()
      ctrl.additionalFields = ["overview"]
      ctrl.additionalFieldInputTarget.value = "overview"

      ctrl.addAdditionalField({ preventDefault: () => {} })

      expect(ctrl.additionalFields).toEqual(["overview"])
    })

    it("removeAdditionalField removes field from array", () => {
      const ctrl = getController()
      ctrl.additionalFields = ["overview", "cast"]

      ctrl.removeAdditionalField({
        preventDefault: () => {},
        currentTarget: { dataset: { field: "overview" } },
      })

      expect(ctrl.additionalFields).toEqual(["cast"])
    })
  })

  describe("query management (step 5)", () => {
    it("addQuery adds to array and renders tag", () => {
      const ctrl = getController()
      ctrl.queryInputTarget.value = "star wars"

      ctrl.addQuery({ preventDefault: () => {} })

      expect(ctrl.newQueries).toEqual([{ queryString: "star wars" }])
      expect(ctrl.queryTagsContainerTarget.innerHTML).toContain("star wars")
      expect(ctrl.queryInputTarget.value).toBe("")
    })

    it("addQuery ignores duplicates", () => {
      const ctrl = getController()
      ctrl.newQueries = [{ queryString: "star wars" }]
      ctrl.queryInputTarget.value = "star wars"

      ctrl.addQuery({ preventDefault: () => {} })

      expect(ctrl.newQueries).toHaveLength(1)
    })

    it("addQuery ignores empty input", () => {
      const ctrl = getController()
      ctrl.queryInputTarget.value = "   "

      ctrl.addQuery({ preventDefault: () => {} })

      expect(ctrl.newQueries).toHaveLength(0)
    })

    it("removeQuery removes by index", () => {
      const ctrl = getController()
      ctrl.newQueries = [{ queryString: "a" }, { queryString: "b" }, { queryString: "c" }]

      ctrl.removeQuery({
        preventDefault: () => {},
        currentTarget: { dataset: { index: "1" } },
      })

      expect(ctrl.newQueries).toEqual([{ queryString: "a" }, { queryString: "c" }])
    })
  })

  describe("sessionStorage credential handling", () => {
    it("stores credential in sessionStorage instead of URL", () => {
      const ctrl = getController()
      ctrl.searchEngine = "solr"
      ctrl.searchUrl = "http://localhost:8983/solr/test/select"
      ctrl.caseNameInputTarget.value = "Test"
      ctrl.apiMethod = "JSONP"
      ctrl.basicAuthCredential = "user:pass"

      sessionStorage.clear()
      const url = ctrl._buildTLSRedirectUrl("https")

      expect(sessionStorage.getItem("wizardBasicAuthCredential")).toBe("user:pass")
      expect(url).not.toContain("basicAuthCredential")
      expect(url).not.toContain("user:pass")
    })
  })
})

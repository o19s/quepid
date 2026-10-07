import { endpointSettings, formatEndpointHeaders } from "utils/endpoint_settings"
import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"
import { getWizardCapabilities } from "utils/core_capabilities_runtime"
import { getCoreCapabilities } from "utils/core_capability_access"
import { parseCsv } from "utils/csv"
import { persistQueries } from "utils/query_lifecycle"
import { importSnapshotsToCase } from "utils/snapshot_import"
import { getQuepidRootUrl } from "utils/quepid_root"
import { normalizeSearchEngine } from "utils/search_engines"
import {
  addUniqueQuery,
  buildFieldSpec,
  formatValidationError,
  formatWizardSaveError,
  invalidProxyApiMethod,
  parseCustomHeaders,
  searchApiValidationArgs,
  validateStaticHeaders
} from "utils/wizard_contracts"

const steps = ["welcome", "name", "endpoint", "fields", "query", "finish"]

export default class extends Controller {
  static targets = [
    "step", "tracker", "caseName", "endpointMode", "endpointSelect", "engine", "searchUrl", "apiMethod",
    "queryParams", "testQuery", "proxyRequests", "basicAuth", "customHeaders", "titleField",
    "idField", "additionalFields", "queryText", "queryList", "staticFile", "staticPreview",
    "staticAlert", "alert", "continueButton", "finishButton", "validation", "skipButton",
    "mapperEngines", "endpointDetails", "queryPattern", "fieldError", "staticSection",
    "tlsWarning", "tlsReloadLink", "tlsProtocol", "endpointContinue", "loading"
  ]

  static values = { proxyRequired: Boolean, rootUrl: String, caseNo: String, snapshotSearchUrlTemplate: String }

  connect() {
    this.connected = true
    this.stepIndex = 0
    this.searchEndpoints = []
    this.mapperEngines = []
    this.searchFields = []
    this.newQueries = []
    this.staticRows = []
    this.loadWizard()
  }

  disconnect() {
    this.connected = false
    if (this.tourTimer) window.clearTimeout(this.tourTimer)
    this.tourTimer = null
  }

  async loadWizard() {
    try {
      this.adapter = await getWizardCapabilities()
    } catch (error) {
      if (!this.connected) return
      console.error("wizard: could not load capabilities", error)
      this.error = "Unable to load the case wizard. Please refresh the page and try again."
      this.render()
      return
    }
    if (!this.connected) return

    this.capability = this.adapter.capability
    const { settings, endpoints, mapper, user } = this.capability

    this.settings = { ...settings.editable() }
    this.forceProxyIfRequired()
    this.settings.searchEnginePreset = this.settings.searchEngine || "solr"
    this.settings.newQueries = []
    this.settings.caseName = this.settings.caseName || "Movies Search"

    try {
      await endpoints.list()
      this.searchEndpoints = endpoints.all()
      await mapper.list()
      this.mapperEngines = mapper.all()
      this.mapperEngines.forEach((engine) => settings.registerMapper(engine))
    } catch (error) {
      console.error("wizard: could not load endpoint choices", error)
    }
    if (!this.connected) return

    this.renderEndpointChoices()
    this.applySettings(this.settings.searchEnginePreset, this.settings.searchUrl)
    this.applyReloadParams()

    if (user.current()?.completedCaseWizard) this.stepIndex = 1
    // Steps stay hidden until now, so the Welcome step never flashes up and then jumps to Name.
    this.loaded = true
    this.render()
  }

  // After a protocol-switch reload (see renderTls), restore what the user had entered.
  applyReloadParams() {
    const query = new URLSearchParams(window.location.search)
    const preset = query.get("searchEngine")
    if (!preset) return
    this.applySettings(preset)
    const overrides = {
      searchUrl: query.get("searchUrl"),
      caseName: query.get("caseName"),
      apiMethod: query.get("apiMethod"),
      basicAuthCredential: query.get("basicAuthCredential")
    }
    Object.entries(overrides).forEach(([key, value]) => { if (value) this.settings[key] = value })
    this.forceProxyIfRequired()
  }

  forceProxyIfRequired() {
    if (!this.proxyRequiredValue || !this.settings) return
    this.settings.proxyRequests = true
    if (this.settings.apiMethod === "JSONP") this.settings.apiMethod = "GET"
  }

  proxyEndpointError(endpoint) {
    if (!this.proxyRequiredValue) return null
    if (!endpoint && !this.settings?.searchEndpointId) return null
    endpoint ||= this.searchEndpoints.find((item) => String(item.id) === String(this.settings.searchEndpointId))
    if (endpoint?.proxyRequests === true && endpoint.apiMethod !== "JSONP") return null

    return "This existing search endpoint must have proxying enabled and use a non-JSONP API method. Edit the endpoint first, or choose a search engine to configure a new endpoint."
  }

  tlsMismatch() {
    const { proxyRequests, searchUrl } = this.settings || {}
    return proxyRequests !== true && Boolean(this.capability?.navigation.needToRedirectProtocol(searchUrl))
  }

  open() {
    this.render()
    getOrCreateBsModal(this.element, { backdrop: "static", keyboard: false })?.show()
  }

  close(event) {
    event?.preventDefault()
    if (!window.confirm("Are you sure you want to abandon this case?")) return
    if (!this.capability) {
      getOrCreateBsModal(this.element)?.hide()
      return
    }
    const selectedCase = this.capability.case.selected()
    this.capability.case.delete(selectedCase)?.then(() => {
      getOrCreateBsModal(this.element)?.hide()
      window.location.assign(this.capability.navigation.rootUrl())
    })
  }

  next(event) {
    event?.preventDefault()
    if (this.stepIndex === 1 && !this.settings.caseName?.trim()) return
    if (this.stepIndex === 2) return this.validate()
    if (this.stepIndex === 3) return this.validateFields()
    if (this.stepIndex === 4 && this.settings.searchEngine === "searchapi" && !this.settings.queryParams?.trim()) return
    if (this.stepIndex === 4) this.addQuery()
    this.stepIndex = Math.min(this.stepIndex + 1, steps.length - 1)
    this.render()
  }

  previous(event) {
    event?.preventDefault()
    this.stepIndex = Math.max(0, this.stepIndex - 1)
    this.render()
  }

  setStep(event) {
    if (this.validating) return
    const index = Number(event.params.index)
    if (Number.isInteger(index) && index <= this.stepIndex) this.stepIndex = index
    this.render()
  }

  updateSetting(event) {
    this.settings ||= {}
    const field = event.target.dataset.wizardField
    let value = event.target.type === "checkbox" ? event.target.checked : event.target.value
    if (field === "additionalFields") value = value.split(/[\s,]+/).filter(Boolean)
    this.settings[field] = value
    this.forceProxyIfRequired()
    if (event.target.dataset.wizardField === "searchEnginePreset") {
      this.settings.searchEndpointId = null
      this.applySettings(event.target.value)
    }
    if (["searchUrl", "proxyRequests", "apiMethod", "basicAuthCredential"].includes(event.target.dataset.wizardField)) this.clearValidation()
    this.render()
  }

  selectEndpoint(event) {
    const endpoint = this.searchEndpoints.find((item) => String(item.id) === event.target.value)
    if (!endpoint) return
    const proxyError = this.proxyEndpointError(endpoint)
    if (proxyError) return this.fail(proxyError)
    this.clearValidation()
    const searchEnginePreset = endpoint.mapperBasedSearchEngineId || endpoint.searchEngine
    const defaults = this.capability.settings.pick(searchEnginePreset, endpoint.endpointUrl)
    this.settings = {
      ...this.settings,
      ...defaults,
      ...endpointSettings(endpoint),
      searchEnginePreset,
      apiMethod: endpoint.apiMethod || defaults.apiMethod,
      testQuery: endpoint.testQuery,
      queryParams: endpoint.searchEngine === "searchapi"
        ? defaults.queryParams || (endpoint.testQuery?.includes("#$query##") ? endpoint.testQuery : "")
        : defaults.queryParams || ""
    }
    this.forceProxyIfRequired()
    this.render()
  }

  applySettings(preset, url) {
    const settings = this.capability?.settings
    if (!settings) return
    const selected = settings.pick(preset || this.settings.searchEngine, url)
    this.settings = { ...this.settings, ...selected, searchEnginePreset: preset || selected.searchEngine }
    this.forceProxyIfRequired()
    this.settings.queryParams ||= ""
    if (selected.searchEngine === "solr") {
      this.settings.searchUrl = window.location.protocol === "https:" ? selected.secureSearchUrl : selected.insecureSearchUrl
    }
    this.clearValidation()
  }

  async validate(justValidate = false) {
    this.clearValidation()
    const proxyError = this.proxyEndpointError()
    if (proxyError) return this.fail(proxyError)
    if (this.tlsMismatch()) return this.render()
    this.setBusy(true)
    if (this.settings.searchEngine === "searchapi" && !this.settings.queryParams?.trim()) return this.fail("Query pattern is required for Search API endpoints.")
    const headerValue = this.hasCustomHeadersTarget ? this.customHeadersTarget.value : this.settings.customHeaders
    this.settings.customHeaders = headerValue
    const headerResult = parseCustomHeaders(headerValue)
    if (!headerResult.valid) return this.fail("Custom Headers must be a valid JSON object")
    if (invalidProxyApiMethod(this.settings.proxyRequests, this.settings.apiMethod)) return this.fail("You must change from JSONP to another API method when proxying.")

    const settings = { ...this.settings }
    settings.searchEngine = normalizeSearchEngine(settings.searchEngine)
    if (settings.searchEngine === "searchapi") {
      const queryParams = settings.queryParams || ""
      settings.args = searchApiValidationArgs(
        settings.testQuery || queryParams.replace(/#\$query##/g, "test"),
        settings.bareQueryParam
      )
    }
    if (settings.proxyRequests) settings.proxyUrl = this.capability.settings.proxyUrlFor(settings.searchEndpointId)

    try {
      const validator = this.capability.search.createValidator(settings)
      await validator.validateUrl()
      this.searchFields = validator.fields || []
      this.settings.idField ||= validator.idFields?.[0]
      this.settings.titleField ||= validator.fields?.[0]
      this.settings.fieldSpec = buildFieldSpec(this.settings.idField, this.settings.titleField, this.settings.additionalFields)
      this.setBusy(false)
      this.urlValid = true
      if (!justValidate) {
        this.stepIndex = 3
        this.render()
      } else this.render()
    } catch (error) {
      this.setBusy(false)
      this.urlInvalid = true
      this.showError(formatValidationError(error))
      this.render()
    }
  }

  skipValidation(event) {
    event?.preventDefault()
    this.stepIndex = 3
    this.render()
  }

  validateFields() {
    this.fieldError = null
    if (!this.settings.idField?.trim()) this.fieldError = "This field is required. Please select an ID field."
    if (!this.settings.titleField?.trim()) this.fieldError = "This field is required. Please select a title field."
    if (this.fieldError) return this.render()
    this.settings.fieldSpec = buildFieldSpec(this.settings.idField, this.settings.titleField, this.settings.additionalFields)
    this.stepIndex = 4
    this.render()
  }

  addQuery(event) {
    event?.preventDefault()
    const text = this.settings.text
    const next = addUniqueQuery(this.newQueries, text)
    if (next.length !== this.newQueries.length) this.settings.text = ""
    this.newQueries = next
    this.render()
  }

  removeQuery(event) {
    this.newQueries.splice(Number(event.params.index), 1)
    this.render()
  }

  async importStatic(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const content = await file.text()
    const { rows, headers, errors } = parseCsv(content)
    const headerResult = validateStaticHeaders(headers.join(","))
    if (!headerResult.valid) {
      this.staticAlert = headerResult.errors.join(" ")
      return this.render()
    }
    if (errors.length) {
      this.staticAlert = `CSV format error: ${errors.join(" ")}`
      return this.render()
    }
    this.staticRows = rows.filter((row) => Object.values(row).some(Boolean))
    this.settings.searchEngine = "static"
    this.settings.searchEnginePreset = "static"
    this.staticAlert = "Importing static data…"
    this.render()
    try {
      const importedSnapshots = await importSnapshotsToCase(
        this.staticRows,
        this.capability.navigation.caseNo(),
        getQuepidRootUrl()
      )
      const snapshotId = importedSnapshots.at(-1)?.id
      this.settings.searchUrl = this.snapshotSearchUrlTemplateValue.replaceAll("__SNAPSHOT_ID__", String(snapshotId))
      this.newQueries = [...new Set(this.staticRows.map((row) => row["Query Text"]).filter(Boolean))].map((queryString) => ({ queryString }))
      this.staticAlert = "Static data imported successfully."
    } catch {
      this.staticAlert = "Could not import static data successfully."
    }
    this.render()
  }

  async finish(event) {
    event?.preventDefault()
    if (this.saving) return
    const proxyError = this.proxyEndpointError()
    if (proxyError) return this.fail(proxyError)
    this.saving = true
    this.render()
    try {
      const { case: caseCapability, endpoints, settings, navigation, documents, user } = this.capability
      const selectedCase = caseCapability.selected()
      if (this.settings.caseName) await caseCapability.rename(selectedCase, this.settings.caseName)
      if (!settings.demoChosen(this.settings.searchEngine, this.settings.searchUrl)) {
        if (endpoints.isEsOrOs(this.settings.searchEngine) && typeof this.settings.queryParams === "string") {
          this.settings.queryParams = this.settings.queryParams.replace("REPLACE_ME", this.settings.titleField || "")
        }
        if (this.settings.searchEngine === "solr") this.settings.queryParams = settings.defaultSolrQueryParams()
      }
      this.settings.selectedTry ||= settings.applicable()
      await settings.update({ ...this.settings, newQueries: this.newQueries })
      const latestSettings = settings.editable()
      documents.cache.invalidate()
      documents.cache.update(latestSettings)
      const capabilities = getCoreCapabilities()
      await capabilities.queryCapabilities.changeSettings(navigation.caseNo(), latestSettings)
      const texts = this.newQueries.map((query) => query.queryString).filter(Boolean)
      if (texts.length && capabilities.queryLifecycle) {
        const persisted = await persistQueries(navigation.caseNo(), texts)
        await capabilities.queryLifecycle.commitPersistedQueries(persisted)
      }
      const currentUser = user.current()
      const isFirstCaseWizard = !currentUser.completedCaseWizard
      user.shownIntroWizard()
      getOrCreateBsModal(this.element)?.hide()
      if (isFirstCaseWizard && typeof window.setupAndStartTour === "function") {
        this.tourTimer = window.setTimeout(() => {
          this.tourTimer = null
          window.setupAndStartTour()
        }, 1500)
      }
    } catch (error) {
      this.saving = false
      this.showError(formatWizardSaveError(error))
      this.render()
    }
  }

  clearValidation() {
    this.urlValid = false
    this.urlInvalid = false
    this.error = null
  }

  setBusy(value) {
    this.validating = value
    this.render()
  }

  fail(message) {
    this.setBusy(false)
    this.showError(message)
    this.render()
  }

  showError(message) {
    this.error = message
  }

  renderEndpointChoices() {
    if (this.hasEngineTarget) {
      // The built-in engines are rendered in ERB; only the mapper-based ones are added here.
      this.engineTarget.querySelectorAll("option[data-mapper-engine]").forEach((option) => option.remove())
      this.engineTarget.append(...this.mapperEngines.map((engine) => {
        const option = document.createElement("option")
        option.value = engine.id
        option.textContent = engine.name
        option.dataset.mapperEngine = ""
        return option
      }))
    }
    if (!this.hasEndpointSelectTarget) return
    const endpoints = this.searchEndpoints.filter((endpoint) => endpoint.searchEngine !== "static")
    // A blank first option, so choosing the first real endpoint still fires `change`.
    const placeholder = document.createElement("option")
    placeholder.value = ""
    placeholder.textContent = endpoints.length ? "Select a search endpoint…" : "You do not have any Search Endpoints created yet."
    this.endpointSelectTarget.replaceChildren(placeholder, ...endpoints.map((endpoint) => {
      const option = document.createElement("option")
      option.value = endpoint.id
      option.textContent = endpoint.name
      return option
    }))
    this.endpointSelectTarget.disabled = endpoints.length === 0
  }

  renderTls() {
    if (!this.hasTlsWarningTarget) return
    const mismatch = this.tlsMismatch()
    this.tlsWarningTarget.hidden = !mismatch
    if (this.hasEndpointContinueTarget) this.endpointContinueTarget.hidden = mismatch
    if (this.hasSkipButtonTarget) this.skipButtonTarget.hidden = mismatch
    if (!mismatch) return
    const [url, protocol] = this.capability.navigation.swapUrlTls()
    const { searchEnginePreset, searchEngine, searchUrl, caseName, apiMethod, basicAuthCredential } = this.settings
    const params = new URLSearchParams({
      showWizard: "true",
      searchEngine: searchEnginePreset || searchEngine || "",
      searchUrl: searchUrl || "",
      caseName: caseName || "",
      apiMethod: apiMethod || "",
      basicAuthCredential: basicAuthCredential || ""
    })
    this.tlsReloadLinkTarget.href = this.capability.navigation.appendQueryParams(url, params.toString())
    this.tlsProtocolTargets.forEach((target) => { target.textContent = protocol })
  }

  render() {
    this.settings ||= {}
    if (this.hasLoadingTarget) this.loadingTarget.hidden = this.loaded || Boolean(this.error)
    this.stepTargets.forEach((step, index) => step.hidden = !this.loaded || index !== this.stepIndex)
    this.trackerTargets.forEach((item, index) => {
      item.classList.toggle("active", index === this.stepIndex)
      item.disabled = this.validating || index > this.stepIndex
      if (index === this.stepIndex) item.setAttribute("aria-current", "step")
      else item.removeAttribute("aria-current")
    })
    this.element.querySelectorAll("[data-wizard-only]").forEach((element) => {
      element.hidden = element.dataset.wizardOnly !== steps[this.stepIndex]
    })
    if (this.hasCaseNameTarget) this.caseNameTarget.value = this.settings?.caseName || ""
    if (this.hasSearchUrlTarget) this.searchUrlTarget.value = this.settings?.searchUrl || ""
    if (this.hasApiMethodTarget) this.apiMethodTarget.value = this.settings?.apiMethod || ""
    if (this.hasQueryParamsTarget) this.queryParamsTarget.value = this.settings?.queryParams || ""
    if (this.hasTestQueryTarget) this.testQueryTarget.value = this.settings?.testQuery || ""
    if (this.hasBasicAuthTarget) this.basicAuthTarget.value = this.settings?.basicAuthCredential || ""
    if (this.hasCustomHeadersTarget) {
      const customHeaders = this.settings?.customHeaders
      this.customHeadersTarget.value = customHeaders && customHeaders !== "null" && typeof customHeaders === "object"
        ? formatEndpointHeaders(customHeaders)
        : customHeaders === "null" ? "" : customHeaders || ""
    }
    if (this.hasProxyRequestsTarget) this.proxyRequestsTarget.checked = this.settings?.proxyRequests === true
    if (this.hasEndpointSelectTarget) this.endpointSelectTarget.value = String(this.settings?.searchEndpointId ?? "")
    if (this.hasEngineTarget) this.engineTarget.value = this.settings?.searchEnginePreset || this.settings?.searchEngine || "solr"
    if (this.hasEndpointModeTarget) this.endpointModeTarget.textContent = this.settings?.searchEngine || ""
    if (this.hasTitleFieldTarget) this.titleFieldTarget.value = this.settings?.titleField || ""
    if (this.hasIdFieldTarget) this.idFieldTarget.value = this.settings?.idField || ""
    if (this.hasAdditionalFieldsTarget) this.additionalFieldsTarget.value = (this.settings?.additionalFields || []).map((field) => field.text ?? field).join(", ")
    if (this.hasQueryPatternTarget) this.queryPatternTarget.value = this.settings?.queryParams || ""
    if (this.hasQueryTextTarget) this.queryTextTarget.value = this.settings?.text || ""
    if (this.hasQueryListTarget) {
      this.queryListTarget.replaceChildren(...this.newQueries.map((query, index) => {
        const item = document.createElement("span")
        item.className = "wiz_new_query"
        item.textContent = query.queryString
        const remove = document.createElement("button")
        remove.type = "button"
        remove.textContent = "X"
        remove.dataset.action = "wizard#removeQuery"
        remove.dataset.wizardIndexParam = index
        item.append(remove)
        return item
      }))
    }
    if (this.hasAlertTarget) {
      this.alertTarget.textContent = this.error || this.fieldError || this.staticAlert || ""
      this.alertTarget.hidden = !this.alertTarget.textContent
    }
    this.continueButtonTargets.forEach((button) => { button.disabled = this.validating || (this.stepIndex === 1 && !this.settings?.caseName?.trim()) })
    if (this.hasFinishButtonTarget) this.finishButtonTarget.disabled = this.saving
    this.renderTls()
  }
}

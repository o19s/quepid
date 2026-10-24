import { createSearchEndpointSelect, updateSearchEndpointSelect } from "modules/search_endpoint_select"
import TomSelect from "tom-select"
import { endpointSettings, formatEndpointHeaders } from "utils/endpoint_settings"
import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"
import { getWizardCapabilities } from "utils/core_capabilities_runtime"
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
const FIELD_MODIFIERS = ["media:", "thumb:", "image:"]
// Starting values for the Custom Headers type selector, as in the Angular wizard.
const HEADER_TEMPLATES = {
  None: "",
  "API Key": '{\n  "Authorization": "ApiKey XXX"\n}',
  Custom: '{\n "KEY": "VALUE"\n}'
}
const MAX_FIELD_SUGGESTIONS = 12

export default class extends Controller {
  static targets = [
    "step", "tracker", "caseName", "endpointSelect", "searchUrl", "apiMethod",
    "testQuery", "proxyRequests", "basicAuth", "customHeaders", "titleField",
    "idField", "additionalFields", "queryText", "queryList", "staticFile",
    "alert", "continueButton", "finishButton", "skipButton",
    "mapperEngines", "queryPattern",
    "tlsWarning", "tlsProtocol", "endpointContinue", "loading", "pingButton", "urlFormat",
    "selectedEndpointUrl", "selectedEndpointMethod", "mapperMessage", "engineName", "endpointLink",
    "wikiLink", "curlAuth", "solrConfigUrl",
    "engineOption", "engineTileTemplate", "headerType",
    "staticAlert", "staticContent", "staticImportButton", "staticStatus",
    "createPanel", "existingPanel"
  ]

  static values = {
    proxyRequired: Boolean,
    rootUrl: String,
    caseNo: String,
    snapshotSearchUrlTemplate: String,
    mapperWizardUrl: String
  }

  connect() {
    this.connected = true
    this.stepIndex = 0
    this.searchEndpoints = []
    this.mapperEngines = []
    this.searchFields = []
    this.idFields = []
    this.newQueries = []
    this.staticRows = []
    this.staticQueries = []
    this.staticImported = false
    this.staticSearchUrl = null
    this.loadWizard()
  }

  disconnect() {
    this.endpointTomSelect?.destroy()
    this.endpointTomSelect = null
    this.connected = false
    this.fieldSelects?.forEach((select) => select.destroy())
    this.fieldSelects = null
    this.additionalFieldSelect?.destroy()
    this.additionalFieldSelect = null
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
    this.settings.caseName = this.settings.caseName || ""

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
    this.openReloadPanel()

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

  // Both panels start closed; a protocol-switch reload reopens the one the user was in, as the Angular wizard did.
  openReloadPanel() {
    const query = new URLSearchParams(window.location.search)
    if (!query.get("searchEngine")) return
    const existing = Boolean(query.get("existingSearchEndpoint"))
    const panel = existing ? (this.hasExistingPanelTarget && this.existingPanelTarget) : (this.hasCreatePanelTarget && this.createPanelTarget)
    if (panel) panel.open = true
    this.endpointMode = existing ? "existing" : "new"
  }

  // Opening "Create a new Search Endpoint" drops any chosen existing endpoint, as the Angular wizard did.
  endpointPanelToggled() {
    const createOpen = this.hasCreatePanelTarget && this.createPanelTarget.open
    const existingOpen = this.hasExistingPanelTarget && this.existingPanelTarget.open
    const mode = createOpen ? "new" : existingOpen ? "existing" : null
    if (mode === this.endpointMode) return
    this.endpointMode = mode
    if (mode === "new" && this.settings?.searchEndpointId) {
      this.settings.searchEndpointId = null
      this.clearValidation()
    }
    this.render()
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
    const { proxyRequests, searchUrl, searchEngine } = this.settings || {}
    // A static endpoint's URL is replaced by Quepid's own snapshot URL on import.
    if (searchEngine === "static") return false
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
    if (this.stepIndex === 4 && this.queryPatternRequired()) return
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

  changeHeaderType(event) {
    this.settings.headerType = event.target.value
    this.settings.customHeaders = HEADER_TEMPLATES[event.target.value] ?? ""
    this.render()
  }

  updateSetting(event) {
    this.settings ||= {}
    const field = event.target.dataset.wizardField
    let value = event.target.type === "checkbox" ? event.target.checked : event.target.value
    if (field === "additionalFields") {
      // The token still being typed filters the field suggestions, as the Angular autocomplete did.
      this.fieldQuery = /[\s,]$/.test(value) ? "" : value.split(/[\s,]+/).at(-1) || ""
      value = value.split(/[\s,]+/).filter(Boolean)
    }
    this.settings[field] = value
    if (["titleField", "idField", "additionalFields"].includes(field)) this.fieldsEdited = true
    this.forceProxyIfRequired()
    if (event.target.dataset.wizardField === "searchEnginePreset") {
      this.settings.searchEndpointId = null
      this.fieldsEdited = false
      this.applySettings(event.target.value)
      // The CSV is imported once per wizard (as in the Angular wizard), so coming back to
      // Static reuses that snapshot rather than requiring, and creating, another one.
      if (event.target.value === "static" && this.staticSearchUrl) this.settings.searchUrl = this.staticSearchUrl
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
    this.fieldsEdited = false
    const searchEnginePreset = endpoint.mapperBasedSearchEngineId || endpoint.searchEngine
    const defaults = this.capability.settings.pick(searchEnginePreset, endpoint.endpointUrl)
    this.settings = {
      ...this.settings,
      ...defaults,
      ...endpointSettings(endpoint),
      searchEnginePreset,
      apiMethod: endpoint.apiMethod || defaults.apiMethod,
      testQuery: endpoint.testQuery,
      // As in the Angular wizard, a Search API endpoint's saved test query seeds the pattern set on the
      // Query step, unless its mapper-based engine has a pattern of its own.
      queryParams: endpoint.searchEngine === "searchapi"
        ? defaults.queryParams || endpoint.testQuery || ""
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
      const mapperError = this.applyMapperFunctions(settings)
      if (mapperError) {
        this.setBusy(false)
        this.mapperInvalid = true
        this.mapperErrorMessage = mapperError
        return this.render()
      }
    }
    if (settings.proxyRequests) settings.proxyUrl = this.capability.settings.proxyUrlFor(settings.searchEndpointId)

    try {
      const validator = this.capability.search.createValidator(settings)
      await validator.validateUrl()
      this.searchFields = validator.fields || []
      this.idFields = validator.idFields || []
      this.applyFieldDefaults()
      this.settings.fieldSpec = buildFieldSpec(this.settings.idField, this.settings.titleField, this.settings.additionalFields)
      this.setBusy(false)
      this.urlValid = true
      if (!justValidate) {
        this.stepIndex = 3
        this.render()
      } else this.render()
    } catch (error) {
      this.setBusy(false)
      const message = formatValidationError(error)
      // splainer-search reports a mapper that cannot parse a successful response as
      // "MapperError: ..."; that gets mapper guidance rather than connection troubleshooting.
      if (message.startsWith("MapperError")) {
        this.mapperInvalid = true
        this.mapperErrorMessage = message
      } else {
        this.urlInvalid = true
        this.showError(message)
      }
      this.render()
    }
  }

  // Search API results can only be read through the endpoint's mapper functions, so build them for the
  // validation search, as the Angular wizard did. Returns a message when the mapper cannot be used.
  applyMapperFunctions(settings) {
    let mapper
    try {
      mapper = this.capability.search.evaluateMapper(settings.mapperCode)
    } catch (error) {
      return `Mapper code evaluation failed: ${error.message}`
    }
    if (!mapper.numberOfResultsMapper) return 'You need to define a "numberOfResultsMapper"'
    if (!mapper.docsMapper) return 'You need to define a "docsMapper"'
    settings.numberOfResultsMapper = mapper.numberOfResultsMapper
    settings.docsMapper = mapper.docsMapper
    return null
  }

  ping(event) {
    event?.preventDefault()
    return this.validate(true)
  }

  // Search API endpoints need mapper code, which the standalone Mapper Wizard creates.
  // Abandon this draft case first so it isn't left behind.
  goToMapperWizard(event) {
    event?.preventDefault()
    const selectedCase = this.capability.case.selected()
    return this.capability.case.delete(selectedCase)?.then(() => {
      getOrCreateBsModal(this.element)?.hide()
      window.location.assign(this.mapperWizardUrlValue)
    })
  }

  // Adds a suggested field, replacing the partly typed token it was suggested for.
  addDisplayField(event) {
    this.fieldsEdited = true
    const field = event.params.field
    const current = (this.settings.additionalFields || []).map((item) => item.text ?? item)
    if (this.fieldQuery && current.at(-1) === this.fieldQuery) current.pop()
    if (field && !current.includes(field)) current.push(field)
    this.settings.additionalFields = current
    this.fieldQuery = ""
    this.render()
  }

  applyFieldDefaults() {
    if (this.fieldsEdited) return
    const preset = this.settings.searchEnginePreset || this.settings.searchEngine
    const defaults = this.capability.settings.pick(preset, this.settings.searchUrl) || {}
    this.settings.idField = defaults.idField || ""
    this.settings.titleField = defaults.titleField || ""
    this.settings.additionalFields = defaults.additionalFields || []
  }

  skipValidation(event) {
    event?.preventDefault()
    this.applyFieldDefaults()
    this.stepIndex = 3
    this.render()
  }

  validateFields() {
    this.fieldError = null
    if (!this.settings.idField?.trim()) this.fieldError = "This field is required. Please select an ID field."
    if (!this.settings.titleField?.trim()) this.fieldError = "This field is required. Please select a title field."
    if (this.fieldError) return this.render()
    // Search API fields come from the mapper code, so only other engines can have a typo here.
    const customField = [this.settings.titleField, this.settings.idField].some((field) => !this.searchFields.includes(field))
    if (customField && this.settings.searchEngine !== "searchapi" &&
      !window.confirm("You are using a custom field for the title or ID (could be a typo), are you sure you want to continue?")) return
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
    this.activeQueries().splice(Number(event.params.index), 1)
    this.render()
  }

  // The queries the case is created with: the CSV's on Static, the typed ones otherwise.
  // Kept apart so importing a CSV and then switching engines doesn't carry its queries over.
  activeQueries() {
    return this.settings?.searchEngine === "static" ? this.staticQueries : this.newQueries
  }

  // Choosing a file shows its content (and any problems with it) under "CSV"; Import does the import.
  async previewStatic(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const content = await file.text()
    this.staticFileContent = content
    this.staticAlert = null
    this.staticStatus = null
    this.staticRows = []
    const { rows, headers, errors } = parseCsv(content)
    const headerResult = validateStaticHeaders(headers.join(","))
    if (!headerResult.valid) this.staticAlert = headerResult.errors.join(" ")
    else if (errors.length) this.staticAlert = `CSV format error: ${errors.join(" ")}`
    else this.staticRows = rows.filter((row) => Object.values(row).some(Boolean))
    this.render()
  }

  async importStatic(event) {
    event?.preventDefault()
    if (this.staticImporting || this.staticImported || this.staticAlert || !this.staticRows.length) return
    this.settings.searchEngine = "static"
    this.settings.searchEnginePreset = "static"
    this.staticImporting = true
    this.staticStatus = "Importing static data…"
    this.render()
    try {
      const importedSnapshots = await importSnapshotsToCase(
        this.staticRows,
        this.capability.navigation.caseNo(),
        getQuepidRootUrl()
      )
      const snapshotId = importedSnapshots.at(-1)?.id
      this.staticSearchUrl = this.snapshotSearchUrlTemplateValue.replaceAll("__SNAPSHOT_ID__", String(snapshotId))
      this.settings.searchUrl = this.staticSearchUrl
      this.staticQueries = [...new Set(this.staticRows.map((row) => row["Query Text"]).filter(Boolean))].map((queryString) => ({ queryString }))
      this.staticImported = true
      this.staticStatus = "Static data imported successfully."
    } catch {
      this.staticStatus = null
      this.staticAlert = "Could not import static data successfully."
    }
    this.staticImporting = false
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
      const { case: caseCapability, endpoints, settings, navigation, user } = this.capability
      const selectedCase = caseCapability.selected()
      if (this.settings.caseName) await caseCapability.rename(selectedCase, this.settings.caseName)
      if (!settings.demoChosen(this.settings.searchEngine, this.settings.searchUrl)) {
        if (endpoints.isEsOrOs(this.settings.searchEngine) && typeof this.settings.queryParams === "string") {
          this.settings.queryParams = this.settings.queryParams.replace("REPLACE_ME", this.settings.titleField || "")
        }
        if (this.settings.searchEngine === "solr") this.settings.queryParams = settings.defaultSolrQueryParams()
      }
      this.settings.selectedTry ||= settings.applicable()
      const queries = this.activeQueries()
      await settings.update({ ...this.settings, newQueries: queries }, { navigateAfterSave: false })
      const texts = queries.map((query) => query.queryString).filter(Boolean)
      if (texts.length) await persistQueries(navigation.caseNo(), texts)
      const currentUser = user.current()
      const isFirstCaseWizard = !currentUser.completedCaseWizard
      await user.shownIntroWizard()
      getOrCreateBsModal(this.element)?.hide()
      navigation.navigateTo({ tryNo: this.settings.selectedTry.tryNo, startTour: isFirstCaseWizard })
    } catch (error) {
      this.saving = false
      this.showError(formatWizardSaveError(error))
      this.render()
    }
  }

  clearValidation() {
    this.urlValid = false
    this.urlInvalid = false
    this.mapperInvalid = false
    this.mapperErrorMessage = null
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
    if (this.hasMapperEnginesTarget && this.hasEngineTileTemplateTarget) {
      // The built-in engine tiles are rendered in ERB; only the mapper-based ones are added here.
      this.mapperEnginesTarget.querySelectorAll("[data-mapper-engine]").forEach((tile) => tile.remove())
      this.mapperEnginesTarget.append(...this.mapperEngines.map((engine) => {
        const tile = this.engineTileTemplateTarget.content.firstElementChild.cloneNode(true)
        const radio = tile.querySelector("input")
        radio.value = engine.id
        radio.setAttribute("aria-label", engine.name)
        const logo = tile.querySelector("img")
        logo.src = `images/${engine.logo || "searchapi"}.png`
        logo.alt = engine.name
        return tile
      }))
    }
    if (!this.hasEndpointSelectTarget) return
    const endpoints = this.searchEndpoints.filter((endpoint) => endpoint.searchEngine !== "static")
    if (!this.endpointTomSelect) {
      this.endpointTomSelect = createSearchEndpointSelect(this.endpointSelectTarget, "Select a search endpoint…")
    }
    updateSearchEndpointSelect(this.endpointTomSelect, endpoints, this.settings?.searchEndpointId)
    if (endpoints.length) this.endpointTomSelect.enable()
    else this.endpointTomSelect.disable()
    this.endpointTomSelect.settings.placeholder = endpoints.length ? "Select a search endpoint…" : "You do not have any Search Endpoints created yet."
    this.endpointTomSelect.inputState()

  }

  // The named conditions that `data-wizard-when` lists in the ERB; an element is shown
  // only while every condition it lists holds.
  conditions() {
    const settings = this.settings || {}
    const engine = settings.searchEngine
    const tls = this.tlsMismatch()
    const mapperRequired = settings.searchEnginePreset === "searchapi" && !settings.searchEndpointId
    const pattern = (settings.queryParams || "").trim()
    return {
      live: engine !== "static",
      static: engine === "static",
      solr: engine === "solr",
      es: engine === "es",
      os: engine === "os",
      searchapi: engine === "searchapi",
      "mapper-required": mapperRequired,
      "can-validate": !mapperRequired && !tls,
      "can-ping": !tls,
      "selected-searchapi": Boolean(settings.searchEndpointId) && engine === "searchapi",
      "test-query-required": this.testQueryRequired(),
      "url-format": Boolean(settings.urlFormat) && !settings.searchEndpointId,
      "basic-auth": settings.supportsBasicAuth !== false,
      "query-pattern-empty": !pattern,
      "static-preview": this.staticFileContent != null,
      "endpoint-open": Boolean(this.endpointMode),
      "query-pattern-no-placeholder": Boolean(pattern) && !pattern.includes("#$query##"),
      // A GET pattern is a one-line query string; anything else is a request body.
      "api-get": settings.apiMethod === "GET",
      "api-body": settings.apiMethod !== "GET",
      "url-valid": Boolean(this.urlValid),
      "url-invalid": Boolean(this.urlInvalid) && !tls,
      "mapper-invalid": Boolean(this.mapperInvalid),
      "no-proxy": settings.proxyRequests !== true,
      chrome: /Chrome/.test(window.navigator.userAgent),
      wiki: Boolean(this.troubleshootingWikiUrl()),
      idle: !this.validating,
      validating: Boolean(this.validating)
    }
  }

  // A Search API endpoint's queries are sent through its query pattern, so the Query step needs one.
  queryPatternRequired() {
    return this.settings?.searchEngine === "searchapi" && !this.settings.queryParams?.trim()
  }

  // An existing Search API endpoint is validated with its test query, so Continue needs one.
  testQueryRequired() {
    const { searchEndpointId, searchEngine, testQuery } = this.settings || {}
    return Boolean(searchEndpointId) && searchEngine === "searchapi" && !testQuery?.trim()
  }

  renderConditions() {
    const conditions = this.conditions()
    this.element.querySelectorAll("[data-wizard-when]").forEach((element) => {
      element.hidden = !element.dataset.wizardWhen.split(/\s+/).every((name) => conditions[name])
    })
  }

  engineDisplayName() {
    const preset = this.settings?.searchEnginePreset || this.settings?.searchEngine || ""
    const tile = this.engineOptionTargets.find((option) => option.value === preset)
    return tile?.closest("label")?.querySelector("img")?.alt || preset
  }

  troubleshootingWikiUrl() {
    const { searchEngine, searchEnginePreset } = this.settings || {}
    return this.capability?.settings.troubleshootingWikiUrl?.(searchEngine, searchEnginePreset) || null
  }

  // The URL a user can open to check the endpoint directly, through the proxy when proxying.
  endpointUrl() {
    const { proxyRequests, searchEndpointId, searchUrl = "" } = this.settings || {}
    if (proxyRequests !== true) return searchUrl
    return (this.capability?.settings.proxyUrlFor(searchEndpointId) || "") + searchUrl
  }

  // Discovered fields not already chosen that match the token being typed; a
  // media:/thumb:/image: modifier is kept on the suggestion, as in the Angular wizard.
  fieldSuggestions() {
    const query = (this.fieldQuery || "").toLowerCase()
    const modifier = FIELD_MODIFIERS.find((prefix) => query.startsWith(prefix)) || ""
    const term = query.slice(modifier.length)
    const chosen = new Set([
      this.settings?.titleField,
      this.settings?.idField,
      ...(this.settings?.additionalFields || [])
        .map((field) => field.text ?? field)
        .filter((field) => field !== this.fieldQuery)
        .map((field) => field.replace(/^(media|thumb|image):/, ""))
    ])
    return this.searchFields
      .filter((field) => !chosen.has(field) && field.toLowerCase().includes(term))
      .slice(0, MAX_FIELD_SUGGESTIONS)
      .map((field) => modifier + field)
  }

  renderGuidance() {
    const settings = this.settings || {}
    const searchUrl = settings.searchUrl || ""
    this.engineNameTargets.forEach((target) => { target.textContent = this.engineDisplayName() })
    this.endpointLinkTargets.forEach((link) => { link.href = this.endpointUrl() })
    const wikiUrl = this.troubleshootingWikiUrl()
    this.wikiLinkTargets.forEach((link) => { if (wikiUrl) link.href = wikiUrl })
    if (this.hasCurlAuthTarget) this.curlAuthTarget.textContent = settings.basicAuthCredential ? `-u ${settings.basicAuthCredential} ` : ""
    if (this.hasSolrConfigUrlTarget) this.solrConfigUrlTarget.textContent = `${searchUrl.substring(0, searchUrl.lastIndexOf("/"))}/config`
    if (this.hasUrlFormatTarget) this.urlFormatTarget.textContent = settings.urlFormat || ""
    if (this.hasMapperMessageTarget) this.mapperMessageTarget.textContent = this.mapperErrorMessage || ""
    if (this.hasSelectedEndpointUrlTarget) this.selectedEndpointUrlTargets.forEach((target) => { target.textContent = searchUrl })
    if (this.hasSelectedEndpointMethodTarget) this.selectedEndpointMethodTargets.forEach((target) => { target.textContent = settings.apiMethod || "" })
  }

  renderFieldChoices() {
    if (this.loaded && this.stepIndex === 3 && this.hasTitleFieldTarget && this.hasIdFieldTarget && !this.fieldSelects) {
      this.fieldSelects = ["titleField", "idField"].map((field) => {
        const input = this[`${field}Target`]
        return new TomSelect(input, {
          maxItems: 1,
          refreshThrottle: 0,
          create: true,
          createOnBlur: false,
          persist: false,
          selectOnTab: true,
          onChange: (value) => {
            this.settings[field] = value
            this.fieldsEdited = true
          }
        })
      })
    }
    this.fieldSelects?.forEach((select, index) => {
      const fields = index === 0 || !this.idFields.length ? this.searchFields : this.idFields
      const key = JSON.stringify(fields)
      if (select.wizardFieldsKey !== key) {
        select.wizardFieldsKey = key
        select.clearOptions()
        select.addOptions(fields.map((value) => ({ value, text: value })))
      }
      const value = this.settings[index === 0 ? "titleField" : "idField"] || ""
      if (select.getValue() !== value && !select.isFocused) {
        if (value) select.addOption({ value, text: value })
        select.setValue(value, true)
      }
    })
    this.renderAdditionalFieldChoices()
  }

  renderAdditionalFieldChoices() {
    if (!this.hasAdditionalFieldsTarget || !this.loaded || this.stepIndex !== 3) return
    if (!this.additionalFieldSelect) {
      this.additionalFieldsTarget.value = ""
      this.additionalFieldSelect = new TomSelect(this.additionalFieldsTarget, {
        plugins: ["remove_button"],
        hideSelected: true,
        maxItems: null,
        refreshThrottle: 0,
        create: true,
        createOnBlur: false,
        persist: false,
        selectOnTab: true,
        splitOn: /[,\s]+/,
        onChange: (value) => {
          this.settings.additionalFields = value ? value.split(",") : []
          this.fieldsEdited = true
        },
        onType: (value) => {
          this.fieldQuery = value
          this.renderAdditionalFieldChoices()
          this.additionalFieldSelect.refreshOptions(false)
        }
      })
    }
    const select = this.additionalFieldSelect
    const values = (this.settings.additionalFields || []).map((field) => field.text ?? field)
    select.clearOptions()
    select.addOptions([...new Set([...this.fieldSuggestions(), ...values])].map((value) => ({ value, text: value })))
    if (JSON.stringify(select.items) !== JSON.stringify(values)) select.setValue(values, true)
  }

  renderTls() {
    if (!this.hasTlsWarningTarget) return
    const mismatch = this.tlsMismatch()
    this.tlsWarningTarget.hidden = !mismatch
    if (!mismatch) return
    const [, protocol] = this.capability.navigation.swapUrlTls()
    this.tlsProtocolTargets.forEach((target) => { target.textContent = protocol })
  }

  reloadInOtherProtocol() {
    const [url] = this.capability.navigation.swapUrlTls()
    const { searchEnginePreset, searchEngine, searchUrl, caseName, apiMethod, basicAuthCredential } = this.settings
    const params = new URLSearchParams({
      showWizard: "true",
      searchEngine: searchEnginePreset || searchEngine || "",
      searchUrl: searchUrl || "",
      caseName: caseName || "",
      apiMethod: apiMethod || "",
      basicAuthCredential: basicAuthCredential || ""
    })
    if (this.endpointMode === "existing") params.set("existingSearchEndpoint", "true")
    window.location.assign(this.capability.navigation.appendQueryParams(url, params.toString()))
  }

  render() {
    this.settings ||= {}
    if (this.hasLoadingTarget) this.loadingTarget.hidden = this.loaded || Boolean(this.error)
    this.stepTargets.forEach((step, index) => step.hidden = !this.loaded || index !== this.stepIndex)
    this.trackerTargets.forEach((item, index) => {
      item.classList.toggle("active", index === this.stepIndex)
      item.classList.toggle("done", index < this.stepIndex)
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
    if (this.hasTestQueryTarget) this.testQueryTarget.value = this.settings?.testQuery || ""
    if (this.hasBasicAuthTarget) this.basicAuthTarget.value = this.settings?.basicAuthCredential || ""
    if (this.hasCustomHeadersTarget) {
      const customHeaders = this.settings?.customHeaders
      this.customHeadersTarget.value = customHeaders && customHeaders !== "null" && typeof customHeaders === "object"
        ? formatEndpointHeaders(customHeaders)
        : customHeaders === "null" ? "" : customHeaders || ""
    }
    if (this.hasHeaderTypeTarget) {
      // Presets default to "None"; an endpoint that already has headers shows them as Custom.
      const hasHeaders = Boolean(this.hasCustomHeadersTarget && this.customHeadersTarget.value.trim())
      const chosen = this.settings?.headerType
      const headerType = hasHeaders && (!chosen || chosen === "None") ? "Custom" : chosen || "None"
      this.headerTypeTarget.value = headerType
      if (this.hasCustomHeadersTarget) this.customHeadersTarget.readOnly = headerType === "None"
    }
    if (this.hasProxyRequestsTarget) this.proxyRequestsTarget.checked = this.settings?.proxyRequests === true
    if (this.endpointTomSelect) this.endpointTomSelect.setValue(String(this.settings?.searchEndpointId ?? ""), true)
    else if (this.hasEndpointSelectTarget) this.endpointSelectTarget.value = String(this.settings?.searchEndpointId ?? "")
    const preset = this.settings?.searchEnginePreset || this.settings?.searchEngine || "solr"
    this.engineOptionTargets.forEach((option) => { option.checked = option.value === preset })
    if (this.hasTitleFieldTarget && !this.fieldSelects) this.titleFieldTarget.value = this.settings?.titleField || ""
    if (this.hasIdFieldTarget && !this.fieldSelects) this.idFieldTarget.value = this.settings?.idField || ""
    // Leave the field list alone while it is being typed in, so a trailing separator survives.
    if (this.hasAdditionalFieldsTarget && !this.additionalFieldSelect && document.activeElement !== this.additionalFieldsTarget) {
      this.additionalFieldsTarget.value = (this.settings?.additionalFields || []).map((field) => field.text ?? field).join(", ")
    }
    if (this.hasQueryPatternTarget) this.queryPatternTargets.forEach((target) => { target.value = this.settings?.queryParams || "" })
    if (this.hasQueryTextTarget) this.queryTextTarget.value = this.settings?.text || ""
    if (this.hasQueryListTarget) {
      this.queryListTarget.replaceChildren(...this.activeQueries().map((query, index) => {
        const item = document.createElement("span")
        item.className = "wiz_new_query"
        const text = document.createElement("span")
        text.className = "query_text"
        text.textContent = query.queryString
        item.append(text)
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
      this.alertTarget.textContent = this.error || this.fieldError || ""
      this.alertTarget.hidden = !this.alertTarget.textContent
    }
    if (this.hasStaticAlertTarget) {
      this.staticAlertTarget.textContent = this.staticAlert || ""
      this.staticAlertTarget.hidden = !this.staticAlert
    }
    if (this.hasStaticContentTarget) this.staticContentTarget.textContent = this.staticFileContent || ""
    if (this.hasStaticImportButtonTarget) {
      this.staticImportButtonTarget.disabled = Boolean(this.staticImporting || this.staticImported || this.staticAlert || !this.staticRows.length)
    }
    if (this.hasStaticStatusTarget) {
      this.staticStatusTarget.textContent = this.staticStatus || ""
      this.staticStatusTarget.hidden = !this.staticStatus
    }
    // A static endpoint has nothing to validate until its CSV has been imported.
    const awaitingStaticImport = this.stepIndex === 2 && this.settings?.searchEngine === "static" && !this.staticImported
    const awaitingTestQuery = this.stepIndex === 2 && this.testQueryRequired()
    const awaitingExistingEndpoint = this.stepIndex === 2 && this.endpointMode === "existing" && !this.settings?.searchEndpointId
    const awaitingQueryPattern = this.stepIndex === 4 && this.queryPatternRequired()
    this.continueButtonTargets.forEach((button) => {
      button.disabled = this.validating || awaitingStaticImport || awaitingTestQuery || awaitingExistingEndpoint || awaitingQueryPattern || (this.stepIndex === 1 && !this.settings?.caseName?.trim())
    })
    // As in the Angular wizard, the existing panel's ping waits for an endpoint to be chosen.
    this.pingButtonTargets.forEach((button) => { button.disabled = Boolean(this.validating || awaitingExistingEndpoint) })
    if (this.hasFinishButtonTarget) this.finishButtonTarget.disabled = this.saving
    if (this.hasStaticFileTarget) this.staticFileTarget.disabled = Boolean(this.staticImported)
    this.renderTls()
    this.renderGuidance()
    this.renderFieldChoices()
    this.renderConditions()
  }
}

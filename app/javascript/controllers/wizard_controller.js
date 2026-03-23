import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"
import {
  defaultSettings,
  pickSettings,
  isDemoUrl,
} from "modules/wizard_settings"
import {
  validateEndpoint,
  validateHeaders,
  isInvalidProxyApiMethod,
  validateMapperCode,
} from "modules/settings_validator"

export default class extends Controller {
  static targets = [
    "modal",
    // Step containers
    "step",
    // Step 2: Name
    "caseNameInput",
    // Step 3: Endpoint
    "searchEngineRadio",
    "searchUrlInput",
    "urlFormatHint",
    "solrPanel",
    "apiMethodSelect",
    "staticPanel",
    "staticFileInput",
    "searchapiPanel",
    "advancedPanel",
    "proxyCheckbox",
    "basicAuthInput",
    "customHeadersInput",
    "existingEndpointSelect",
    "existingEndpointSection",
    "newEndpointSection",
    "testQueryInput",
    "testQuerySection",
    "validationMessage",
    "validateButton",
    "skipValidationButton",
    "continueStep3Button",
    // Step 4: Fields
    "titleFieldInput",
    "titleFieldList",
    "idFieldInput",
    "idFieldList",
    "additionalFieldsContainer",
    "additionalFieldInput",
    "additionalFieldList",
    "fieldValidationMessage",
    // Step 5: Queries
    "queryInput",
    "queryTagsContainer",
    "queryPatternSection",
    "queryPatternInput",
    // Step 6: Finish
    "finishButton",
  ]

  static values = {
    caseId: Number,
    tryNumber: Number,
    caseName: String,
    showWizard: Boolean,
  }

  connect() {
    this.currentStep = 0
    this.searchEngine = "solr"
    this.urlValid = false
    this.discoveredFields = []
    this.discoveredIdFields = []
    this.titleField = ""
    this.idField = ""
    this.additionalFields = []
    this.newQueries = []
    this.queryParams = ""
    this.fieldSpec = ""
    this.existingEndpointId = null
    this.existingEndpoints = []
    this.staticContent = null

    // Initialize with Solr defaults
    const solrDefaults = pickSettings("solr", null)
    this.apiMethod = solrDefaults.apiMethod
    this.proxyRequests = solrDefaults.proxyRequests
    this.basicAuthCredential = solrDefaults.basicAuthCredential
    this.customHeaders = solrDefaults.customHeaders || ""
    this.mapperCode = ""
    this.testQuery = ""

    // Set default URL based on protocol
    const useSecure = window.location.protocol === "https:"
    this.searchUrl = useSecure
      ? solrDefaults.secureSearchUrl
      : solrDefaults.insecureSearchUrl
    if (this.hasSearchUrlInputTarget) {
      this.searchUrlInputTarget.value = this.searchUrl
    }

    // Auto-open if showWizard flag is set
    if (this.showWizardValue) {
      // Slight delay so the page finishes rendering
      this._autoOpenTimer = setTimeout(() => this.open(), 300)
    }
  }

  disconnect() {
    if (this._autoOpenTimer) {
      clearTimeout(this._autoOpenTimer)
      this._autoOpenTimer = null
    }
  }

  open(event) {
    if (event) event.preventDefault()
    this.currentStep = 0
    this._showStep(0)

    const modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget, {
      backdrop: "static",
      keyboard: false,
    })
    modal.show()
  }

  // ── Step navigation ─────────────────────────────────────────────────

  nextStep(event) {
    if (event) event.preventDefault()
    if (this.currentStep < this.stepTargets.length - 1) {
      this.currentStep++
      this._showStep(this.currentStep)

      // Lazy-load endpoint list when entering step 3
      if (this.currentStep === 2 && this.existingEndpoints.length === 0) {
        this._fetchEndpoints()
      }
    }
  }

  prevStep(event) {
    if (event) event.preventDefault()
    if (this.currentStep > 0) {
      this.currentStep--
      this._showStep(this.currentStep)
    }
  }

  goToStep(event) {
    event.preventDefault()
    const step = parseInt(event.currentTarget.dataset.wizardStep, 10)
    if (!isNaN(step)) {
      this.currentStep = step
      this._showStep(step)
    }
  }

  _showStep(index) {
    this.stepTargets.forEach((el, i) => {
      el.classList.toggle("d-none", i !== index)
    })
  }

  // ── Step 2: Case name ───────────────────────────────────────────────

  get caseName() {
    return this.hasCaseNameInputTarget
      ? this.caseNameInputTarget.value.trim()
      : this.caseNameValue
  }

  // ── Step 3: Endpoint configuration ──────────────────────────────────

  changeSearchEngine(event) {
    this.searchEngine = event.currentTarget.value
    this.urlValid = false
    this._clearValidation()

    // Apply defaults for the selected engine
    const settings = pickSettings(this.searchEngine, null)
    this.apiMethod = settings.apiMethod || "POST"
    this.proxyRequests = settings.proxyRequests || false
    this.basicAuthCredential = settings.basicAuthCredential || ""
    this.customHeaders = settings.customHeaders || ""
    this.mapperCode = settings.mapperCode || ""

    // Set default URL
    if (settings.searchUrl) {
      this.searchUrl = settings.searchUrl
      if (this.hasSearchUrlInputTarget) {
        this.searchUrlInputTarget.value = settings.searchUrl
      }
    } else if (settings.insecureSearchUrl) {
      // Solr: pick based on current protocol
      const useSecure = window.location.protocol === "https:"
      this.searchUrl = useSecure
        ? settings.secureSearchUrl
        : settings.insecureSearchUrl
      if (this.hasSearchUrlInputTarget) {
        this.searchUrlInputTarget.value = this.searchUrl
      }
    } else {
      this.searchUrl = ""
      if (this.hasSearchUrlInputTarget) {
        this.searchUrlInputTarget.value = ""
      }
    }

    // Update form elements
    if (this.hasApiMethodSelectTarget) {
      this.apiMethodSelectTarget.value = this.apiMethod
    }
    if (this.hasProxyCheckboxTarget) {
      this.proxyCheckboxTarget.checked = this.proxyRequests
    }
    if (this.hasBasicAuthInputTarget) {
      this.basicAuthInputTarget.value = this.basicAuthCredential
    }
    if (this.hasCustomHeadersInputTarget) {
      this.customHeadersInputTarget.value = this.customHeaders
    }

    // Show/hide engine-specific panels
    this._updateEnginePanels()

    // Show URL format hint
    if (this.hasUrlFormatHintTarget && settings.urlFormat) {
      this.urlFormatHintTarget.textContent =
        "Tip: Your URL should look like " + settings.urlFormat
      this.urlFormatHintTarget.classList.remove("d-none")
    } else if (this.hasUrlFormatHintTarget) {
      this.urlFormatHintTarget.classList.add("d-none")
    }
  }

  changeSearchUrl() {
    this.searchUrl = this.hasSearchUrlInputTarget
      ? this.searchUrlInputTarget.value.trim()
      : ""
    this.urlValid = false
    this._clearValidation()
  }

  changeApiMethod() {
    this.apiMethod = this.hasApiMethodSelectTarget
      ? this.apiMethodSelectTarget.value
      : "POST"
    this._clearValidation()
  }

  changeProxy() {
    this.proxyRequests = this.hasProxyCheckboxTarget
      ? this.proxyCheckboxTarget.checked
      : false
    this._clearValidation()
  }

  toggleNewEndpoint(event) {
    event.preventDefault()
    this.existingEndpointId = null
    this._clearValidation()
    this.urlValid = false
    // Update button styles
    event.currentTarget.classList.add("active")
    event.currentTarget.nextElementSibling?.classList.remove("active")
    if (this.hasNewEndpointSectionTarget) {
      this.newEndpointSectionTarget.classList.remove("d-none")
    }
    if (this.hasExistingEndpointSectionTarget) {
      this.existingEndpointSectionTarget.classList.add("d-none")
    }
    this._updateEnginePanels()
  }

  toggleExistingEndpoint(event) {
    event.preventDefault()
    this._clearValidation()
    this.urlValid = false
    // Update button styles
    event.currentTarget.classList.add("active")
    event.currentTarget.previousElementSibling?.classList.remove("active")
    if (this.hasNewEndpointSectionTarget) {
      this.newEndpointSectionTarget.classList.add("d-none")
    }
    if (this.hasExistingEndpointSectionTarget) {
      this.existingEndpointSectionTarget.classList.remove("d-none")
    }
    // Fetch endpoints if not yet loaded
    if (this.existingEndpoints.length === 0) {
      this._fetchEndpoints()
    }
  }

  changeExistingEndpoint() {
    if (!this.hasExistingEndpointSelectTarget) return

    const selectedId = parseInt(
      this.existingEndpointSelectTarget.value,
      10,
    )
    const endpoint = this.existingEndpoints.find(
      (ep) => (ep.search_endpoint_id || ep.id) === selectedId,
    )

    if (endpoint) {
      this.existingEndpointId = selectedId
      this.searchEngine = endpoint.search_engine
      this.searchUrl = endpoint.endpoint_url
      this.apiMethod = endpoint.api_method || "POST"
      this.proxyRequests = endpoint.proxy_requests || false
      this.basicAuthCredential = endpoint.basic_auth_credential || ""
      this.mapperCode = endpoint.mapper_code || ""
      this.testQuery = endpoint.test_query || ""

      // custom_headers may come back as a parsed object from the API
      // (SearchEndpoint model uses `serialize :custom_headers, coder: JSON`).
      // Normalize to string for consistent handling.
      const ch = endpoint.custom_headers
      this.customHeaders =
        ch && typeof ch === "object" ? JSON.stringify(ch, null, 2) : ch || ""

      // Show test query section for SearchAPI
      if (this.hasTestQuerySectionTarget) {
        this.testQuerySectionTarget.classList.toggle(
          "d-none",
          this.searchEngine !== "searchapi",
        )
      }
      if (this.hasTestQueryInputTarget && this.testQuery) {
        this.testQueryInputTarget.value = this.testQuery
      }
    }

    this.urlValid = false
    this._clearValidation()
  }

  changeTestQuery() {
    this.testQuery = this.hasTestQueryInputTarget
      ? this.testQueryInputTarget.value.trim()
      : ""
  }

  // ── Step 3: Validation ──────────────────────────────────────────────

  // Read current form values from the Advanced panel inputs.
  // Only reads when in "Create New" mode — when using an existing endpoint,
  // the values are already set from the endpoint data and the Advanced
  // panel textarea may be empty/hidden.
  _readAdvancedInputs() {
    if (this.existingEndpointId) return

    if (this.hasBasicAuthInputTarget) {
      this.basicAuthCredential = this.basicAuthInputTarget.value.trim()
    }
    if (this.hasCustomHeadersInputTarget) {
      this.customHeaders = this.customHeadersInputTarget.value.trim()
    }
  }

  async validate(event) {
    if (event) event.preventDefault()

    // Sync form values
    this._readAdvancedInputs()

    // Pre-validation checks
    if (!validateHeaders(this.customHeaders)) {
      this._showValidation(
        "Custom headers must be valid JSON.",
        "danger",
      )
      return
    }

    if (isInvalidProxyApiMethod(this.proxyRequests, this.apiMethod)) {
      this._showValidation(
        "You must change from JSONP to another API method when proxying.",
        "danger",
      )
      return
    }

    // SearchAPI mapper validation
    if (this.searchEngine === "searchapi" && this.mapperCode) {
      const result = validateMapperCode(this.mapperCode)
      if (!result.valid) {
        this._showValidation(result.error, "danger")
        return
      }
    }

    this._showValidation("Validating...", "info")
    if (this.hasValidateButtonTarget) {
      this.validateButtonTarget.disabled = true
      this.validateButtonTarget.textContent = "Validating..."
    }

    try {
      const config = {
        searchEngine: this.searchEngine,
        searchUrl: this.searchUrl,
        apiMethod: this.apiMethod,
        proxyRequests: this.proxyRequests,
        basicAuthCredential: this.basicAuthCredential,
        customHeaders: this.customHeaders,
        mapperCode: this.mapperCode,
        queryParams: this._getEngineQueryParams(),
        testQuery: this.testQuery,
      }

      const result = await validateEndpoint(config)

      this.discoveredFields = result.fields
      this.discoveredIdFields = result.idFields
      this.urlValid = true

      this._showValidation(
        "Quepid can search this! Hit 'Continue' to keep working through setup.",
        "success",
      )

      // Pre-fill field inputs if we got TMDB defaults
      const settings = pickSettings(this.searchEngine, this.searchUrl)
      if (settings.titleField) {
        this.titleField = settings.titleField
      }
      if (settings.idField) {
        this.idField = settings.idField
      }
      if (settings.additionalFields && settings.additionalFields.length > 0) {
        this.additionalFields = [...settings.additionalFields]
      }

      // Enable continue button
      if (this.hasContinueStep3ButtonTarget) {
        this.continueStep3ButtonTarget.disabled = false
      }
    } catch (error) {
      this.urlValid = false
      let msg =
        "Sorry, we're not getting any search results from your " +
        this._engineDisplayName() +
        "."
      msg += " " + error.message
      msg += this._engineTroubleshootingHtml()
      this._showValidation(msg, "danger")

      // Show skip validation button
      if (this.hasSkipValidationButtonTarget) {
        this.skipValidationButtonTarget.classList.remove("d-none")
      }
    } finally {
      if (this.hasValidateButtonTarget) {
        this.validateButtonTarget.disabled = false
        this.validateButtonTarget.textContent = "ping it"
      }
    }
  }

  skipValidation(event) {
    if (event) event.preventDefault()
    this.urlValid = true
    if (this.hasContinueStep3ButtonTarget) {
      this.continueStep3ButtonTarget.disabled = false
    }
    this._clearValidation()

    // Still pre-fill field defaults from settings even though validation was skipped
    const settings = pickSettings(this.searchEngine, this.searchUrl)
    if (settings.titleField) this.titleField = settings.titleField
    if (settings.idField) this.idField = settings.idField
    if (settings.additionalFields && settings.additionalFields.length > 0) {
      this.additionalFields = [...settings.additionalFields]
    }

    this._populateFieldStep()
    this.nextStep()
  }

  continueStep3(event) {
    if (event) event.preventDefault()
    if (!this.urlValid && this.searchEngine !== "static") {
      this._showValidation(
        "Please validate your endpoint first by clicking 'ping it'.",
        "warning",
      )
      return
    }
    // Capture any advanced inputs the user may have changed after validation
    this._readAdvancedInputs()
    // Pre-populate field inputs for Step 4
    this._populateFieldStep()
    this.nextStep()
  }

  // ── Step 3: Static CSV ──────────────────────────────────────────────

  uploadStaticCsv(event) {
    const file = event.currentTarget.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        this._parseStaticCsv(e.target.result)
        this._showValidation("CSV loaded successfully!", "success")
        this.urlValid = true
        if (this.hasContinueStep3ButtonTarget) {
          this.continueStep3ButtonTarget.disabled = false
        }
      } catch (err) {
        this._showValidation("CSV error: " + err.message, "danger")
      }
    }
    reader.readAsText(file)
  }

  _parseStaticCsv(csvText) {
    const lines = csvText.split("\n").filter((l) => l.trim().length > 0)
    if (lines.length < 2) {
      throw new Error("CSV must have a header row and at least one data row.")
    }

    const headers = lines[0].split(",").map((h) => h.trim())
    const requiredHeaders = ["Query Text", "Doc ID", "Doc Position"]
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) {
        throw new Error(`Missing required header: "${req}"`)
      }
    }

    // Check for internal whitespace in field names (headers are already trimmed)
    const fieldHeaders = headers.filter((h) => !requiredHeaders.includes(h))
    for (const fh of fieldHeaders) {
      if (/\s/.test(fh)) {
        throw new Error(
          `Document field name "${fh}" contains whitespace. Field names must not have spaces.`,
        )
      }
    }

    // Parse data rows
    const rows = []
    const queries = new Set()
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim())
      if (cols.length < headers.length) continue
      const row = {}
      headers.forEach((h, idx) => {
        row[h] = cols[idx]
      })
      rows.push(row)
      queries.add(row["Query Text"])
    }

    this.staticContent = {
      headers,
      fieldHeaders,
      rows,
      queries: [...queries],
    }

    // Set discovered fields from CSV headers
    this.discoveredFields = fieldHeaders
    this.discoveredIdFields = fieldHeaders.filter((f) =>
      f.toLowerCase().includes("id"),
    )

    // Auto-populate queries from CSV
    this.newQueries = this.staticContent.queries.map((q) => ({
      queryString: q,
    }))
  }

  // ── Step 3: Mapper wizard redirect ──────────────────────────────────

  goToMapperWizard(event) {
    if (event) event.preventDefault()
    // Close the modal and redirect to the mapper wizard
    window.bootstrap.Modal.getInstance(this.modalTarget)?.hide()
    window.location.href = apiUrl("search_endpoints/mapper_wizard")
  }

  // ── Step 3: Helpers ─────────────────────────────────────────────────

  _getEngineQueryParams() {
    const settings = pickSettings(this.searchEngine, this.searchUrl)
    return settings.queryParams || ""
  }

  async _fetchEndpoints() {
    try {
      const [caseResponse, allResponse] = await Promise.all([
        fetch(apiUrl(`api/cases/${this.caseIdValue}/search_endpoints`), {
          headers: { Accept: "application/json" },
        }),
        fetch(apiUrl("api/search_endpoints"), {
          headers: { Accept: "application/json" },
        }),
      ])

      const caseData = caseResponse.ok ? await caseResponse.json() : {}
      const allData = allResponse.ok ? await allResponse.json() : {}

      const endpointMap = new Map()
      const addList = (list) => {
        ;(Array.isArray(list) ? list : []).forEach((ep) => {
          const epId = ep.search_endpoint_id || ep.id
          if (epId && !endpointMap.has(epId)) {
            endpointMap.set(epId, ep)
          }
        })
      }
      addList(caseData.search_endpoints || [])
      addList(allData.search_endpoints || [])

      this.existingEndpoints = [...endpointMap.values()]
      this._renderEndpointDropdown()
    } catch (error) {
      console.error("Failed to fetch endpoints:", error)
    }
  }

  _renderEndpointDropdown() {
    if (!this.hasExistingEndpointSelectTarget) return

    const select = this.existingEndpointSelectTarget
    select.innerHTML =
      '<option value="">-- Select a search endpoint --</option>'

    // Filter out static endpoints (they're not shareable across cases)
    const filteredEndpoints = this.existingEndpoints.filter(
      (ep) => ep.search_engine !== "static",
    )

    if (filteredEndpoints.length === 0) {
      const option = document.createElement("option")
      option.disabled = true
      option.textContent = "No search endpoints available"
      select.appendChild(option)
      return
    }

    for (const ep of filteredEndpoints) {
      const option = document.createElement("option")
      option.value = ep.search_endpoint_id || ep.id
      option.textContent =
        ep.name || ep.fullname || `Endpoint #${option.value}`
      if (ep.archived) option.textContent += " (archived)"
      select.appendChild(option)
    }
  }

  _updateEnginePanels() {
    // Solr-specific panel
    if (this.hasSolrPanelTarget) {
      this.solrPanelTarget.classList.toggle(
        "d-none",
        this.searchEngine !== "solr",
      )
    }
    // Static panel
    if (this.hasStaticPanelTarget) {
      this.staticPanelTarget.classList.toggle(
        "d-none",
        this.searchEngine !== "static",
      )
    }
    // SearchAPI panel
    if (this.hasSearchapiPanelTarget) {
      this.searchapiPanelTarget.classList.toggle(
        "d-none",
        this.searchEngine !== "searchapi",
      )
    }
    // URL input: hidden for static
    if (this.hasSearchUrlInputTarget) {
      this.searchUrlInputTarget.closest(".mb-3")?.classList.toggle(
        "d-none",
        this.searchEngine === "static",
      )
    }
    // Advanced panel: hidden for static
    if (this.hasAdvancedPanelTarget) {
      this.advancedPanelTarget.classList.toggle(
        "d-none",
        this.searchEngine === "static",
      )
    }
  }

  _engineDisplayName() {
    const names = {
      solr: "Solr",
      es: "Elasticsearch",
      os: "OpenSearch",
      vectara: "Vectara",
      algolia: "Algolia",
      static: "Static",
      searchapi: "Search API",
    }
    return names[this.searchEngine] || this.searchEngine
  }

  _engineTroubleshootingHtml() {
    if (this.searchEngine === "solr") {
      return (
        " Make sure Solr is running and the URL points to a valid collection." +
        " If you're running Solr locally, try enabling Proxy Requests under Advanced."
      )
    }
    if (this.searchEngine === "es" || this.searchEngine === "os") {
      return (
        " Check that CORS is configured on your cluster, or enable Proxy Requests under Advanced." +
        " The URL should end with /_search."
      )
    }
    if (this.searchEngine === "searchapi") {
      return (
        " Is your Search API behind a firewall or proxy?" +
        " Do you need an API Key? Set one up under Advanced > Custom Headers."
      )
    }
    return ""
  }

  _showValidation(message, type) {
    if (this.hasValidationMessageTarget) {
      this.validationMessageTarget.textContent = message
      this.validationMessageTarget.className = `alert alert-${type} mt-2`
      this.validationMessageTarget.classList.remove("d-none")
    }
  }

  _clearValidation() {
    if (this.hasValidationMessageTarget) {
      this.validationMessageTarget.classList.add("d-none")
    }
    if (this.hasSkipValidationButtonTarget) {
      this.skipValidationButtonTarget.classList.add("d-none")
    }
    if (this.hasContinueStep3ButtonTarget) {
      this.continueStep3ButtonTarget.disabled =
        this.searchEngine !== "static" && !this.urlValid
    }
  }

  // ── Step 4: Fields ──────────────────────────────────────────────────

  _populateFieldStep() {
    // Populate datalists with discovered fields
    if (this.hasTitleFieldListTarget) {
      this._fillDatalist(this.titleFieldListTarget, this.discoveredFields)
    }
    if (this.hasIdFieldListTarget) {
      this._fillDatalist(this.idFieldListTarget, this.discoveredIdFields)
    }
    if (this.hasAdditionalFieldListTarget) {
      this._fillDatalist(
        this.additionalFieldListTarget,
        this.discoveredFields,
      )
    }

    // Pre-fill values from settings or discovery
    if (this.hasTitleFieldInputTarget) {
      this.titleFieldInputTarget.value = this.titleField || ""
    }
    if (this.hasIdFieldInputTarget) {
      this.idFieldInputTarget.value = this.idField || ""
    }

    // Render pre-existing additional fields as tags
    this._renderAdditionalFieldTags()
  }

  _fillDatalist(datalistEl, fields) {
    datalistEl.innerHTML = ""
    for (const field of fields) {
      const option = document.createElement("option")
      option.value = field
      datalistEl.appendChild(option)
    }
  }

  addAdditionalField(event) {
    if (event) event.preventDefault()
    if (!this.hasAdditionalFieldInputTarget) return

    const value = this.additionalFieldInputTarget.value.trim()
    if (!value) return
    if (this.additionalFields.includes(value)) return

    this.additionalFields.push(value)
    this.additionalFieldInputTarget.value = ""
    this._renderAdditionalFieldTags()
  }

  removeAdditionalField(event) {
    event.preventDefault()
    const field = event.currentTarget.dataset.field
    this.additionalFields = this.additionalFields.filter((f) => f !== field)
    this._renderAdditionalFieldTags()
  }

  _renderAdditionalFieldTags() {
    if (!this.hasAdditionalFieldsContainerTarget) return

    this.additionalFieldsContainerTarget.innerHTML = ""
    for (const field of this.additionalFields) {
      const tag = document.createElement("span")
      tag.className = "badge bg-secondary me-1 mb-1"
      tag.innerHTML = `${this._escapeHtml(field)} <a href="#" class="text-white ms-1" data-field="${this._escapeHtml(field)}" data-action="click->wizard#removeAdditionalField">&times;</a>`
      this.additionalFieldsContainerTarget.appendChild(tag)
    }
  }

  validateAndContinueStep4(event) {
    if (event) event.preventDefault()

    this.titleField = this.hasTitleFieldInputTarget
      ? this.titleFieldInputTarget.value.trim()
      : ""
    this.idField = this.hasIdFieldInputTarget
      ? this.idFieldInputTarget.value.trim()
      : ""

    if (!this.titleField) {
      this._showFieldValidation("Title field is required.")
      return
    }
    if (!this.idField) {
      this._showFieldValidation("ID field is required.")
      return
    }

    // Check if fields are in the discovered list (warn for custom fields)
    if (
      this.discoveredFields.length > 0 &&
      this.searchEngine !== "searchapi"
    ) {
      const unknownFields = []
      if (!this.discoveredFields.includes(this.titleField)) {
        unknownFields.push(this.titleField)
      }
      if (!this.discoveredFields.includes(this.idField)) {
        unknownFields.push(this.idField)
      }
      for (const f of this.additionalFields) {
        // Strip modifiers like media:, thumb:, image:
        const bare = f.replace(/^(media|thumb|image|translate):/, "")
        if (!this.discoveredFields.includes(bare)) {
          unknownFields.push(f)
        }
      }
      if (unknownFields.length > 0) {
        const proceed = confirm(
          `The following fields were not found in your search results: ${unknownFields.join(", ")}.\n\nContinue anyway?`,
        )
        if (!proceed) return
      }
    }

    // Build field spec string
    const parts = [`id:${this.idField}`, `title:${this.titleField}`]
    for (const f of this.additionalFields) {
      parts.push(f)
    }
    this.fieldSpec = parts.join(", ")

    this._hideFieldValidation()

    // Pre-populate query pattern section for step 5
    this._setupQueryStep()
    this.nextStep()
  }

  _showFieldValidation(message) {
    if (this.hasFieldValidationMessageTarget) {
      this.fieldValidationMessageTarget.textContent = message
      this.fieldValidationMessageTarget.classList.remove("d-none")
    }
  }

  _hideFieldValidation() {
    if (this.hasFieldValidationMessageTarget) {
      this.fieldValidationMessageTarget.classList.add("d-none")
    }
  }

  // ── Step 5: Queries ─────────────────────────────────────────────────

  _setupQueryStep() {
    // Show query pattern section only for SearchAPI
    if (this.hasQueryPatternSectionTarget) {
      this.queryPatternSectionTarget.classList.toggle(
        "d-none",
        this.searchEngine !== "searchapi",
      )
    }

    // Pre-fill query params
    if (this.hasQueryPatternInputTarget && this.searchEngine === "searchapi") {
      this.queryPatternInputTarget.value = this.queryParams || ""
    }

    // Render existing queries (from static CSV or previously added)
    this._renderQueryTags()
  }

  addQuery(event) {
    if (event) event.preventDefault()
    if (!this.hasQueryInputTarget) return

    const text = this.queryInputTarget.value.trim()
    if (!text) return
    if (this.newQueries.some((q) => q.queryString === text)) return

    this.newQueries.push({ queryString: text })
    this.queryInputTarget.value = ""
    this._renderQueryTags()
  }

  removeQuery(event) {
    event.preventDefault()
    const index = parseInt(event.currentTarget.dataset.index, 10)
    this.newQueries.splice(index, 1)
    this._renderQueryTags()
  }

  _renderQueryTags() {
    if (!this.hasQueryTagsContainerTarget) return

    this.queryTagsContainerTarget.innerHTML = ""
    this.newQueries.forEach((q, i) => {
      const tag = document.createElement("span")
      tag.className = "badge bg-info text-dark me-1 mb-1 d-inline-block"
      tag.innerHTML = `${this._escapeHtml(q.queryString)} <a href="#" class="text-dark ms-1" data-index="${i}" data-action="click->wizard#removeQuery">&times;</a>`
      this.queryTagsContainerTarget.appendChild(tag)
    })
  }

  continueStep5(event) {
    if (event) event.preventDefault()

    // Add any text still in the input (with dedup check)
    if (this.hasQueryInputTarget && this.queryInputTarget.value.trim()) {
      const text = this.queryInputTarget.value.trim()
      if (!this.newQueries.some((q) => q.queryString === text)) {
        this.newQueries.push({ queryString: text })
      }
      this.queryInputTarget.value = ""
    }

    // For SearchAPI, capture query params
    if (
      this.hasQueryPatternInputTarget &&
      this.searchEngine === "searchapi"
    ) {
      this.queryParams = this.queryPatternInputTarget.value.trim()
    }

    this.nextStep()
  }

  // ── Step 6: Finish / Submit ─────────────────────────────────────────

  async finish(event) {
    if (event) event.preventDefault()

    if (this.hasFinishButtonTarget) {
      this.finishButtonTarget.disabled = true
      this.finishButtonTarget.textContent = "Setting up..."
    }

    const token = csrfToken()
    const caseId = this.caseIdValue
    const tryNumber = this.tryNumberValue

    try {
      // 1. Determine query params to use
      let queryParams = this._buildFinalQueryParams()

      // 2. Create/update try with search endpoint settings
      const tryPayload = this._buildTryPayload(queryParams)

      const tryResponse = await fetch(
        apiUrl(`api/cases/${caseId}/tries/${tryNumber}`),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
            Accept: "application/json",
          },
          body: JSON.stringify(tryPayload),
        },
      )

      if (!tryResponse.ok) {
        throw new Error(`Failed to update try (${tryResponse.status})`)
      }

      // 3. Rename case if changed
      const newName = this.caseName
      if (newName && newName !== this.caseNameValue) {
        await fetch(apiUrl(`api/cases/${caseId}`), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
            Accept: "application/json",
          },
          body: JSON.stringify({ case: { case_name: newName } }),
        })
      }

      // 4. Create queries
      for (const q of this.newQueries) {
        if (!q.queryString || !q.queryString.trim()) continue
        await fetch(apiUrl(`api/cases/${caseId}/queries`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
            Accept: "application/json",
          },
          body: JSON.stringify({ query: { query_text: q.queryString } }),
        })
      }

      // 5. Close modal and reload (without showWizard param)
      window.bootstrap.Modal.getInstance(this.modalTarget)?.hide()

      const url = new URL(window.location.href)
      url.searchParams.delete("showWizard")
      url.searchParams.delete("new")

      // Start the guided tour after the wizard completes
      url.searchParams.set("startTour", "true")

      window.location.href = url.toString()
    } catch (error) {
      console.error("Wizard submit failed:", error)
      showFlash("Failed to complete wizard: " + error.message, "danger")
      if (this.hasFinishButtonTarget) {
        this.finishButtonTarget.disabled = false
        this.finishButtonTarget.textContent = "Finish"
      }
    }
  }

  _buildFinalQueryParams() {
    const engine = this.searchEngine
    const url = this.searchUrl
    const isDemo = isDemoUrl(engine, url)

    // For SearchAPI, use the user's custom query params
    if (engine === "searchapi") {
      return this.queryParams
    }

    // For demo endpoints, use TMDB-optimized settings
    const settings = pickSettings(engine, url)

    if (!isDemo) {
      // For non-demo ES/OS, replace REPLACE_ME with titleField
      if (engine === "es" || engine === "os") {
        let qp = settings.queryParams || ""
        qp = qp.replace("REPLACE_ME", this.titleField || "*")
        return qp
      }
      // For non-demo Solr, use default Solr params
      if (engine === "solr") {
        return defaultSettings.solr.queryParams
      }
    }

    return settings.queryParams || ""
  }

  _buildTryPayload(queryParams) {
    const payload = {
      try: {
        query_params: queryParams,
        field_spec: this.fieldSpec,
        number_of_rows: 10,
        escape_query: true,
      },
    }

    if (this.existingEndpointId) {
      payload.try.search_endpoint_id = this.existingEndpointId
    } else {
      // Ensure custom_headers is a string for the API
      let headersValue = this.customHeaders || null
      if (headersValue && typeof headersValue === "object") {
        headersValue = JSON.stringify(headersValue)
      }

      payload.search_endpoint = {
        search_engine: this.searchEngine,
        endpoint_url: this.searchUrl,
        api_method: this.apiMethod,
        custom_headers: headersValue,
        basic_auth_credential: this.basicAuthCredential || null,
        proxy_requests: this.proxyRequests,
      }
      if (this.searchEngine === "searchapi" && this.mapperCode) {
        payload.search_endpoint.mapper_code = this.mapperCode
      }
    }

    return payload
  }

  // ── Utility ─────────────────────────────────────────────────────────

  _escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

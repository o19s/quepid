import { Controller } from "@hotwired/stimulus"
import { getOrCreateBsModal } from "utils/bs_modal"
import { getWizardCapabilities } from "utils/core_angular_adapter"
import {
  addUniqueQuery,
  buildFieldSpec,
  formatWizardSaveError,
  invalidProxyApiMethod,
  parseCsvRows,
  parseCustomHeaders,
  validateStaticHeaders
} from "utils/wizard_contracts"

const steps = ["welcome", "name", "endpoint", "fields", "query", "finish"]

export default class extends Controller {
  static targets = [
    "step", "caseName", "endpointMode", "endpointSelect", "engine", "searchUrl", "apiMethod",
    "queryParams", "testQuery", "proxyRequests", "basicAuth", "customHeaders", "titleField",
    "idField", "additionalFields", "queryText", "queryList", "staticFile", "staticPreview",
    "staticAlert", "alert", "continueButton", "finishButton", "validation", "skipButton",
    "mapperEngines", "endpointDetails", "queryPattern", "fieldError", "staticSection"
  ]

  static values = { rootUrl: String, caseNo: String }

  connect() {
    this.stepIndex = 0
    this.searchEndpoints = []
    this.mapperEngines = []
    this.searchFields = []
    this.newQueries = []
    this.staticRows = []
    this.boundOpen = () => this.open()
    this.element.addEventListener("wizard:open", this.boundOpen)
    this.loadWizard()
  }

  disconnect() {
    this.element.removeEventListener("wizard:open", this.boundOpen)
  }

  async loadWizard() {
    this.loadAttempts = (this.loadAttempts || 0) + 1
    if (this.loadAttempts > 100) {
      this.error = "Unable to load the case wizard. Please refresh the page and try again."
      this.render()
      return
    }
    try {
      this.adapter = await getWizardCapabilities()
    } catch (error) {
      if (this.loadAttempts < 100) {
        window.setTimeout(() => this.loadWizard(), 100)
        return
      }
      this.error = error.message
      this.render()
      return
    }

    const { settingsSvc, searchEndpointSvc, mapperBasedSearchEngineSvc: mapperSvc, userSvc } = this.adapter

    this.settings = { ...settingsSvc.editableSettings() }
    this.settings.searchEnginePreset = this.settings.searchEngine || "solr"
    this.settings.newQueries = []
    this.settings.caseName = this.settings.caseName || "Movies Search"

    try {
      await searchEndpointSvc?.list()
      this.searchEndpoints = searchEndpointSvc?.searchEndpoints || []
      await mapperSvc?.list()
      this.mapperEngines = mapperSvc?.engines || []
      this.mapperEngines.forEach((engine) => settingsSvc.registerMapperBasedSearchEngine(engine))
    } catch (error) {
      console.error("wizard: could not load endpoint choices", error)
    }

    this.renderEndpointChoices()
    this.applySettings(this.settings.searchEnginePreset, this.settings.searchUrl)

    if (userSvc?.getUser()?.completedCaseWizard) this.stepIndex = 1
    this.render()
  }

  open() {
    this.render()
    getOrCreateBsModal(this.element, { backdrop: "static", keyboard: false })?.show()
  }

  close(event) {
    event?.preventDefault()
    if (!window.confirm("Are you sure you want to abandon this case?")) return
    const selectedCase = this.adapter.caseSvc?.getSelectedCase()
    this.adapter.caseSvc?.deleteCase(selectedCase)?.then(() => {
      getOrCreateBsModal(this.element)?.hide()
      window.location.assign(this.adapter.caseTryNavSvc.getQuepidRootUrl())
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
    if (event.target.dataset.wizardField === "searchEnginePreset") this.applySettings(event.target.value)
    if (["searchUrl", "proxyRequests", "apiMethod", "basicAuthCredential"].includes(event.target.dataset.wizardField)) this.clearValidation()
    this.render()
  }

  selectEndpoint(event) {
    const endpoint = this.searchEndpoints.find((item) => String(item.id) === event.target.value)
    if (!endpoint) return
    const searchEnginePreset = endpoint.mapperBasedSearchEngineId || endpoint.searchEngine
    const defaults = this.adapter.settingsSvc.pickSettingsToUse(searchEnginePreset, endpoint.endpointUrl)
    const customHeaders = typeof endpoint.customHeaders === "object" && endpoint.customHeaders !== null
      ? JSON.stringify(endpoint.customHeaders, null, 2)
      : endpoint.customHeaders
    this.settings = {
      ...this.settings,
      ...defaults,
      searchEndpointId: endpoint.id,
      searchEngine: endpoint.searchEngine,
      searchEnginePreset,
      searchUrl: endpoint.endpointUrl,
      apiMethod: endpoint.apiMethod || defaults.apiMethod,
      proxyRequests: endpoint.proxyRequests,
      basicAuthCredential: endpoint.basicAuthCredential,
      mapperCode: endpoint.mapperCode,
      testQuery: endpoint.testQuery,
      customHeaders,
      queryParams: endpoint.searchEngine === "searchapi"
        ? defaults.queryParams || (endpoint.testQuery?.includes("#$query##") ? endpoint.testQuery : "")
        : defaults.queryParams || ""
    }
    this.render()
  }

  applySettings(preset, url) {
    const { settingsSvc } = this.adapter
    if (!settingsSvc) return
    const selected = settingsSvc.pickSettingsToUse(preset || this.settings.searchEngine, url)
    this.settings = { ...this.settings, ...selected, searchEnginePreset: preset || selected.searchEngine }
    this.settings.queryParams ||= ""
    if (selected.searchEngine === "solr") {
      this.settings.searchUrl = window.location.protocol === "https:" ? selected.secureSearchUrl : selected.insecureSearchUrl
    }
    this.clearValidation()
  }

  async validate(justValidate = false) {
    this.clearValidation()
    this.setBusy(true)
    if (this.settings.searchEngine === "searchapi" && !this.settings.queryParams?.trim()) return this.fail("Query pattern is required for Search API endpoints.")
    const headerValue = this.hasCustomHeadersTarget ? this.customHeadersTarget.value : this.settings.customHeaders
    this.settings.customHeaders = headerValue
    const headerResult = parseCustomHeaders(headerValue)
    if (!headerResult.valid) return this.fail("Custom Headers must be a valid JSON object")
    if (invalidProxyApiMethod(this.settings.proxyRequests, this.settings.apiMethod)) return this.fail("You must change from JSONP to another API method when proxying.")

    const settings = { ...this.settings }
    if (settings.searchEngine === "static") settings.searchEngine = "solr"
    if (settings.searchEngine === "searchapi") {
      const queryParams = settings.queryParams || ""
      settings.args = settings.testQuery || queryParams.replace(/#\$query##/g, "test")
    }
    if (settings.proxyRequests) settings.proxyUrl = this.adapter.caseTryNavSvc.getQuepidProxyUrl(settings.searchEndpointId)

    try {
      const validator = this.adapter.searchSvc.createValidator(settings)
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
      this.showError(error?.toString()?.replace(/^Error:\s*/, "") || "Quepid could not search this endpoint.")
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
    const rows = parseCsvRows(content)
    const headers = rows[0] || []
    const headerResult = validateStaticHeaders(headers.join(","))
    if (!headerResult.valid) {
      this.staticAlert = headerResult.errors.join(" ")
      return this.render()
    }
    this.staticRows = rows.slice(1).filter((values) => values.some(Boolean)).map((values) => {
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
    })
    this.settings.searchEngine = "static"
    this.settings.searchEnginePreset = "static"
    this.staticAlert = "Importing static data…"
    this.render()
    try {
      await this.adapter.querySnapshotSvc.importSnapshotsToSpecificCase(this.staticRows, this.adapter.caseTryNavSvc.getCaseNo())
      const snapshots = this.adapter.querySnapshotSvc.snapshots || {}
      const snapshotId = Object.keys(snapshots).at(-1)
      this.settings.searchUrl = `${this.adapter.caseTryNavSvc.getQuepidRootUrl()}/api/cases/${this.adapter.caseTryNavSvc.getCaseNo()}/snapshots/${snapshotId}/search`
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
    this.saving = true
    this.render()
    try {
      const { caseSvc, searchEndpointSvc, settingsSvc, queriesSvc, caseTryNavSvc, docCacheSvc, userSvc } = this.adapter
      const selectedCase = caseSvc.getSelectedCase()
      if (this.settings.caseName) await caseSvc.renameCase(selectedCase, this.settings.caseName)
      if (!settingsSvc.demoSettingsChosen(this.settings.searchEngine, this.settings.searchUrl)) {
        if (searchEndpointSvc.isEsOrOsEngine(this.settings.searchEngine) && typeof this.settings.queryParams === "string") {
          this.settings.queryParams = this.settings.queryParams.replace("REPLACE_ME", this.settings.titleField || "")
        }
        if (this.settings.searchEngine === "solr") this.settings.queryParams = settingsSvc.defaultSettings.solr.queryParams
      }
      this.settings.selectedTry ||= settingsSvc.applicableSettings()
      await settingsSvc.update({ ...this.settings, newQueries: this.newQueries })
      const latestSettings = settingsSvc.editableSettings()
      docCacheSvc.invalidate()
      docCacheSvc.update(latestSettings)
      queriesSvc.changeSettings(caseTryNavSvc.getCaseNo(), latestSettings)
      const texts = this.newQueries.map((query) => query.queryString).filter(Boolean)
      if (texts.length && window.quepidSearch?.queryLifecycle) {
        const persisted = await window.quepidSearch.queryLifecycle.persistQueries(caseTryNavSvc.getCaseNo(), texts)
        await window.quepidSearch.queryLifecycle.commitPersistedQueries(persisted)
      }
      const user = userSvc.getUser()
      const isFirstCaseWizard = !user.completedCaseWizard
      user.shownIntroWizard()
      getOrCreateBsModal(this.element)?.hide()
      if (isFirstCaseWizard && typeof window.setupAndStartTour === "function") window.setTimeout(window.setupAndStartTour, 1500)
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
      const builtIns = [
        ["solr", "Solr"], ["es", "Elasticsearch"], ["os", "OpenSearch"], ["vectara", "Vectara"],
        ["algolia", "Algolia"], ["static", "Static"], ["searchapi", "Search API"]
      ]
      this.engineTarget.replaceChildren(...builtIns.concat(this.mapperEngines.map((engine) => [engine.id, engine.name])).map(([value, label]) => {
        const option = document.createElement("option")
        option.value = value
        option.textContent = label
        return option
      }))
    }
    if (!this.hasEndpointSelectTarget) return
    this.endpointSelectTarget.replaceChildren()
    this.searchEndpoints.filter((endpoint) => endpoint.searchEngine !== "static").forEach((endpoint) => {
      const option = document.createElement("option")
      option.value = endpoint.id
      option.textContent = endpoint.name
      this.endpointSelectTarget.append(option)
    })
  }

  render() {
    this.settings ||= {}
    this.stepTargets.forEach((step, index) => step.hidden = index !== this.stepIndex)
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
        ? JSON.stringify(this.settings.customHeaders, null, 2)
        : customHeaders === "null" ? "" : customHeaders || ""
    }
    if (this.hasProxyRequestsTarget) this.proxyRequestsTarget.checked = this.settings?.proxyRequests === true
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
  }
}

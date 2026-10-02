import { Controller } from "@hotwired/stimulus"
import { fromTextArea } from "modules/editor"
import { getTuneRelevanceCapabilities } from "utils/core_capabilities_runtime"
import { curatorVariableEntries, formatJson, queryParamsMode, queryParamsWarning, urlBucket, validateNumberOfRows } from "utils/tune_relevance"
import coreFlash from "utils/core_flash"

const EDITABLE_TABS = new Set(["developer", "curator", "engineSettings"])

export default class extends Controller {
  static targets = [
    "tab", "panel", "action", "sectionBody", "editorShell", "saveButton", "queryEditor", "queryWarning", "staticEngineMessage", "staticKnobsMessage", "curatorVars", "fieldSpec", "numberOfRows", "escapeQuery", "escapeSetting", "nightly", "runEvaluation",
    "endpointSelect", "endpointSearch", "endpointSuggestions", "endpointEmpty", "endpointChooser", "endpointNoResults", "endpointName", "endpointUrl", "endpointIcon", "endpointArchived", "esTemplateWarning", "tlsWarning", "tlsReloadLink", "tlsProtocol",
    "troubleshootingLink", "historyList", "tryTitle", "tryQueryParams", "tryEndpoint", "tryEndpointLink", "tryBrowseLink", "tryFieldSpec", "tryVariables", "tryDelete", "tryRenameAction", "tryModal", "tryNameInput", "tryRenameForm"
  ]

  connect() {
    this.tab = "developer"
    this.editor = null
    this.pollHandle = null
    this.loadCapabilities()
  }

  selectTab(event) {
    this.showTab(event.params.tab)
  }

  toggleSection(event) {
    this.sectionBodyTargets.find(body => body.dataset.sectionBody === event.params.section)?.classList.toggle("d-none")
  }

  filterEndpoints(event) {
    this.renderEndpointSuggestions(event.currentTarget.value)
  }

  submitRename(event) {
    event.preventDefault()
    this.renameTry()
  }

  disconnect() {
    if (this.settingsRetry) window.clearTimeout(this.settingsRetry)
    this.editor?.view?.destroy()
  }

  loadCapabilities() {
    getTuneRelevanceCapabilities()
      .then(services => {
        this.capability = services.capability
        this.load()
      })
      .catch(error => this.showError(error.message || "Unable to load Tune Relevance."))
  }

  load() {
    this.settings = this.capability.settings.editable()
    if (!this.settings?.selectedTry) {
      this.settingsRetry = window.setTimeout(() => this.load(), 200)
      return
    }
    this.settingsRetry = null
    this.searchEndpoints = []
    this.mountEditor()
    this.refresh()
    this.capability.endpoints.fetchForCase(this.capability.navigation.currentCaseNo()).then(() => {
      this.searchEndpoints = this.capability.endpoints.all()
      this.populateEndpoints()
      this.refreshEndpointDetails()
    })
  }

  refresh() {
    this.showTab(this.tab)
    this.refreshQueryEditor()
    this.refreshCuratorVars()
    this.refreshSettings()
    this.refreshTemplateWarning()
    this.refreshTls()
    this.refreshHistory()
  }

  showTab(tab) {
    this.tab = tab
    this.tabTargets.forEach(button => {
      const active = button.dataset.tuneRelevanceTabParam === tab
      button.classList.toggle("active", active)
      button.setAttribute("aria-selected", active ? "true" : "false")
    })
    this.panelTargets.forEach(panel => { panel.hidden = panel.dataset.tunePanel !== tab })
    this.actionTargets.forEach(action => { action.hidden = !EDITABLE_TABS.has(tab) })
  }

  mountEditor() {
    if (!this.hasQueryEditorTarget || this.editor) return
    this.editor = fromTextArea(this.queryEditorTarget, {
      mode: queryParamsMode(this.settings.selectedTry?.queryParams),
      height: 360,
      onChange: value => {
        this.settings.selectedTry.queryParams = value
        this.refreshQueryWarning(value)
        this.refreshCuratorVars()
        this.refreshTemplateWarning()
      }
    })
  }

  refreshQueryEditor() {
    if (!this.settings?.selectedTry) return
    const isStatic = this.settings.searchEngine === "static"
    if (this.hasStaticEngineMessageTarget) this.staticEngineMessageTarget.hidden = !isStatic
    if (this.hasStaticKnobsMessageTarget) this.staticKnobsMessageTarget.hidden = !isStatic
    const editorShell = this.hasEditorShellTarget ? this.editorShellTarget : null
    if (editorShell) editorShell.hidden = isStatic
    const value = this.settings.selectedTry.queryParams || ""
    if (this.editor && this.editor.getValue() !== value) this.editor.setValue(value)
    this.refreshQueryWarning(value)
    if (this.hasQueryEditorTarget) this.queryEditorTarget.dataset.mode = queryParamsMode(value)
    this.editor?.setMode?.(queryParamsMode(value))
  }

  refreshQueryWarning(value) {
    if (this.hasQueryWarningTarget) {
      this.queryWarningTarget.innerHTML = queryParamsWarning(value)
      this.queryWarningTarget.hidden = !this.queryWarningTarget.innerHTML
    }
  }

  refreshCuratorVars() {
    if (!this.hasCuratorVarsTarget) return
    this.settings?.selectedTry?.updateVars?.()
    const vars = this.settings?.selectedTry?.curatorVars || []
    this.curatorVarsTarget.replaceChildren(...curatorVariableEntries(vars).map(({ item, index }) => {
      const row = document.createElement("div")
      row.className = "slider-wrap"
      row.innerHTML = "<label class=\"mb-0\"></label><input type=\"number\" class=\"slider-val form-control form-control-sm\" min=\"0\" max=\"10000000000\">"
      row.querySelector("label").textContent = `${item.name}:`
      const input = row.querySelector("input")
      input.value = item.value ?? ""
      input.dataset.action = "input->tune-relevance#updateCuratorVariable"
      input.dataset.tuneRelevanceIndexParam = String(index)
      return row
    }))
  }

  updateCuratorVariable(event) {
    this.settings.selectedTry.curatorVars[event.params.index].value = event.currentTarget.value
  }

  refreshSettings() {
    if (!this.settings) return
    if (this.hasFieldSpecTarget) this.fieldSpecTarget.value = this.settings.fieldSpec || ""
    if (this.hasNumberOfRowsTarget) this.numberOfRowsTarget.value = this.settings.numberOfRows || ""
    if (this.hasEscapeQueryTarget) this.escapeQueryTarget.checked = Boolean(this.settings.escapeQuery)
    if (this.hasEscapeSettingTarget) this.escapeSettingTarget.hidden = !this.capability.settings.supportsEscapeQuery(this.settings.searchEngine)
    if (this.hasNightlyTarget) this.nightlyTarget.checked = Boolean(this.capability.case.selected()?.nightly)
    this.refreshEndpointDetails()
  }

  populateEndpoints() {
    if (!this.hasEndpointSelectTarget) return
    this.endpointSelectTarget.replaceChildren(new Option("Select endpoint", ""))
    const hasEndpoints = this.searchEndpoints.length > 0
    this.endpointSelectTarget.hidden = !hasEndpoints
    if (this.hasEndpointSearchTarget) this.endpointSearchTarget.hidden = !hasEndpoints
    if (this.hasEndpointChooserTarget) this.endpointChooserTarget.hidden = !hasEndpoints
    if (this.hasEndpointEmptyTarget) this.endpointEmptyTarget.hidden = hasEndpoints
    this.searchEndpoints.forEach(endpoint => {
      const option = new Option(endpoint.name, endpoint.id)
      option.selected = String(endpoint.id) === String(this.settings.searchEndpointId)
      this.endpointSelectTarget.add(option)
    })
    const selected = this.searchEndpoints.find(item => String(item.id) === String(this.settings.searchEndpointId))
    if (this.hasEndpointSearchTarget) this.endpointSearchTarget.value = selected?.name || ""
    this.renderEndpointSuggestions("")
  }

  renderEndpointSuggestions(query) {
    if (!this.hasEndpointSuggestionsTarget) return
    const normalized = query.trim().toLowerCase()
    const matches = normalized ? this.searchEndpoints.filter(endpoint => endpoint.name.toLowerCase().includes(normalized)) : []
    this.endpointSuggestionsTarget.replaceChildren(...matches.slice(0, 8).map(endpoint => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = "list-group-item list-group-item-action"
      button.textContent = endpoint.name
      button.dataset.action = "click->tune-relevance#selectEndpointSuggestion"
      button.dataset.tuneRelevanceEndpointIdParam = String(endpoint.id)
      return button
    }))
    if (this.hasEndpointNoResultsTarget) this.endpointNoResultsTarget.hidden = !normalized || matches.length > 0
  }

  selectEndpointSuggestion(event) {
    const endpoint = this.searchEndpoints.find(item => String(item.id) === String(event.params.endpointId))
    if (endpoint) this.selectEndpoint(endpoint)
  }

  selectEndpoint(endpoint) {
    this.endpointSelectTarget.value = endpoint.id
    this.updateEndpoint({ target: this.endpointSelectTarget })
  }

  refreshEndpointDetails() {
    const selected = this.settings?.selectedTry || {}
    if (this.hasEndpointNameTarget) this.endpointNameTarget.textContent = selected.endpointName || ""
    if (this.hasEndpointUrlTarget) this.endpointUrlTarget.textContent = this.settings?.searchUrl || ""
    if (this.hasEndpointIconTarget) {
      this.endpointIconTarget.hidden = !selected.searchEngine
      this.endpointIconTarget.src = selected.searchEngine ? `images/${selected.mapperBasedSearchEngineId || selected.searchEngine}-icon.png` : ""
    }
    if (this.hasEndpointArchivedTarget) this.endpointArchivedTarget.hidden = !selected.endpointArchived
    if (this.hasTroubleshootingLinkTarget) {
      const url = this.capability.settings.troubleshootingWikiUrl(selected.searchEngine, selected.mapperBasedSearchEngineId)
      this.troubleshootingLinkTarget.hidden = !url
      this.troubleshootingLinkTarget.href = url || "#"
    }
  }

  refreshTemplateWarning() {
    if (!this.hasEsTemplateWarningTarget) return
    let templated = false
    const queryParams = this.settings?.selectedTry?.queryParams || ""
    if (this.settings?.searchEngine && this.capability.endpoints.isEsOrOs(this.settings.searchEngine)) {
      try { templated = this.capability.search.isTemplateCall(JSON.parse(queryParams)) } catch { templated = false }
    }
    this.esTemplateWarningTarget.hidden = !templated
  }

  refreshTls() {
    if (!this.hasTlsWarningTarget) return
    const settings = this.settings || {}
    const mismatch = settings.proxyRequests !== true && this.capability.navigation.needToRedirectProtocol(settings.searchUrl)
    this.tlsWarningTarget.hidden = !mismatch
    if (mismatch) {
      const [url, protocol] = this.capability.navigation.swapUrlTls()
      const params = new URLSearchParams({ searchEngine: settings.searchEngine || "", searchUrl: settings.searchUrl || "", showWizard: "false", apiMethod: settings.apiMethod || "", fieldSpec: settings.fieldSpec || "" })
      this.tlsReloadLinkTarget.href = this.capability.navigation.appendQueryParams(url, params.toString())
      this.tlsProtocolTarget.textContent = protocol
    }
    const save = this.hasSaveButtonTarget ? this.saveButtonTarget : null
    if (save) save.hidden = mismatch || !EDITABLE_TABS.has(this.tab)
  }

  refreshHistory() {
    if (!this.hasHistoryListTarget) return
    const tries = (this.settings?.tries || []).filter(item => !item.deleted)
    const urls = [...new Set(tries.map(item => item.searchUrl))]
    this.historyListTarget.replaceChildren(...tries.map(item => {
      const row = document.createElement("li")
      row.className = `try-history-item bucket-${urlBucket(item.searchUrl, urls)}`
      row.title = item.searchUrl || ""
      row.dataset.tryNo = item.tryNo
      row.innerHTML = "<button type=\"button\" class=\"btn btn-circle try-details\" data-try-details>...</button><span data-try-name></span> <span data-try-query></span>... <span data-try-endpoint></span>"
      row.querySelector("[data-try-name]").textContent = item.formattedName ? item.formattedName() : item.name
      row.querySelector("[data-try-query]").textContent = (item.queryParams || "").slice(0, 200)
      row.querySelector("[data-try-endpoint]").textContent = `using ${item.endpointName || ""}`
      row.dataset.action = "click->tune-relevance#navigateToTry"
      row.dataset.tuneRelevanceTryNoParam = String(item.tryNo)
      const details = row.querySelector("[data-try-details]")
      details.dataset.action = "click->tune-relevance#openTryDetails"
      details.dataset.tuneRelevanceTryNoParam = String(item.tryNo)
      return row
    }))
  }

  navigateToTry(event) {
    this.capability.navigation.goToTry(event.params.tryNo)
  }

  openTryDetails(event) {
    event.stopPropagation()
    const item = this.settings.tries.find(item => String(item.tryNo) === String(event.params.tryNo))
    if (item) this.showTryDetails(item)
  }

  updateEndpoint(event) {
    const endpoint = this.searchEndpoints.find(item => String(item.id) === String(event.target.value))
    if (!endpoint) return
    const customHeaders = endpoint.customHeaders && typeof endpoint.customHeaders === "object" ? JSON.stringify(endpoint.customHeaders, null, 2) : endpoint.customHeaders
    const endpointSettings = {
      searchEndpointId: endpoint.id,
      searchEngine: endpoint.searchEngine,
      searchUrl: endpoint.endpointUrl,
      apiMethod: endpoint.apiMethod,
      customHeaders,
      proxyRequests: endpoint.proxyRequests,
      basicAuthCredential: endpoint.basicAuthCredential,
      mapperCode: endpoint.mapperCode,
      mapperBasedSearchEngineId: endpoint.mapperBasedSearchEngineId
    }
    Object.assign(this.settings, endpointSettings)
    Object.assign(this.settings.selectedTry, { ...endpointSettings, endpointName: endpoint.name })
    this.refresh()
  }

  save() {
    if (this.editor) this.settings.selectedTry.queryParams = this.editor.getValue()
    this.settings.fieldSpec = this.fieldSpecTarget.value
    this.settings.numberOfRows = this.numberOfRowsTarget.value
    this.settings.escapeQuery = this.escapeQueryTarget.checked
    if (!validateNumberOfRows(this.settings.numberOfRows)) return this.showError("Number of Results to Show must be between 1 and 100.")
    const queryParams = this.settings.selectedTry?.queryParams || ""
    const needsJson = this.capability.endpoints.usesJsonQueryParams(this.settings.searchEngine) || (this.settings.searchEngine === "searchapi" && queryParams.trim().startsWith("{"))
    if (needsJson) {
      const formatted = formatJson(queryParams)
      if (!formatted) return this.showError("Please provide a valid formatted JSON object for the query DSL.")
      this.settings.selectedTry.queryParams = formatted
    }
    this.capability.settings.save(this.settings)
  }

  updateNightly() {
    const selectedCase = this.capability.case.selected()
    if (selectedCase) {
      selectedCase.nightly = this.nightlyTarget.checked
      this.capability.case.updateNightly(selectedCase)
    }
  }

  runEvaluation() {
    if (!this.hasRunEvaluationTarget) return
    this.runEvaluationTarget.disabled = true
    this.runEvaluationTarget.textContent = "Queuing evaluation job..."
    this.capability.case.runEvaluation(this.capability.navigation.currentCaseNo(), this.settings.selectedTry.tryNo).then(() => {
      coreFlash.show("success", "Evaluation queued successfully.")
      window.location.assign(this.capability.navigation.rootUrl())
    }).catch(() => {
      coreFlash.show("error", "Unable to queue evaluation.")
    }).finally(() => {
      this.runEvaluationTarget.disabled = false
      this.runEvaluationTarget.textContent = "Rerun My Searches in the Background!"
    })
  }

  showTryDetails(item) {
    if (!this.hasTryModalTarget) return
    this.tryTitleTarget.textContent = item.name || "Try details"
    this.tryQueryParamsTarget.textContent = item.queryParams || ""
    this.tryEndpointLinkTarget.textContent = item.endpointName || ""
    this.tryEndpointLinkTarget.href = item.searchEndpointId ? `search_endpoints/${item.searchEndpointId}` : "#"
    this.tryBrowseLinkTarget.hidden = !item.searchUrl
    this.tryBrowseLinkTarget.href = item.searchUrl || "#"
    this.tryFieldSpecTarget.textContent = item.fieldSpec || ""
    this.tryVariablesTarget.replaceChildren(...(item.curatorVars || []).map(variable => {
      const row = document.createElement("div")
      row.textContent = `##${variable.name}## = ${variable.value}`
      return row
    }))
    this.tryNameInputTarget.value = item.name || ""
    this.tryRenameFormTarget.hidden = true
    this.tryRenameActionTarget.textContent = "Rename"
    this.tryDeleteTarget.disabled = (this.settings.tries || []).filter(tryItem => !tryItem.deleted).length <= 1
    this.activeTry = item
    window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.show()
  }

  toggleRename() {
    if (!this.activeTry) return
    this.tryRenameFormTarget.hidden = !this.tryRenameFormTarget.hidden
    this.tryRenameActionTarget.textContent = this.tryRenameFormTarget.hidden ? "Rename" : "Cancel Rename"
    if (!this.tryRenameFormTarget.hidden) this.tryNameInputTarget.focus()
  }

  duplicateTry() {
    if (!this.activeTry) return
    this.capability.settings.duplicateTry(this.activeTry.tryNo)?.then(newTry => {
      coreFlash.show("success", `Try ${this.activeTry.name} duplicated successfully as ${newTry.name}.`)
      this.reloadSettings()
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
    }).catch(() => this.showError("Unable to duplicate try."))
  }

  renameTry() {
    const name = this.tryNameInputTarget.value.trim()
    if (!name || !this.activeTry) return
    this.capability.settings.renameTry(this.activeTry.tryNo, name).then(() => {
      coreFlash.show("success", "Try renamed successfully.")
      this.reloadSettings()
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
    }).catch(() => this.showError("Unable to rename try."))
  }

  deleteTry() {
    if (!this.activeTry) return
    const activeTryNo = this.settings.selectedTry?.tryNo
    if (this.activeTry.tryNo === activeTryNo) {
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      return this.showError(`You can not delete the currently active try (${this.activeTry.name})! Please select another try first.`)
    }
    const numberOfTries = (this.settings.tries || []).filter(item => !item.deleted).length
    if (numberOfTries <= 1) return
    this.capability.settings.deleteTry(this.activeTry.tryNo).then(() => {
      coreFlash.show("success", "Successfully deleted try!")
      this.reloadSettings()
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
    }).catch(() => this.showError("Unable to delete try."))
  }

  reloadSettings() {
    this.settings = this.capability.settings.reload()
    this.refresh()
  }

  showError(message) {
    coreFlash.show("error", message)
  }
}

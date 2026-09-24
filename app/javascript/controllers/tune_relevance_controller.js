import { Controller } from "@hotwired/stimulus"
import { fromTextArea } from "modules/editor"
import { curatorVariableEntries, formatJson, queryParamsMode, queryParamsWarning, urlBucket, validateNumberOfRows } from "utils/tune_relevance"

const EDITABLE_TABS = new Set(["developer", "curator", "engineSettings"])

export default class extends Controller {
  static targets = [
    "queryEditor", "queryWarning", "staticEngineMessage", "staticKnobsMessage", "curatorVars", "fieldSpec", "numberOfRows", "escapeQuery", "escapeSetting", "nightly", "runEvaluation",
    "endpointSelect", "endpointSearch", "endpointSuggestions", "endpointEmpty", "endpointChooser", "endpointNoResults", "endpointName", "endpointUrl", "endpointIcon", "endpointArchived", "esTemplateWarning", "tlsWarning", "tlsReloadLink", "tlsProtocol",
    "troubleshootingLink", "historyList", "tryTitle", "tryQueryParams", "tryEndpoint", "tryEndpointLink", "tryBrowseLink", "tryFieldSpec", "tryVariables", "tryDelete", "tryRenameAction", "tryModal", "tryNameInput", "tryRenameForm"
  ]

  connect() {
    this.tab = "developer"
    this.editor = null
    this.pollHandle = null
    this.handleClick = event => {
      const tab = event.target.closest("[data-tune-tab]")
      if (tab) return this.showTab(tab.dataset.tuneTab)
      const action = event.target.closest("[data-tune-action]")
      if (action && action.dataset.tuneAction === "save") return this.save()
      if (action && action.dataset.tuneAction === "run-evaluation") return this.runEvaluation()
      const tryAction = event.target.closest("[data-try-action]")
      if (tryAction) return this.handleTryAction(tryAction.dataset.tryAction)
      const section = event.target.closest("[data-section]")
      if (section) this.element.querySelector(`[data-section-body="${section.dataset.section}"]`)?.classList.toggle("d-none")
    }
    this.handleChange = event => {
      if (event.target === this.endpointSelectTarget) this.updateEndpoint(event)
      if (event.target === this.nightlyTarget && event.target.dataset.tuneAction === "nightly") this.updateNightly()
    }
    this.handleInput = event => {
      if (event.target === this.endpointSearchTarget) this.renderEndpointSuggestions(event.target.value)
    }
    this.handleSubmit = event => {
      if (event.target === this.tryRenameFormTarget) {
        event.preventDefault()
        this.renameTry()
      }
    }
    this.element.addEventListener("click", this.handleClick)
    this.element.addEventListener("change", this.handleChange)
    this.element.addEventListener("input", this.handleInput)
    this.element.addEventListener("submit", this.handleSubmit)
    this.waitForAngular()
  }

  disconnect() {
    if (this.pollHandle) window.clearInterval(this.pollHandle)
    if (this.settingsRetry) window.clearTimeout(this.settingsRetry)
    this.element.removeEventListener("click", this.handleClick)
    this.element.removeEventListener("change", this.handleChange)
    this.element.removeEventListener("input", this.handleInput)
    this.element.removeEventListener("submit", this.handleSubmit)
    this.editor?.view?.destroy()
  }

  waitForAngular() {
    let attempts = 0
    this.pollHandle = window.setInterval(() => {
      attempts += 1
      const injector = this.angularInjector()
      if (injector) {
        window.clearInterval(this.pollHandle)
        this.pollHandle = null
        this.settingsSvc = injector.get("settingsSvc")
        this.searchEndpointSvc = injector.get("searchEndpointSvc")
        this.esUrlSvc = injector.get("esUrlSvc")
        this.caseTryNavSvc = injector.get("caseTryNavSvc")
        this.caseSvc = injector.get("caseSvc")
        this.load()
      } else if (attempts > 100) {
        window.clearInterval(this.pollHandle)
        this.showError("Unable to load Tune Relevance.")
      }
    }, 50)
  }

  angularInjector() {
    const root = document.querySelector("[ng-app]")
    return window.angular?.element(root)?.injector?.()
  }

  load() {
    this.settings = this.settingsSvc.editableSettings()
    if (!this.settings?.selectedTry) {
      this.settingsRetry = window.setTimeout(() => this.load(), 200)
      return
    }
    this.settingsRetry = null
    this.searchEndpoints = []
    this.mountEditor()
    this.refresh()
    this.searchEndpointSvc.fetchForCase(this.caseTryNavSvc.getCaseNo()).then(() => {
      this.searchEndpoints = this.searchEndpointSvc.searchEndpoints || []
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
    this.element.querySelectorAll("[data-tune-tab]").forEach(button => {
      const active = button.dataset.tuneTab === tab
      button.classList.toggle("active", active)
      button.setAttribute("aria-selected", active ? "true" : "false")
    })
    this.element.querySelectorAll("[data-tune-panel]").forEach(panel => { panel.hidden = panel.dataset.tunePanel !== tab })
    this.element.querySelectorAll("[data-tune-action]").forEach(action => { action.hidden = !EDITABLE_TABS.has(tab) })
  }

  mountEditor() {
    if (!this.hasQueryEditorTarget || this.editor) return
    this.editor = fromTextArea(this.queryEditorTarget, {
      mode: queryParamsMode(this.settings.selectedTry?.queryParams),
      height: 360
    })
    this.editor.view.dom.addEventListener("input", () => {
      this.settings.selectedTry.queryParams = this.editor.getValue()
      this.refreshQueryEditor()
      this.refreshCuratorVars()
    })
  }

  refreshQueryEditor() {
    if (!this.settings?.selectedTry) return
    const isStatic = this.settings.searchEngine === "static"
    if (this.hasStaticEngineMessageTarget) this.staticEngineMessageTarget.hidden = !isStatic
    if (this.hasStaticKnobsMessageTarget) this.staticKnobsMessageTarget.hidden = !isStatic
    const editorShell = this.hasQueryEditorTarget ? this.queryEditorTarget.closest("#query-params-editor") : null
    if (editorShell) editorShell.hidden = isStatic
    const value = this.settings.selectedTry.queryParams || ""
    if (this.editor && this.editor.getValue() !== value) this.editor.setValue(value)
    if (this.hasQueryWarningTarget) {
      this.queryWarningTarget.innerHTML = queryParamsWarning(value)
      this.queryWarningTarget.hidden = !this.queryWarningTarget.innerHTML
    }
    if (this.hasQueryEditorTarget) this.queryEditorTarget.dataset.mode = queryParamsMode(value)
    this.editor?.setMode?.(queryParamsMode(value))
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
      input.addEventListener("input", event => { vars[index].value = event.target.value })
      return row
    }))
  }

  refreshSettings() {
    if (!this.settings) return
    if (this.hasFieldSpecTarget) this.fieldSpecTarget.value = this.settings.fieldSpec || ""
    if (this.hasNumberOfRowsTarget) this.numberOfRowsTarget.value = this.settings.numberOfRows || ""
    if (this.hasEscapeQueryTarget) this.escapeQueryTarget.checked = Boolean(this.settings.escapeQuery)
    if (this.hasEscapeSettingTarget) this.escapeSettingTarget.hidden = !this.settingsSvc.supportsEscapeQuery(this.settings.searchEngine)
    if (this.hasNightlyTarget) this.nightlyTarget.checked = Boolean(this.caseSvc.getSelectedCase()?.nightly)
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
      button.addEventListener("click", () => this.selectEndpoint(endpoint))
      return button
    }))
    if (this.hasEndpointNoResultsTarget) this.endpointNoResultsTarget.hidden = !normalized || matches.length > 0
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
      const url = this.settingsSvc.troubleshootingWikiUrl(selected.searchEngine, selected.mapperBasedSearchEngineId)
      this.troubleshootingLinkTarget.hidden = !url
      this.troubleshootingLinkTarget.href = url || "#"
    }
  }

  refreshTemplateWarning() {
    if (!this.hasEsTemplateWarningTarget) return
    let templated = false
    const queryParams = this.settings?.selectedTry?.queryParams || ""
    if (this.esUrlSvc && this.settings?.searchEngine && this.searchEndpointSvc.isEsOrOsEngine(this.settings.searchEngine)) {
      try { templated = this.esUrlSvc.isTemplateCall(JSON.parse(queryParams)) } catch { templated = false }
    }
    this.esTemplateWarningTarget.hidden = !templated
  }

  refreshTls() {
    if (!this.hasTlsWarningTarget) return
    const settings = this.settings || {}
    const mismatch = settings.proxyRequests !== true && this.caseTryNavSvc.needToRedirectQuepidProtocol(settings.searchUrl)
    this.tlsWarningTarget.hidden = !mismatch
    if (mismatch) {
      const [url, protocol] = this.caseTryNavSvc.swapQuepidUrlTLS()
      const params = new URLSearchParams({ searchEngine: settings.searchEngine || "", searchUrl: settings.searchUrl || "", showWizard: "false", apiMethod: settings.apiMethod || "", fieldSpec: settings.fieldSpec || "" })
      this.tlsReloadLinkTarget.href = this.caseTryNavSvc.appendQueryParams(url, params.toString())
      this.tlsProtocolTarget.textContent = protocol
    }
    const save = this.element.querySelector('[data-tune-action="save"]')
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
      row.addEventListener("click", () => this.caseTryNavSvc.navigateTo({ tryNo: item.tryNo }))
      row.querySelector("[data-try-details]").addEventListener("click", event => { event.stopPropagation(); this.showTryDetails(item) })
      return row
    }))
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
    const needsJson = this.searchEndpointSvc.usesJsonQueryParams(this.settings.searchEngine) || (this.settings.searchEngine === "searchapi" && queryParams.trim().startsWith("{"))
    if (needsJson) {
      const formatted = formatJson(queryParams)
      if (!formatted) return this.showError("Please provide a valid formatted JSON object for the query DSL.")
      this.settings.selectedTry.queryParams = formatted
    }
    this.settingsSvc.save(this.settings)
  }

  updateNightly() {
    const selectedCase = this.caseSvc.getSelectedCase()
    if (selectedCase) this.caseSvc.updateNightly(selectedCase)
  }

  runEvaluation() {
    if (!this.hasRunEvaluationTarget) return
    this.runEvaluationTarget.disabled = true
    this.runEvaluationTarget.textContent = "Queuing evaluation job..."
    this.caseSvc.runEvaluation(this.caseTryNavSvc.getCaseNo(), this.settings.selectedTry.tryNo).then(() => {
      window.quepidDom?.flash?.show("success", "Evaluation queued successfully.")
      window.location.assign(this.caseTryNavSvc.getQuepidRootUrl())
    }).catch(() => {
      window.quepidDom?.flash?.show("error", "Unable to queue evaluation.")
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

  handleTryAction(action) {
    if (!this.activeTry) return
    if (action === "rename") {
      this.tryRenameFormTarget.hidden = !this.tryRenameFormTarget.hidden
      this.tryRenameActionTarget.textContent = this.tryRenameFormTarget.hidden ? "Rename" : "Cancel Rename"
      if (!this.tryRenameFormTarget.hidden) this.tryNameInputTarget.focus()
    } else if (action === "duplicate") {
      this.settingsSvc.duplicateTry(this.activeTry.tryNo)?.then(newTry => {
        window.quepidDom?.flash?.show("success", `Try ${this.activeTry.name} duplicated successfully as ${newTry.name}.`)
        this.reloadSettings()
        window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      }).catch(() => this.showError("Unable to duplicate try."))
    } else if (action === "delete") {
      this.deleteTry()
    }
  }

  renameTry() {
    const name = this.tryNameInputTarget.value.trim()
    if (!name || !this.activeTry) return
    this.settingsSvc.renameTry(this.activeTry.tryNo, name).then(() => {
      window.quepidDom?.flash?.show("success", "Try renamed successfully.")
      this.reloadSettings()
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
    }).catch(() => this.showError("Unable to rename try."))
  }

  deleteTry() {
    const activeTryNo = this.settings.selectedTry?.tryNo
    if (this.activeTry.tryNo === activeTryNo) {
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      return this.showError(`You can not delete the currently active try (${this.activeTry.name})! Please select another try first.`)
    }
    const numberOfTries = (this.settings.tries || []).filter(item => !item.deleted).length
    if (numberOfTries <= 1) return
    this.settingsSvc.deleteTry(this.activeTry.tryNo).then(() => {
      window.quepidDom?.flash?.show("success", "Successfully deleted try!")
      this.reloadSettings()
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
    }).catch(() => this.showError("Unable to delete try."))
  }

  reloadSettings() {
    this.settings = this.settingsSvc.editableSettings()
    this.refresh()
  }

  showError(message) {
    window.quepidDom?.flash?.show("error", message)
  }
}

import {
  createSearchEndpointSelect,
  updateSearchEndpointSelect
} from "modules/search_endpoint_select"
import TomSelect from "tom-select"
import { endpointSettings } from "utils/endpoint_settings"
import { Controller } from "@hotwired/stimulus"
import { fromTextArea } from "modules/editor"
import { getTuneRelevanceCapabilities } from "utils/core_capabilities_runtime"
import {
  curatorVariableEntries,
  fieldSpecTokens,
  formatJson,
  historyTitle,
  queryParamsMode,
  queryParamsWarning,
  urlBucket,
  validateNumberOfRows
} from "utils/tune_relevance"
import coreFlash from "utils/core_flash"
import { normalizeSearchEngine, searchEngineLabel } from "utils/search_engines"
import { parseCustomHeaders, searchApiValidationArgs } from "utils/wizard_contracts"
import { isSameId } from "utils/record_identity"

const EDITABLE_TABS = new Set(["developer", "curator", "engineSettings"])

// A link with nowhere to go loses its href (reads as plain text) rather than pointing at "#".
function setLinkHref(link, url) {
  if (url) link.href = url
  else link.removeAttribute("href")
}

export default class extends Controller {
  static targets = [
    "tab",
    "panel",
    "action",
    "sectionBody",
    "editorShell",
    "saveButton",
    "queryEditor",
    "queryWarning",
    "staticEngineMessage",
    "staticKnobsMessage",
    "knobsIntro",
    "curatorVars",
    "curatorVarTemplate",
    "fieldSpec",
    "fieldDiscoveryStatus",
    "numberOfRows",
    "escapeQuery",
    "escapeSetting",
    "nightly",
    "runEvaluation",
    "endpointSelect",
    "endpointEmpty",
    "endpointName",
    "endpointUrl",
    "endpointIcon",
    "endpointArchived",
    "esTemplateWarning",
    "tlsWarning",
    "tlsProtocol",
    "tlsExplanation",
    "tlsExplanationProtocol",
    "tlsEditLink",
    "troubleshootingLink",
    "troubleshootingEngine",
    "endpointMoreLink",
    "historyList",
    "historyItemTemplate",
    "tryTitle",
    "tryQueryParams",
    "tryEndpoint",
    "tryEndpointLink",
    "tryBrowseLink",
    "tryFieldSpec",
    "tryVariables",
    "tryDelete",
    "tryRenameAction",
    "tryModal",
    "tryNameInput",
    "tryRenameForm"
  ]

  static values = { engineLabels: Object }
  static outlets = ["pane"]

  connect() {
    this.tab = "developer"
    this.editor = null
    this.loadCapabilities()
  }

  selectTab(event) {
    this.showTab(event.params.tab)
  }

  toggleSection(event) {
    const body = this.sectionBodyTargets.find(
      (body) => body.dataset.sectionBody === event.params.section
    )
    if (!body) return
    const collapsed = body.classList.toggle("d-none")
    const icon = event.currentTarget?.querySelector(".bi")
    icon?.classList.toggle("bi-plus-circle-fill", collapsed)
    icon?.classList.toggle("bi-dash-circle-fill", !collapsed)
  }

  submitRename(event) {
    event.preventDefault()
    this.renameTry()
  }

  disconnect() {
    this.endpointTomSelect?.destroy()
    this.endpointTomSelect = null
    if (this.settingsRetry) window.clearTimeout(this.settingsRetry)
    this.editor?.destroy()
    this.editor = null
    this.displayedFieldsSelect?.destroy()
    this.displayedFieldsSelect = null
    this.displayedFieldsLookupKey = null
  }

  loadCapabilities() {
    getTuneRelevanceCapabilities()
      .then((services) => {
        this.capability = services.capability
        this.load()
      })
      .catch((error) => this.showError(error.message || "Unable to load Tune Relevance."))
  }

  load() {
    this.settings = this.capability.settings.editable()
    if (!this.settings) {
      this.settingsRetry = window.setTimeout(() => this.load(), 200)
      return
    }
    this.settingsRetry = null
    const keptTab = this.hasPaneOutlet ? this.paneOutlet.handoff?.tab : null
    if (keptTab && this.panelTargets.some((panel) => panel.dataset.tunePanel === keptTab))
      this.tab = keptTab
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
    this.tabTargets.forEach((button) => {
      const active = button.dataset.tuneRelevanceTabParam === tab
      button.classList.toggle("active", active)
      button.setAttribute("aria-selected", active ? "true" : "false")
    })
    this.panelTargets.forEach((panel) => {
      panel.hidden = panel.dataset.tunePanel !== tab
    })
    this.actionTargets.forEach((action) => {
      action.hidden = !EDITABLE_TABS.has(tab)
    })
    // The Rerun / Reload choice also depends on the protocol check, so re-apply it after every tab change.
    if (this.settings) this.refreshTls()
  }

  mountEditor() {
    if (!this.hasQueryEditorTarget || this.editor) return
    this.editor = fromTextArea(this.queryEditorTarget, {
      mode: queryParamsMode(this.settings.queryParams),
      height: 360,
      onChange: (value) => {
        if (this.formattingQueryEditor) return
        this.settings.queryParams = value
        this.refreshQueryWarning(value)
        this.refreshCuratorVars()
        this.refreshTemplateWarning()
      }
    })
  }

  refreshQueryEditor() {
    if (!this.settings) return
    const isStatic = this.settings.searchEngine === "static"
    if (this.hasStaticEngineMessageTarget) this.staticEngineMessageTarget.hidden = !isStatic
    if (this.hasStaticKnobsMessageTarget) this.staticKnobsMessageTarget.hidden = !isStatic
    const editorShell = this.hasEditorShellTarget ? this.editorShellTarget : null
    if (editorShell) editorShell.hidden = isStatic
    const value = this.settings.queryParams || ""
    const editorValue = /^[^=&\s]+=/.test(value.trimStart())
      ? value.replace(/(?<![\r\n])&/g, "\n&")
      : value
    if (this.editor && this.editor.getValue() !== editorValue) {
      this.formattingQueryEditor = true
      try {
        this.editor.setValue(editorValue)
      } finally {
        this.formattingQueryEditor = false
      }
    }
    this.refreshQueryWarning(value)
    if (this.hasQueryEditorTarget) this.queryEditorTarget.dataset.mode = queryParamsMode(value)
    this.editor?.setMode?.(queryParamsMode(value))
  }

  refreshQueryWarning(value) {
    if (!this.hasQueryWarningTarget) return
    const warning = queryParamsWarning(value)
    const code = (text) => Object.assign(document.createElement("code"), { textContent: text })
    this.queryWarningTarget.replaceChildren(
      ...(warning
        ? [
            "Your query params contain ",
            code(warning.typo),
            ", you probably meant ",
            code(warning.correction),
            "."
          ]
        : [])
    )
    this.queryWarningTarget.hidden = !warning
  }

  refreshCuratorVars() {
    if (!this.hasCuratorVarsTarget || !this.hasCuratorVarTemplateTarget) return
    this.settings?.updateVars?.()
    const vars = this.settings?.curatorVars || []
    const entries = curatorVariableEntries(vars)
    // As in the Angular drawer, a try without knobs explains what the tab is for. A knob removed from the
    // query stays on the try (unused), so it still counts.
    if (this.hasKnobsIntroTarget)
      this.knobsIntroTarget.hidden = vars.length > 0 || this.settings?.searchEngine === "static"
    this.curatorVarsTarget.replaceChildren(
      ...entries.map(({ item, index }) => {
        const row = this.curatorVarTemplateTarget.content.firstElementChild.cloneNode(true)
        row.querySelector("label").textContent = `${item.name}:`
        const input = row.querySelector("input")
        input.value = item.value ?? ""
        input.dataset.tuneRelevanceIndexParam = String(index)
        return row
      })
    )
  }

  updateCuratorVariable(event) {
    this.settings.curatorVars[event.params.index].value = event.currentTarget.value
  }

  refreshSettings() {
    if (!this.settings) return
    if (this.hasFieldSpecTarget) this.refreshDisplayedFields()
    if (this.hasNumberOfRowsTarget) this.numberOfRowsTarget.value = this.settings.numberOfRows || ""
    if (this.hasEscapeQueryTarget)
      this.escapeQueryTarget.checked = Boolean(this.settings.escapeQuery)
    if (this.hasEscapeSettingTarget)
      this.escapeSettingTarget.hidden = !this.capability.settings.supportsEscapeQuery(
        this.settings.searchEngine
      )
    if (this.hasNightlyTarget)
      this.nightlyTarget.checked = Boolean(this.capability.case.selected()?.nightly)
    if (this.endpointTomSelect)
      this.endpointTomSelect.setValue(String(this.settings.searchEndpointId ?? ""), true)
    this.refreshEndpointDetails()
  }

  refreshDisplayedFields() {
    this.displayedFieldsSource = this.settings.fieldSpec || ""
    const fields = fieldSpecTokens(this.displayedFieldsSource)
    if (!this.displayedFieldsSelect) {
      this.fieldSpecTarget.value = ""
      this.displayedFieldsSelect = new TomSelect(this.fieldSpecTarget, {
        plugins: ["remove_button"],
        maxItems: null,
        hideSelected: true,
        create: true,
        createOnBlur: false,
        persist: false,
        selectOnTab: true,
        refreshThrottle: 0,
        splitOn: /[,\s]+/,
        onFocus: () => this.discoverDisplayedFields(),
        onType: (value) => {
          this.addDiscoveredFieldOptions(value)
          this.displayedFieldsSelect.refreshOptions(false)
        }
      })
    }
    const select = this.displayedFieldsSelect
    const knownFields = [
      this.displayedFieldsSource,
      ...this.capability.settings.tries().map((item) => item.fieldSpec || "")
    ].flatMap(fieldSpecTokens)
    select.clear(true)
    select.clearOptions()
    select.addOptions([...new Set(knownFields)].map((value) => ({ value, text: value })))
    select.setValue(fields, true)
    this.addDiscoveredFieldOptions()
  }

  displayedFieldsEndpointKey() {
    const {
      searchEngine,
      searchEndpointId,
      searchUrl,
      apiMethod,
      proxyRequests,
      basicAuthCredential,
      customHeaders,
      mapperCode,
      queryParams
    } = this.settings
    return JSON.stringify([
      searchEngine,
      searchEndpointId,
      searchUrl,
      apiMethod,
      proxyRequests,
      basicAuthCredential,
      customHeaders,
      mapperCode,
      queryParams
    ])
  }

  addDiscoveredFieldOptions(query = "") {
    if (this.discoveredFieldsKey !== this.displayedFieldsEndpointKey()) return
    const prefix = query.match(/^(id|title|thumb|image|media|translations):/)?.[0] || ""
    this.displayedFieldsSelect?.addOptions(
      (this.discoveredFields || []).map((field) => {
        const value = prefix + field
        return { value, text: value }
      })
    )
  }

  fieldDiscoveryStatus(message) {
    if (!this.hasFieldDiscoveryStatusTarget) return
    this.fieldDiscoveryStatusTarget.textContent = message
    this.fieldDiscoveryStatusTarget.hidden = !message
  }

  async discoverDisplayedFields() {
    const key = this.displayedFieldsEndpointKey()
    if (this.displayedFieldsLookupKey === key) return
    this.displayedFieldsLookupKey = key
    this.fieldDiscoveryStatus("Finding available fields…")
    try {
      const settings = {
        ...this.settings,
        searchEngine: normalizeSearchEngine(this.settings.searchEngine)
      }
      const headers = parseCustomHeaders(settings.customHeaders)
      if (!headers.valid) throw new Error("Invalid custom headers")
      settings.customHeaders = headers.headers
      if (settings.proxyRequests)
        settings.proxyUrl = this.capability.settings.proxyUrlFor(settings.searchEndpointId)
      if (settings.searchEngine === "searchapi") {
        settings.args = searchApiValidationArgs(
          (settings.queryParams || "").replace(/#\$query##/g, "test"),
          settings.bareQueryParam
        )
        const mapper = this.capability.search.evaluateMapper(settings.mapperCode)
        if (!mapper.numberOfResultsMapper || !mapper.docsMapper)
          throw new Error("Missing mapper functions")
        Object.assign(settings, {
          numberOfResultsMapper: mapper.numberOfResultsMapper,
          docsMapper: mapper.docsMapper
        })
      }
      const validator = this.capability.search.createValidator(settings)
      await validator.validateUrl()
      if (
        !this.displayedFieldsSelect ||
        this.displayedFieldsEndpointKey() !== key ||
        this.displayedFieldsLookupKey !== key
      )
        return
      this.discoveredFields = validator.fields || []
      this.discoveredFieldsKey = key
      this.addDiscoveredFieldOptions(this.displayedFieldsSelect.control_input.value)
      this.displayedFieldsSelect.refreshOptions(false)
      this.fieldDiscoveryStatus("")
    } catch {
      if (
        !this.displayedFieldsSelect ||
        this.displayedFieldsEndpointKey() !== key ||
        this.displayedFieldsLookupKey !== key
      )
        return
      this.displayedFieldsLookupKey = null
      this.fieldDiscoveryStatus(
        "Could not load field suggestions. Your selected fields are unchanged."
      )
    }
  }

  displayedFieldsValue() {
    if (!this.displayedFieldsSelect) return this.fieldSpecTarget.value
    const select = this.displayedFieldsSelect
    const original = fieldSpecTokens(this.displayedFieldsSource || "")
    return JSON.stringify(select.items) === JSON.stringify(original)
      ? this.displayedFieldsSource
      : select.items.join(", ")
  }

  populateEndpoints() {
    if (!this.hasEndpointSelectTarget) return
    if (this.hasEndpointEmptyTarget)
      this.endpointEmptyTarget.hidden = this.searchEndpoints.length > 0
    this.endpointTomSelect ||= createSearchEndpointSelect(
      this.endpointSelectTarget,
      "Select a search endpoint…"
    )
    updateSearchEndpointSelect(
      this.endpointTomSelect,
      this.searchEndpoints,
      this.settings.searchEndpointId
    )
  }

  refreshEndpointDetails() {
    const selected = this.settings || {}
    if (this.hasEndpointNameTarget)
      this.endpointNameTarget.textContent = selected.endpointName || ""
    if (this.hasEndpointUrlTarget)
      this.endpointUrlTarget.textContent = this.settings?.searchUrl || ""
    if (this.hasEndpointIconTarget) {
      this.endpointIconTarget.hidden = !selected.searchEngine
      this.endpointIconTarget.src = selected.searchEngine
        ? `images/${selected.mapperBasedSearchEngineId || selected.searchEngine}-icon.png`
        : ""
    }
    if (this.hasEndpointArchivedTarget)
      this.endpointArchivedTarget.hidden = !selected.endpointArchived
    if (this.hasEndpointMoreLinkTarget) {
      this.endpointMoreLinkTarget.hidden = !selected.searchEndpointId
      setLinkHref(
        this.endpointMoreLinkTarget,
        selected.searchEndpointId && `search_endpoints/${selected.searchEndpointId}`
      )
    }
    if (this.hasTroubleshootingLinkTarget) {
      const url = this.capability.settings.troubleshootingWikiUrl(
        selected.searchEngine,
        selected.mapperBasedSearchEngineId
      )
      this.troubleshootingLinkTarget.hidden = !url
      setLinkHref(this.troubleshootingLinkTarget, url)
    }
    if (this.hasTroubleshootingEngineTarget) {
      this.troubleshootingEngineTarget.textContent = searchEngineLabel(
        this.engineLabelsValue,
        selected.mapperBasedSearchEngineName || selected.searchEngine
      )
    }
  }

  refreshTemplateWarning() {
    if (!this.hasEsTemplateWarningTarget) return
    let templated = false
    const queryParams = this.settings?.queryParams || ""
    if (
      this.settings?.searchEngine &&
      this.capability.endpoints.isEsOrOs(this.settings.searchEngine)
    ) {
      try {
        templated = this.capability.search.isTemplateCall(JSON.parse(queryParams))
      } catch {
        templated = false
      }
    }
    this.esTemplateWarningTarget.hidden = !templated
  }

  refreshTls() {
    if (!this.hasTlsWarningTarget) return
    const settings = this.settings || {}
    const mismatch =
      settings.proxyRequests !== true &&
      this.capability.navigation.needToRedirectProtocol(settings.searchUrl)
    // As in the Angular drawer, the Reload button replaces Rerun only on the tabs that have Rerun.
    this.tlsWarningTarget.hidden = !mismatch || !EDITABLE_TABS.has(this.tab)
    if (mismatch) this.tlsProtocolTarget.textContent = this.capability.navigation.swapUrlTls()[1]
    if (this.hasTlsExplanationTarget) {
      this.tlsExplanationTarget.hidden = !mismatch
      if (mismatch) {
        this.tlsExplanationProtocolTarget.textContent = this.tlsProtocolTarget.textContent
        setLinkHref(
          this.tlsEditLinkTarget,
          settings.searchEndpointId && `search_endpoints/${settings.searchEndpointId}/edit`
        )
      }
    }
    const save = this.hasSaveButtonTarget ? this.saveButtonTarget : null
    if (save) save.hidden = mismatch || !EDITABLE_TABS.has(this.tab)
  }

  reloadInOtherProtocol() {
    const settings = this.settings || {}
    const [url] = this.capability.navigation.swapUrlTls()
    const params = new URLSearchParams({
      searchEngine: settings.searchEngine || "",
      searchUrl: settings.searchUrl || "",
      showWizard: "false",
      apiMethod: settings.apiMethod || "",
      fieldSpec: settings.fieldSpec || ""
    })
    window.location.assign(this.capability.navigation.appendQueryParams(url, params.toString()))
  }

  refreshHistory() {
    if (!this.hasHistoryListTarget || !this.hasHistoryItemTemplateTarget) return
    const tries = this.capability.settings.tries().filter((item) => !item.deleted)
    const urls = [...new Set(tries.map((item) => item.searchUrl))]
    this.historyListTarget.replaceChildren(
      ...tries.map((item) => {
        const row = this.historyItemTemplateTarget.content.firstElementChild.cloneNode(true)
        row.classList.add(`bucket-${urlBucket(item.searchUrl, urls)}`)
        row.title = historyTitle(item)
        row.dataset.tryNo = item.tryNo
        row.querySelector("[data-try-name]").textContent = item.formattedName
          ? item.formattedName()
          : item.name
        row.querySelector("[data-try-query]").textContent = (item.queryParams || "").slice(0, 200)
        row.querySelector("[data-try-endpoint]").textContent = `using ${item.endpointName || ""}`
        row.dataset.tuneRelevanceTryNoParam = String(item.tryNo)
        row.querySelector("[data-try-details]").dataset.tuneRelevanceTryNoParam = String(item.tryNo)
        return row
      })
    )
  }

  navigateToTry(event) {
    this.keepDrawerOpen()
    this.capability.navigation.goToTry(event.params.tryNo)
  }

  openTryDetails(event) {
    event.stopPropagation()
    const item = this.capability.settings
      .tries()
      .find((item) => isSameId(item.tryNo, event.params.tryNo))
    if (item) this.showTryDetails(item)
  }

  updateEndpoint(event) {
    const endpoint = this.searchEndpoints.find((item) => isSameId(item.id, event.target.value))
    if (!endpoint) return
    const selectedEndpointSettings = {
      ...endpointSettings(endpoint),
      mapperBasedSearchEngineId: endpoint.mapperBasedSearchEngineId
    }
    this.settings.applyEndpoint({ ...selectedEndpointSettings, endpointName: endpoint.name })
    this.refresh()
  }

  async save() {
    if (this.saving) return
    if (this.editor) this.settings.queryParams = this.editor.getValue()
    this.settings.fieldSpec = this.displayedFieldsValue()
    this.settings.numberOfRows = this.numberOfRowsTarget.value
    this.settings.escapeQuery = this.escapeQueryTarget.checked
    if (!validateNumberOfRows(this.settings.numberOfRows))
      return this.showError("Number of Results to Show must be between 1 and 100.")
    const queryParams = this.settings.queryParams || ""
    const needsJson =
      this.capability.endpoints.usesJsonQueryParams(this.settings.searchEngine) ||
      (this.settings.searchEngine === "searchapi" && queryParams.trim().startsWith("{"))
    if (needsJson) {
      const formatted = formatJson(queryParams)
      if (!formatted)
        return this.showError("Please provide a valid formatted JSON object for the query DSL.")
      this.settings.queryParams = formatted
    }
    this.saving = true
    this.saveButtonTarget.disabled = true
    try {
      const savedTry = await this.capability.settings.save(this.settings)
      if (savedTry) {
        this.keepDrawerOpen()
        this.capability.navigation.goToTry(savedTry.tryNo)
      }
    } catch (error) {
      this.showError(error.message || "Unable to save settings. Please try again.")
    } finally {
      this.saving = false
      this.saveButtonTarget.disabled = false
    }
  }

  // The wizard still uses case-settings:updated for its existing navigation handoff.
  keepDrawerOpen() {
    if (this.hasPaneOutlet) this.paneOutlet.keepOpenAcrossNavigation({ tab: this.tab })
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
    this.capability.case
      .runEvaluation(this.capability.navigation.currentCaseNo(), this.settings.tryNo)
      .then(() => {
        coreFlash.show("notice", "Evaluation queued successfully.")
        window.location.assign(this.capability.navigation.rootUrl())
      })
      .catch(() => {
        coreFlash.show("error", "Unable to queue evaluation.")
      })
      .finally(() => {
        this.runEvaluationTarget.disabled = false
        this.runEvaluationTarget.textContent = "Rerun My Searches Now in the Background!"
      })
  }

  showTryDetails(item) {
    if (!this.hasTryModalTarget) return
    this.tryTitleTarget.textContent = item.name || "Try details"
    this.tryQueryParamsTarget.textContent = item.queryParams || ""
    this.tryEndpointLinkTarget.textContent = item.endpointName || ""
    setLinkHref(
      this.tryEndpointLinkTarget,
      item.searchEndpointId && `search_endpoints/${item.searchEndpointId}`
    )
    this.tryBrowseLinkTarget.hidden = !item.searchUrl
    setLinkHref(this.tryBrowseLinkTarget, item.searchUrl)
    this.tryFieldSpecTarget.textContent = item.fieldSpec || ""
    this.tryVariablesTarget.replaceChildren(
      ...(item.curatorVars || []).map((variable) => {
        const row = document.createElement("div")
        row.className = "row"
        const name = document.createElement("div")
        name.className = "col-sm-3 text-end"
        name.textContent = `##${variable.name}##`
        const value = document.createElement("div")
        value.className = "col-sm-9"
        value.textContent = variable.value
        row.append(name, value)
        return row
      })
    )
    this.tryNameInputTarget.value = item.name || ""
    this.tryRenameFormTarget.hidden = true
    this.tryRenameActionTarget.textContent = "Rename"
    this.tryDeleteTarget.disabled =
      this.capability.settings.tries().filter((tryItem) => !tryItem.deleted).length <= 1
    this.activeTry = item
    window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.show()
  }

  toggleRename() {
    if (!this.activeTry) return
    this.tryRenameFormTarget.hidden = !this.tryRenameFormTarget.hidden
    this.tryRenameActionTarget.textContent = this.tryRenameFormTarget.hidden
      ? "Rename"
      : "Cancel Rename"
    if (!this.tryRenameFormTarget.hidden) this.tryNameInputTarget.focus()
  }

  duplicateTry() {
    if (!this.activeTry) return
    this.capability.settings
      .duplicateTry(this.activeTry.tryNo)
      ?.then((newTry) => {
        coreFlash.show(
          "notice",
          `Try ${this.activeTry.name} duplicated successfully as ${newTry.name}.`
        )
        this.reloadSettings()
        window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      })
      .catch(() => this.showError("Unable to duplicate try."))
  }

  renameTry() {
    const name = this.tryNameInputTarget.value.trim()
    if (!name || !this.activeTry) return
    // As in the Angular modal, a successful rename stays in the modal and returns to the read-only title.
    this.capability.settings
      .renameTry(this.activeTry.tryNo, name)
      .then(() => {
        this.tryTitleTarget.textContent = name
        this.tryRenameFormTarget.hidden = true
        this.tryRenameActionTarget.textContent = "Rename"
        this.reloadSettings()
        this.activeTry =
          this.capability.settings
            .tries()
            .find((item) => isSameId(item.tryNo, this.activeTry.tryNo)) || this.activeTry
      })
      .catch(() => this.showError("Unable to rename try."))
  }

  deleteTry() {
    if (!this.activeTry) return
    const activeTryNo = this.settings.tryNo
    if (this.activeTry.tryNo === activeTryNo) {
      window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      return this.showError(
        `You can not delete the currently active try (${this.activeTry.name})! Please select another try first.`
      )
    }
    const numberOfTries = this.capability.settings.tries().filter((item) => !item.deleted).length
    if (numberOfTries <= 1) return
    if (
      !window.confirm(
        `Are you sure you want to delete ${this.activeTry.name}? This cannot be undone.`
      )
    )
      return
    this.capability.settings
      .deleteTry(this.activeTry.tryNo)
      .then(() => {
        coreFlash.show("notice", "Successfully deleted try!")
        this.reloadSettings()
        window.bootstrap?.Modal.getOrCreateInstance(this.tryModalTarget)?.hide()
      })
      .catch(() => this.showError("Unable to delete try."))
  }

  reloadSettings() {
    this.settings = this.capability.settings.editable()
    this.refresh()
  }

  showError(message) {
    coreFlash.show("error", message)
  }
}

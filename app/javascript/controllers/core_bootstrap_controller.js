import { Controller } from "@hotwired/stimulus"
import { getBootstrapCapabilities } from "utils/core_angular_adapter"
import { diffStateStore } from "stores/diff_state_store"
import { initializeLiveQueryRuntime } from "utils/live_query_runtime_initializer"

export default class extends Controller {
  static values = {
    caseNo: Number,
    tryNo: Number,
    communalScorersOnly: String,
    queryListSortable: String
  }

  connect() {
    if (this.started) return
    this.started = true
    this.bootstrap()
  }

  async bootstrap() {
    try {
      this.services = await getBootstrapCapabilities()

      if (this.services.$rootScope && window.quepidSearch.splainerSearch?.searchSvc) {
        initializeLiveQueryRuntime(this.services)
      }

      const { configurationSvc, userSvc, caseSvc, settingsSvc, caseTryNavSvc,
        docCache, scorerSvc } = this.services
      // The case runtime bundle publishes the shared store on window. The
      // imported store is only a fallback for isolated/unit-test contexts;
      // separate bundles must never reset different diff-store instances.
      const comparisonStore = window.quepidStore?.diff || diffStateStore
      const caseNo = this.caseNoValue || 0
      let tryNo = Number.isFinite(this.tryNoValue) ? this.tryNoValue : Number.NaN

      configurationSvc.setCommunalScorersOnly(this.communalScorersOnlyValue)
      configurationSvc.setQueryListSortable(this.queryListSortableValue)
      configurationSvc.setCaseNo(caseNo)
      configurationSvc.setTryNo(Number.isNaN(tryNo) ? null : tryNo)
      await userSvc.getCurrentUser()
      const initialCaseNo = caseTryNavSvc.getCaseNo()

      const caseChanged = () => initialCaseNo !== caseNo
      const getSearchEngine = selectedTryNo => {
        const settings = settingsSvc.editableSettings()
        const aTry = settings?.getTry?.(selectedTryNo)
        return aTry?.searchUrl || null
      }
      const searchEngineChanged = () => getSearchEngine(caseTryNavSvc.getTryNo()) !== getSearchEngine(tryNo)

      if (caseChanged()) window.quepidSearch.queryCapabilities.resetQueryState()

      caseTryNavSvc.navigationCompleted({ caseNo, tryNo })

      if (caseNo === 0) {
        window.quepidDom?.flash?.show("error", "You don't have any Cases created in Quepid. Click 'Create a Case' from the Relevancy Cases dropdown to get started.")
        return this.fail(new Error("No case selected"))
      }

      window.quepidSearch.queryCapabilities.resetSearchPromise()
      await caseSvc.get(caseNo).then(async acase => {
        if (acase === undefined) throw new Error(`Could not retrieve case ${caseNo}. Confirm that the case has been shared with you via a team you are a member of!`)

        caseSvc.selectTheCase(acase)
        settingsSvc.setCaseTries(acase.tries)
        if (Number.isNaN(tryNo)) tryNo = acase.lastTry
        settingsSvc.setCurrentTry(tryNo)

        if (!settingsSvc.isTrySelected()) throw new Error(`try number ${tryNo} not existing`)
        if (settingsSvc.editableSettings().proxyRequests !== true && caseTryNavSvc.needToRedirectQuepidProtocol(settingsSvc.editableSettings().searchUrl)) {
          const settings = settingsSvc.editableSettings()
          const message = `You have specified a search engine url that is on a different protocol ( <code>${caseTryNavSvc.getQuepidProtocol()}</code> ) than Quepid is running on. Please either <a href="${caseTryNavSvc.createSearchEndpointLink(settings.searchEndpointId)}/edit" target="_self">swap to the proxied connection</a>, or make sure search endpoint is on the same HTTP protocol.`
          throw new Error(`Blocked Request: mixed-content. ${message}`)
        }

        const newSettings = settingsSvc.editableSettings()
        if (caseChanged() || searchEngineChanged()) {
          if (caseChanged()) {
            comparisonStore.reset()
            docCache.empty()
            scorerSvc.bootstrap(caseNo)
          }
          comparisonStore.disable()
          docCache.invalidate()
        }

        await docCache.update(newSettings)
        await window.quepidSearch.queryCapabilities.changeSettings(caseNo, newSettings)
        window.quepidDom?.flash?.hide()
        window.quepidDom?.flash?.hide("search-error")
        caseSvc.trackLastViewedAt(caseNo)
        caseSvc.fetchDropdownCases()
        this.ready({ caseNo, tryNo })

        window.quepidSearch.queryCommands.searchAll().then(
          () => window.quepidDom?.flash?.show("success", "All queries finished successfully!"),
          error => {
            window.quepidDom?.flash?.show("error", "Some queries failed to resolve!")
            window.quepidDom?.flash?.show("error", error, "search-error")
          }
        )
      })
    } catch (error) {
      this.handleBootstrapError(error)
      this.fail(error)
    }
  }

  handleBootstrapError(error) {
    const message = error?.message || String(error)
    if (message.startsWith("Blocked Request")) {
      window.quepidDom?.flash?.show("error", message, "search-error", { html: true })
    } else if (message.startsWith("Could not retrieve case")) {
      window.quepidDom?.flash?.show("error", message, "search-error")
    } else if (message.startsWith("try number")) {
      window.quepidDom?.flash?.show("error", `Could not load case ${this.caseNoValue} due to ${message}`, "search-error")
    } else if (message !== "No case selected") {
      window.quepidDom?.flash?.show("error", `Could not load the case ${this.caseNoValue} due to: ${message}`, "search-error")
    }
  }

  ready(detail) {
    window.quepidCoreBootstrap = { ready: true, ...detail }
    document.dispatchEvent(new CustomEvent("core-bootstrap:ready", { detail }))
  }

  fail(error) {
    document.dispatchEvent(new CustomEvent("core-bootstrap:failed", { detail: { error } }))
  }
}

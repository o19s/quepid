import { Controller } from "@hotwired/stimulus"
import { getBootstrapCapabilities } from "utils/core_capabilities_runtime"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import coreFlash from "utils/core_flash"

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
      const stores = getCoreStores()
      const runtime = getCoreCapabilities()
      this.capabilities = await getBootstrapCapabilities()

      if (this.capabilities.liveQuery?.create && runtime.splainerSearch?.searchSvc) {
        this.capabilities.liveQuery.create({ search: runtime, store: stores })
      }

      const { configuration, user, case: caseCapability, settings, navigation, scoring } = this.capabilities.core
      const { docCache } = this.capabilities
      const comparisonStore = stores.diff
      const caseNo = this.caseNoValue || 0
      let tryNo = Number.isFinite(this.tryNoValue) ? this.tryNoValue : Number.NaN

      configuration.setCommunalScorersOnly(this.communalScorersOnlyValue)
      configuration.setQueryListSortable(this.queryListSortableValue)
      configuration.setCaseNo(caseNo)
      configuration.setTryNo(Number.isNaN(tryNo) ? null : tryNo)
      await user.loadCurrent()
      const initialCaseNo = navigation.currentCaseNo()

      const caseChanged = () => initialCaseNo !== caseNo
      const getSearchEngine = selectedTryNo => {
        const currentSettings = settings.editable()
        const aTry = currentSettings?.getTry?.(selectedTryNo)
        return aTry?.searchUrl || null
      }
      const searchEngineChanged = () => getSearchEngine(navigation.currentTryNo()) !== getSearchEngine(tryNo)

      if (caseChanged()) runtime.queryCapabilities.resetQueryState()

      navigation.complete({ caseNo, tryNo })

      if (caseNo === 0) {
        coreFlash.show("error", "You don't have any Cases created in Quepid. Click 'Create a Case' from the Relevancy Cases dropdown to get started.")
        return this.fail(new Error("No case selected"))
      }

      runtime.queryCapabilities.resetSearchPromise()
      await caseCapability.load(caseNo).then(async acase => {
        if (acase === undefined) throw new Error(`Could not retrieve case ${caseNo}. Confirm that the case has been shared with you via a team you are a member of!`)

        caseCapability.select(acase)
        settings.setCaseTries(acase.tries)
        if (Number.isNaN(tryNo)) tryNo = acase.lastTry
        settings.setCurrentTry(tryNo)

        if (!settings.isTrySelected()) throw new Error(`try number ${tryNo} not existing`)
        if (settings.editable().proxyRequests !== true && navigation.needToRedirectQuepidProtocol(settings.editable().searchUrl)) {
          const currentSettings = settings.editable()
          const message = `You have specified a search engine url that is on a different protocol ( <code>${navigation.getQuepidProtocol()}</code> ) than Quepid is running on. Please either <a href="${navigation.createSearchEndpointLink(currentSettings.searchEndpointId)}/edit" target="_self">swap to the proxied connection</a>, or make sure search endpoint is on the same HTTP protocol.`
          throw new Error(`Blocked Request: mixed-content. ${message}`)
        }

        const newSettings = settings.editable()
        if (caseChanged() || searchEngineChanged()) {
          if (caseChanged()) {
            comparisonStore.reset()
            docCache.empty()
            scoring.bootstrap(caseNo)
          }
          comparisonStore.disable()
          docCache.invalidate()
        }

        await docCache.update(newSettings)
      await runtime.queryCapabilities.changeSettings(caseNo, newSettings)
        coreFlash.hide()
        coreFlash.hide("search-error")
        caseCapability.trackLastViewedAt(caseNo)
        this.ready({ caseNo, tryNo })

        runtime.queryCommands.searchAll().then(
          () => coreFlash.show("success", "All queries finished successfully!"),
          error => {
            coreFlash.show("error", "Some queries failed to resolve!")
            coreFlash.show("error", error, "search-error")
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
        coreFlash.show("error", message, "search-error", { html: true })
    } else if (message.startsWith("Could not retrieve case")) {
        coreFlash.show("error", message, "search-error")
    } else if (message.startsWith("try number")) {
        coreFlash.show("error", `Could not load case ${this.caseNoValue} due to ${message}`, "search-error")
    } else if (message !== "No case selected") {
        coreFlash.show("error", `Could not load the case ${this.caseNoValue} due to: ${message}`, "search-error")
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

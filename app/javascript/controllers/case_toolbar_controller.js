import { Controller } from "@hotwired/stimulus"

/**
 * Bridges the server-rendered case header to the client-side case runtime.
 *
 * Rename is a Rails round trip now (Core::CaseHeaderController re-renders the `case_header` Turbo
 * Frame), so the client runtime needs an explicit refresh: the Tune Relevance drawer
 * reads the try name from the settings runtime.
 *
 * It also handles the other direction: the new-case wizard can rename through the case runtime,
 * and the server-rendered header must be refreshed.
 *
 * Mounted on the always-present `#case-actions` wrapper rather than the `ng-if` gated toolbar
 * inside it, so a rename is never missed for want of a listener.
 *
 * Note what this deliberately does NOT do: copy the case name onto the toolbar's modal triggers.
 * Those read it live from the header via `utils/case_header`, so there are no duplicates to keep
 * in step and nothing to repair when the toolbar is rebuilt.
 */
const HEADER_FRAME_ID = "case_header"
const HEADER_META_SELECTOR = "[data-case-header-case-no]"
const CASE_NAME_SELECTOR = '[data-case-rename-target="caseDisplay"]'

export default class extends Controller {
  static targets = ["actions"]
  static values = { headerUrl: String }

  connect() {
    if (window.quepidCoreBootstrap?.ready) this.showActions()
  }

  handleBootstrapReady() { this.showActions() }

  showActions() {
    if (this.hasActionsTarget) this.actionsTarget.hidden = false
  }

  toggleTuneRelevance(event) {
    event?.preventDefault()
    document.dispatchEvent(new CustomEvent("toggleEast"))
  }

  /**
   * The general "something the header renders has changed" signal, for any surface that mutates
   * case state the server renders (nightly, public, archived...). Prefer dispatching this over
   * adding another bespoke listener here - see the contract in core/_case_header.html.erb.
   */
  handleHeaderStale() {
    this.refetchHeader()
  }

  /**
   * The header renders the case's scorer name, so a scorer chosen in the pick-scorer modal has to
   * reach it. Nothing else would: the modal saves over the API and triggers a
   * rescore, while the header is server-rendered now.
   */
  handleScorerSelected() {
    this.refetchHeader()
  }

  /**
   * A rename originating in the case runtime (the wizard) has to reach the server-rendered header.
   *
   * The name is patched synchronously first because the refetch below is a network round trip,
   * and under load it loses the race with whatever reads the header next - which is how the
   * wizard E2E spec failed. The refetch then reconciles the rest of the header (try name, scorer,
   * badges), which the wizard can also have changed.
   */
  handleCaseRenamed(event) {
    const caseName = event?.detail?.caseName

    if (caseName !== undefined) this.applyHeaderName(caseName)

    this.refetchHeader()
  }

  /** Re-fetches the header frame from the server so it picks up whatever changed. */
  refetchHeader() {
    if (!this.hasHeaderUrlValue || !this.headerUrlValue) return

    const frame = document.getElementById(HEADER_FRAME_ID)

    if (!frame) return

    frame.src = this.headerUrlValue
  }

  applyHeaderName(caseName) {
    const meta = document.querySelector(`#${HEADER_FRAME_ID} ${HEADER_META_SELECTOR}`)

    if (!meta) return

    meta.dataset.caseHeaderCaseName = caseName

    const display = meta.querySelector(CASE_NAME_SELECTOR)

    if (display) display.textContent = caseName
  }

}

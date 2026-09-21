import { Controller } from "@hotwired/stimulus"

/**
 * Bridges the server-rendered case header back to the Angular services that still run this page.
 *
 * Rename is a Rails round trip now (Core::CaseHeaderController re-renders the `case_header` Turbo
 * Frame), so caseSvc and settingsSvc never see the request and would hold a stale name: the
 * recent-cases dropdown refreshes off caseSvc's `caseRenamed`, and the Tune Relevance drawer
 * reads the try name off settingsSvc. Angular got both for free from the digest.
 *
 * It also handles the other direction: the new-case wizard still renames through
 * caseSvc.renameCase, and nothing would update the server-rendered header.
 *
 * Mounted on the always-present `#case-actions` wrapper rather than the `ng-if` gated toolbar
 * inside it, so a rename is never missed for want of a listener.
 *
 * Note what this deliberately does NOT do: copy the case name onto the toolbar's modal triggers.
 * Those read it live from the header via `utils/case_header`, so there are no duplicates to keep
 * in step and nothing to repair when Angular rebuilds the toolbar.
 */
const HEADER_FRAME_ID = "case_header"
const HEADER_META_SELECTOR = "[data-case-header-case-no]"
const CASE_NAME_SELECTOR = '[data-case-rename-target="caseDisplay"]'

export default class extends Controller {
  static values = { headerUrl: String }

  connect() {
    this.onFrameRender = this.handleFrameRender.bind(this)
    this.onAngularRename = this.handleAngularRename.bind(this)
    this.onScorerSelected = this.handleScorerSelected.bind(this)
    this.onHeaderStale = this.handleHeaderStale.bind(this)
    document.addEventListener("turbo:frame-render", this.onFrameRender)
    document.addEventListener("quepid:case-renamed", this.onAngularRename)
    document.addEventListener("pick-scorer:selected", this.onScorerSelected)
    document.addEventListener("quepid:case-header-stale", this.onHeaderStale)
  }

  disconnect() {
    document.removeEventListener("turbo:frame-render", this.onFrameRender)
    document.removeEventListener("quepid:case-renamed", this.onAngularRename)
    document.removeEventListener("pick-scorer:selected", this.onScorerSelected)
    document.removeEventListener("quepid:case-header-stale", this.onHeaderStale)
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
   * reach it. Nothing else would: the modal saves over the API and bridges to Angular for the
   * rescore, which used to be enough when the header was an Angular template reading the same
   * model, but the header is server-rendered now.
   */
  handleScorerSelected() {
    this.refetchHeader()
  }

  handleFrameRender(event) {
    const frame = event.target

    if (!frame || frame.id !== HEADER_FRAME_ID) return

    const meta = frame.querySelector(HEADER_META_SELECTOR)

    if (!meta) return

    const { caseHeaderCaseNo, caseHeaderCaseName, caseHeaderTryNo, caseHeaderTryName } =
      meta.dataset

    this.notifyCaseRenamed(caseHeaderCaseNo, caseHeaderCaseName)
    this.notifyTryRenamed(caseHeaderTryNo, caseHeaderTryName)
  }

  /**
   * A rename that originated in Angular (the wizard) has to reach the server-rendered header.
   *
   * The name is patched synchronously first because the refetch below is a network round trip,
   * and under load it loses the race with whatever reads the header next - which is how the
   * wizard E2E spec failed. The refetch then reconciles the rest of the header (try name, scorer,
   * badges), which the wizard can also have changed.
   */
  handleAngularRename(event) {
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

  // caseSvc listens on `document`, the same bridge pattern the other core Stimulus modals use.
  notifyCaseRenamed(caseNo, caseName) {
    if (!caseNo || caseName === undefined) return

    document.dispatchEvent(
      new CustomEvent("case-header:renamed", {
        detail: { caseNo: Number(caseNo), caseName }
      })
    )
  }

  // settingsSvc holds the TryFactory the Tune Relevance drawer reads its name from. It ignores a
  // name that has not changed, which matters because this fires on any header re-render.
  notifyTryRenamed(tryNo, name) {
    if (!tryNo || name === undefined) return

    document.dispatchEvent(
      new CustomEvent("case-header:try-renamed", {
        detail: { tryNo: Number(tryNo), name }
      })
    )
  }
}

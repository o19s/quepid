import { CORE_EVENTS } from "utils/core_events"
import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { putJson } from "api/json"
import { apiFetch } from "api/fetch"
import { serverMessage } from "utils/error_message"
import { getQuepidRootUrl } from "utils/quepid_root"

/**
 * Pick-scorer modal for the core case toolbar. Lists communal (+ custom, when
 * allowed) Rails-rendered scorer rows, saves via
 * `PUT api/cases/:id/scorers/:scorerId`, then dispatches
 * `pick-scorer:selected` so the live-query scorer can rescore
 * live queries until the live-query-state migration owns that path.
 *
 * When the case's current scorer is missing from the accessible lists, it
 * stays selected and the warning banner shows.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "item",
    "title",
    "alert",
    "warning",
    "warningName",
    "communalList",
    "customSection",
    "customList",
    "customEmpty",
    "createButton",
    "submitButton"
  ]

  static values = {
    scorersUrl: String,
    caseScorerUrlTemplate: String,
    communalScorersOnly: Boolean
  }

  openFor(btn) {
    const caseId = this.triggerValue(btn, "id")
    const currentScorerId = this.triggerValue(btn, "currentScorerId")
    const currentScorerName = this.triggerValue(btn, "currentScorerName")

    this.currentCaseId = caseId || ""
    this.selectedScorer = null
    this._isSubmitting = false
    // Ignore non-numeric ids such as the legacy "default" scorer id.
    const parsedScorerId = currentScorerId ? Number(currentScorerId) : NaN
    this.initialScorerId = Number.isFinite(parsedScorerId) ? parsedScorerId : null
    this.initialScorerName = currentScorerName || ""
    this.userScorers = []
    this.communalScorers = []

    this.clearAlert()
    this._refreshCreateVisibility()
    return this._loadScorers()
  }

  selectScorer(event) {
    const scorerId = Number(event.params.scorerId)
    const pool = this.userScorers.concat(this.communalScorers)
    this.selectedScorer = pool.find((s) => Number(s.scorer_id) === scorerId) || null
    this._refreshListActive()
    this._refreshWarning()
    // Picking a real scorer must re-enable submit even when the modal opened
    // with an inaccessible placeholder selected (which leaves submit
    // disabled) or nothing selected at all — but must NOT clobber a submit
    // that's still in flight, so this only recomputes from _isSubmitting
    // rather than assuming "not submitting".
    this._refreshSubmitEnabled()
  }

  gotoScorers(event) {
    event?.preventDefault?.()
    this.hide()
    window.location.href = `${getQuepidRootUrl()}/scorers`
  }

  async submit(event) {
    event?.preventDefault?.()
    if (!this.selectedScorer || !this.currentCaseId || this.selectedScorer.inaccessible) return

    this.setSubmitting(true)
    this.clearAlert()

    const scorerId = this.selectedScorer.scorer_id
    const caseId = this.currentCaseId

    try {
      const url = this.caseScorerUrlTemplateValue
        .replaceAll("__CASE_ID__", caseId)
        .replaceAll("__SCORER_ID__", String(scorerId))
      await putJson(url, {})

      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.PICK_SCORER_SELECTED, {
          detail: { caseId: Number(caseId), scorer: this.selectedScorer }
        })
      )

      this.hide()
    } catch (error) {
      console.error("pick-scorer-core: save failed", error)
      const message = serverMessage(error, "Unable to save scorer.")
      this.showAlert(message, "danger")
      this.setSubmitting(false)
    }
  }

  async _loadScorers() {
    if (this.hasCommunalListTarget) this.communalListTarget.replaceChildren()
    if (this.hasCustomListTarget) this.customListTarget.replaceChildren()

    try {
      const response = await apiFetch(this.scorersUrlValue, { headers: { Accept: "text/html" } })
      if (!response.ok || response.redirected) throw new Error("Unable to load scorers")
      const html = new DOMParser().parseFromString(await response.text(), "text/html")
      const catalog = html.querySelector("[data-scorer-catalog]")
      if (!catalog) throw new Error("Missing scorer catalog")
      this._renderLists(catalog)

      // Keep the case's current scorer selected even when it is missing from
      // the accessible lists — that is what the inaccessible-scorer warning
      // is for.
      const pool = this.communalScorers.concat(this.userScorers)
      const initial = pool.find((s) => Number(s.scorer_id) === this.initialScorerId) || null
      if (initial) {
        this.selectedScorer = initial
      } else if (this.initialScorerId != null) {
        // Placeholder only — has no code/scale, so it must never be submitted
        // as-is (see #inaccessible guards in setSubmitting/submit). The user
        // has to explicitly pick an accessible scorer to proceed.
        this.selectedScorer = {
          scorer_id: this.initialScorerId,
          name: this.initialScorerName || `Scorer #${this.initialScorerId}`,
          inaccessible: true
        }
      } else {
        this.selectedScorer = null
      }
      this._refreshListActive()
      this._refreshWarning()
      this.setSubmitting(false)
    } catch (error) {
      console.error("pick-scorer-core: load scorers failed", error)
      this.showAlert("Unable to load scorers. Please try again.", "danger")
    }
  }

  _renderLists(catalog) {
    const communal = [...catalog.querySelector('[data-catalog-list="communal"]').children]
    const custom = [...catalog.querySelector('[data-catalog-list="custom"]').children]
    // Scorer data stays available to the immediate browser rescoring event.
    this.communalScorers = communal.map((row) => JSON.parse(row.dataset.scorerJson))
    custom.sort((a, b) => a.textContent.toLowerCase().localeCompare(b.textContent.toLowerCase()))
    this.userScorers = custom.map((row) => JSON.parse(row.dataset.scorerJson))
    if (this.hasCommunalListTarget) this.communalListTarget.replaceChildren(...communal)
    const showCustom = !this.communalScorersOnlyValue
    this.toggleVisible("customSection", showCustom)
    if (this.hasCustomListTarget) {
      this.toggleVisible("customList", showCustom)
      this.customListTarget.replaceChildren(...(showCustom ? custom : []))
    }
    this.toggleVisible("customEmpty", showCustom && custom.length === 0)
  }

  _refreshListActive() {
    const selectedId = this.selectedScorer ? Number(this.selectedScorer.scorer_id) : null
    const items = this.itemTargets
    items.forEach((li) => {
      const id = Number(li.dataset.pickScorerCoreScorerIdParam)
      li.classList.toggle("active", selectedId != null && id === selectedId)
    })
  }

  _refreshWarning() {
    if (!this.hasWarningTarget) return

    // Warning tracks the *case's* current scorer (initialScorerId), not the
    // in-modal selection.
    const accessible = this._initialScorerAccessible()
    this.toggleVisible("warning", !accessible)
    if (this.hasWarningNameTarget) {
      const name =
        this.initialScorerName ||
        (this.selectedScorer && Number(this.selectedScorer.scorer_id) === this.initialScorerId
          ? this.selectedScorer.name
          : "") ||
        (this.initialScorerId != null ? `Scorer #${this.initialScorerId}` : "")
      this.warningNameTarget.textContent = name
    }
  }

  _initialScorerAccessible() {
    if (this.initialScorerId == null) return true
    return this.userScorers
      .concat(this.communalScorers)
      .some((s) => Number(s.scorer_id) === this.initialScorerId)
  }

  _refreshCreateVisibility() {
    this.toggleVisible("createButton", !this.communalScorersOnlyValue)
  }

  setSubmitting(isSubmitting) {
    this._isSubmitting = isSubmitting
    this._refreshSubmitEnabled()
  }

  _refreshSubmitEnabled() {
    this.setButtonsDisabled(
      this._isSubmitting || !this.selectedScorer || this.selectedScorer.inaccessible,
      ["submitButton"]
    )
  }
}

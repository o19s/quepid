import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { getJson, putJson } from "api/json"
import { HttpError } from "api/http_error"
import { getQuepidRootUrl } from "utils/quepid_root"

/**
 * Pick-scorer modal for the core case toolbar. Lists communal (+ custom, when
 * allowed) scorers from `api/scorers`, saves via
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
    const caseId = btn?.dataset?.pickScorerCoreIdValue
    const currentScorerId = btn?.dataset?.pickScorerCoreCurrentScorerIdValue
    const currentScorerName = btn?.dataset?.pickScorerCoreCurrentScorerNameValue

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
        new CustomEvent("pick-scorer:selected", {
          detail: { caseId: Number(caseId), scorer: this.selectedScorer }
        })
      )

      this.hide()
    } catch (error) {
      console.error("pick-scorer-core: save failed", error)
      const message = error instanceof HttpError
        ? error.data?.error || error.data?.message || "Unable to save scorer."
        : error.message || "Unable to save scorer."
      this.showAlert(message, "danger")
      this.setSubmitting(false)
    }
  }

  async _loadScorers() {
    if (this.hasCommunalListTarget) this.communalListTarget.innerHTML = ""
    if (this.hasCustomListTarget) this.customListTarget.innerHTML = ""

    try {
      const data = await getJson(this.scorersUrlValue)

      this.userScorers = Array.isArray(data.user_scorers) ? data.user_scorers : []
      this.communalScorers = Array.isArray(data.communal_scorers) ? data.communal_scorers : []

      this.userScorers.sort((a, b) =>
        String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase())
      )

      this._renderLists()

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

  _renderLists() {
    if (this.hasCommunalListTarget) {
      this.communalListTarget.innerHTML = ""
      this.communalScorers.forEach((scorer) => {
        this.communalListTarget.appendChild(this._listItem(scorer))
      })
    }

    const showCustom = !this.communalScorersOnlyValue
    this.toggleVisible("customSection", showCustom)
    if (this.hasCustomListTarget) {
      this.toggleVisible("customList", showCustom)
      this.customListTarget.innerHTML = ""
      if (showCustom) {
        this.userScorers.forEach((scorer) => {
          this.customListTarget.appendChild(this._listItem(scorer))
        })
      }
    }
    if (this.hasCustomEmptyTarget) {
      this.customEmptyTarget.classList.toggle(
        "d-none",
        !showCustom || this.userScorers.length > 0
      )
    }
  }

  _listItem(scorer) {
    const li = document.createElement("li")
    li.className = "list-group-item"
    li.textContent = scorer.name
    li.dataset.pickScorerCoreTarget = "item"
    li.dataset.pickScorerCoreScorerIdParam = String(scorer.scorer_id)
    li.dataset.action = "click->pick-scorer-core#selectScorer"
    return li
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

import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal, hideBsModal } from "utils/bs_modal"
import { getQuepidRootUrl } from "utils/quepid_root"
import { showStatusMessage } from "utils/status_message"

/**
 * Pick-scorer modal for the core case toolbar — mirrors AngularJS
 * `views/pick_scorer.html` / `ScorerCtrl`. Lists communal (+ custom, when
 * allowed) scorers from `api/scorers`, saves via
 * `PUT api/cases/:id/scorers/:scorerId`, then dispatches
 * `pick-scorer:selected` so Angular `scorerSvc` / `queriesSvc` can rescore
 * live queries until the live-query-state migration owns that path.
 *
 * When the case's current scorer is missing from the accessible lists, it
 * stays selected and the warning banner shows (Angular activeScorer parity).
 * Dual-role trigger/modal-root pattern via ModalTriggerControllerBase.
 */
export default class extends ModalTriggerControllerBase {
  static targets = [
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

  get modalElementId() {
    return "pickScorerModal"
  }

  openAsRoot(event) {
    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.pickScorerCoreIdValue
    const currentScorerId = btn?.dataset?.pickScorerCoreCurrentScorerIdValue
    const currentScorerName = btn?.dataset?.pickScorerCoreCurrentScorerNameValue

    this.currentCaseId = caseId || ""
    this.selectedScorer = null
    this._isSubmitting = false
    // Ignore non-numeric ids (e.g. Angular's legacy "default" scorerId).
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
    hideBsModal(getOrCreateBsModal(this.element))
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
      const response = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || data.message || "Unable to save scorer.")
      }

      document.dispatchEvent(
        new CustomEvent("pick-scorer:selected", {
          detail: { caseId: Number(caseId), scorer: this.selectedScorer }
        })
      )

      hideBsModal(getOrCreateBsModal(this.element))
    } catch (error) {
      console.error("pick-scorer-core: save failed", error)
      this.showAlert(error.message || "Unable to save scorer.", "danger")
      this.setSubmitting(false)
    }
  }

  async _loadScorers() {
    if (this.hasCommunalListTarget) this.communalListTarget.innerHTML = ""
    if (this.hasCustomListTarget) this.customListTarget.innerHTML = ""

    try {
      const response = await apiFetch(this.scorersUrlValue, {
        headers: { Accept: "application/json" }
      })
      if (!response.ok) throw new Error(`Failed to load scorers (${response.status})`)

      const data = await response.json()
      this.userScorers = Array.isArray(data.user_scorers) ? data.user_scorers : []
      this.communalScorers = Array.isArray(data.communal_scorers) ? data.communal_scorers : []

      this.userScorers.sort((a, b) =>
        String(a.name || "").toLowerCase().localeCompare(String(b.name || "").toLowerCase())
      )

      this._renderLists()

      // Keep the case's current scorer selected even when it is missing from
      // the accessible lists — that is what the inaccessible-scorer warning
      // is for (Angular ScorerCtrl / activeScorer parity).
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
    if (this.hasCustomSectionTarget) {
      this.customSectionTarget.classList.toggle("d-none", !showCustom)
    }
    if (this.hasCustomListTarget) {
      this.customListTarget.classList.toggle("d-none", !showCustom)
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
    li.dataset.pickScorerCoreScorerIdParam = String(scorer.scorer_id)
    li.dataset.action = "click->pick-scorer-core#selectScorer"
    return li
  }

  _refreshListActive() {
    const selectedId = this.selectedScorer ? Number(this.selectedScorer.scorer_id) : null
    const items = this.element.querySelectorAll(".list-group-item")
    items.forEach((li) => {
      const id = Number(li.dataset.pickScorerCoreScorerIdParam)
      li.classList.toggle("active", selectedId != null && id === selectedId)
    })
  }

  _refreshWarning() {
    if (!this.hasWarningTarget) return

    // Warning tracks the *case's* current scorer (initialScorerId), not the
    // in-modal selection — matches Angular's one-shot scorerAccessible flag.
    const accessible = this._initialScorerAccessible()
    this.warningTarget.classList.toggle("d-none", accessible)
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
    if (this.hasCreateButtonTarget) {
      this.createButtonTarget.classList.toggle("d-none", this.communalScorersOnlyValue)
    }
  }

  setSubmitting(isSubmitting) {
    this._isSubmitting = isSubmitting
    this._refreshSubmitEnabled()
  }

  _refreshSubmitEnabled() {
    if (!this.hasSubmitButtonTarget) return
    this.submitButtonTarget.disabled =
      this._isSubmitting || !this.selectedScorer || this.selectedScorer.inaccessible
  }

  showAlert(message, variant) {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message, className: `alert alert-${variant}` })
  }

  clearAlert() {
    if (!this.hasAlertTarget) return
    showStatusMessage(this.alertTarget, { message: "", className: "alert d-none" })
  }
}

import { Controller } from "@hotwired/stimulus"

/**
 * Inline case-name / try-name rename in the server-rendered case header.
 *
 * Ports the behaviour that `CaseCtrl.caseName` and `CurrSettingsCtrl.tryName` provided on the
 * Angular core page: double-click the name to toggle an edit form, Cancel restores the display,
 * and Rename stays disabled while the field is blank or whitespace.
 *
 * The forms post to Core::CaseHeaderController and re-render the enclosing `case_header` Turbo
 * Frame, so there is nothing to write back into a client-side model on success - the controller
 * is torn down with the old frame content and reconnects against the new markup in its default
 * (display, not editing) state, which matches Angular resetting `startRename` after a rename.
 */
export default class extends Controller {
  static targets = [
    "caseDisplay",
    "caseForm",
    "caseInput",
    "caseSubmit",
    "tryDisplay",
    "tryForm",
    "tryInput",
    "trySubmit"
  ]

  connect() {
    this.syncCaseSubmit()
    this.syncTrySubmit()
  }

  // Angular's `caseNameEditModeToggle` toggled, so a second double-click closes the editor again.
  editCase() {
    if (this.isEditingCase) {
      this.cancelCase()
      return
    }

    this.resetCaseInput()
    this.showCaseForm(true)
    // Focus only, never select: Angular left the caret where the field put it, so selecting
    // would change what the first keystroke does (replace the name rather than extend it).
    this.caseInputTarget.focus()
  }

  cancelCase() {
    this.resetCaseInput()
    this.showCaseForm(false)
  }

  caseInputChanged() {
    this.syncCaseSubmit()
  }

  editTry() {
    if (!this.hasTryFormTarget || !this.hasTryInputTarget) return

    if (this.isEditingTry) {
      this.cancelTry()
      return
    }

    this.resetTryInput()
    this.showTryForm(true)
    this.tryInputTarget.focus()
  }

  cancelTry() {
    this.resetTryInput()
    this.showTryForm(false)
  }

  tryInputChanged() {
    this.syncTrySubmit()
  }

  get isEditingCase() {
    return this.hasCaseFormTarget && !this.caseFormTarget.classList.contains("d-none")
  }

  get isEditingTry() {
    return this.hasTryFormTarget && !this.tryFormTarget.classList.contains("d-none")
  }

  showCaseForm(editing) {
    if (!this.hasCaseFormTarget || !this.hasCaseDisplayTarget) return

    this.caseFormTarget.classList.toggle("d-none", !editing)
    this.caseDisplayTarget.classList.toggle("d-none", editing)
  }

  showTryForm(editing) {
    if (!this.hasTryFormTarget || !this.hasTryDisplayTarget) return

    this.tryFormTarget.classList.toggle("d-none", !editing)
    this.tryDisplayTarget.classList.toggle("d-none", editing)
  }

  // The server already rendered the persisted name into the field, so "reset" means going back
  // to that value rather than to whatever half-typed text the user abandoned.
  resetCaseInput() {
    if (!this.hasCaseInputTarget) return

    this.caseInputTarget.value = this.caseInputTarget.defaultValue
    this.syncCaseSubmit()
  }

  resetTryInput() {
    if (!this.hasTryInputTarget) return

    this.tryInputTarget.value = this.tryInputTarget.defaultValue
    this.syncTrySubmit()
  }

  syncCaseSubmit() {
    if (!this.hasCaseInputTarget || !this.hasCaseSubmitTarget) return

    this.caseSubmitTarget.disabled = this.caseInputTarget.value.trim() === ""
  }

  syncTrySubmit() {
    if (!this.hasTryInputTarget || !this.hasTrySubmitTarget) return

    this.trySubmitTarget.disabled = this.tryInputTarget.value.trim() === ""
  }
}

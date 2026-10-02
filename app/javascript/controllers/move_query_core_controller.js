import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { getJson } from "api/json"
import { moveQuery } from "utils/query_lifecycle"
import coreFlash from "utils/core_flash"

/**
 * Move a query from the core case workspace to another case.
 *
 * The modal and case-list loading are Stimulus-owned. Stimulus owns the PUT;
 * the completion event lets the remaining live query object be reconciled
 * through the query-command bridge without issuing a second request.
 */
export default class extends CoreModalControllerBase {
  static targets = ["title", "loading", "empty", "caseList", "caseListLabel", "submitButton"]

  static values = {
    casesUrl: String
  }

  async openFor(btn) {
    this.queryId = btn?.dataset?.moveQueryCoreQueryIdValue || ""
    this.currentCaseId = btn?.dataset?.moveQueryCoreCaseIdValue || ""
    this.selectedCase = null

    if (this.hasTitleTarget) this.titleTarget.textContent = "Move Query to Another Case"
    this.refreshUi()
    await this.loadCases()
  }

  async loadCases() {
    this.cases = []
    this.setLoading(true)

    try {
      if (!this.hasCasesUrlValue || !this.casesUrlValue) throw new Error("Missing cases URL")

      const data = await getJson(this.casesUrlValue)
      this.cases = (Array.isArray(data.all_cases) ? data.all_cases : []).filter(
        (acase) => String(acase.case_id) !== String(this.currentCaseId)
      )
      this.renderCases()
    } catch (error) {
      console.error("move-query-core: load cases failed", error)
      this.cases = []
      this.renderCases()
      coreFlash.show("error", "Unable to load cases.")
    } finally {
      this.setLoading(false)
    }
  }

  selectCase(event) {
    const caseId = event.params.caseId
    this.selectedCase = this.cases.find((acase) => String(acase.case_id) === String(caseId)) || null
    this.renderCases()
  }

  async submit(event) {
    event.preventDefault()
    if (!this.selectedCase || !this.queryId) return

    if (!this.currentCaseId || !this.queryId) {
      coreFlash.show("error", "Unable to move query.")
      return
    }

    this.submitButtonTarget.disabled = true

    try {
      await moveQuery(this.currentCaseId, this.queryId, this.selectedCase.case_id)
      document.dispatchEvent(new CustomEvent("query-command:move-completed", {
        detail: {
          caseId: Number(this.currentCaseId),
          queryId: Number(this.queryId),
          targetCaseId: Number(this.selectedCase.case_id)
        }
      }))
      coreFlash.show("success", "Query moved successfully!")
      this.hide()
    } catch (error) {
      console.error("move-query-core: move failed", error)
      coreFlash.show("error", "Unable to move query.")
      this.submitButtonTarget.disabled = false
    }
  }

  renderCases() {
    if (!this.hasCaseListTarget) return

    this.caseListTarget.replaceChildren()
    this.cases.forEach((acase) => {
      const item = document.createElement("button")
      item.type = "button"
      item.className = "list-group-item list-group-item-action"
      item.dataset.moveQueryCoreCaseIdParam = String(acase.case_id)
      item.textContent = acase.case_name
      item.classList.toggle("active", this.selectedCase?.case_id === acase.case_id)
      item.dataset.action = "click->move-query-core#selectCase"
      this.caseListTarget.appendChild(item)
    })

    this.refreshUi()
  }

  setLoading(loading) {
    this.loading = loading
    super.setLoading(loading)
    this.toggleVisible("caseList", !loading)
    if (this.hasEmptyTarget) this.emptyTarget.classList.add("d-none")
    if (!loading && this.cases.length === 0 && this.hasEmptyTarget) {
      this.emptyTarget.classList.remove("d-none")
    }
    this.toggleVisible("caseListLabel", !loading && this.cases.length > 0)
    this.refreshUi()
  }

  refreshUi() {
    if (!this.hasSubmitButtonTarget) return

    this.submitButtonTarget.disabled = this.loading || !this.selectedCase
    this.submitButtonTarget.hidden = !this.selectedCase
    this.submitButtonTarget.textContent = this.selectedCase
      ? `Move to ${this.selectedCase.case_name}`
      : "Move"
  }
}

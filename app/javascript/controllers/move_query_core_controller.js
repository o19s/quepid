import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { getJson } from "api/json"
import { moveQuery } from "utils/query_lifecycle"
import coreFlash from "utils/core_flash"
import { isSameId } from "utils/record_identity"

/**
 * Move a query from the core case workspace to another case.
 *
 * The modal and case-list loading are Stimulus-owned. Stimulus owns the PUT;
 * afterwards the query-command bridge outlet reconciles the live query object
 * without a second request, and `queries-list` hears `move-query-core:completed`.
 */
export default class extends CoreModalControllerBase {
  static targets = ["title", "loading", "empty", "caseList", "caseListLabel", "submitButton"]
  static outlets = ["query-command-bridge"]

  static values = {
    casesUrl: String,
    caseId: String
  }

  // Opened from a query row's "Move Query" button; the row carries the query id.
  async openFor(btn) {
    this.openGeneration = (this.openGeneration || 0) + 1
    this.queryId = btn?.closest("[data-query-id]")?.dataset.queryId || ""
    this.currentCaseId = this.caseIdValue
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
        (acase) => !isSameId(acase.case_id, this.currentCaseId)
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
    this.selectedCase = this.cases.find((acase) => isSameId(acase.case_id, caseId)) || null
    this.renderCases()
    // renderCases replaced the clicked button; keep focus on its replacement.
    this.caseListTarget.querySelector(".active")?.focus()
  }

  async submit(event) {
    event.preventDefault()
    if (!this.selectedCase || !this.queryId) return

    if (!this.currentCaseId || !this.queryId) {
      coreFlash.show("error", "Unable to move query.")
      return
    }

    this.submitButtonTarget.disabled = true
    const generation = this.openGeneration
    const detail = {
      caseId: Number(this.currentCaseId),
      queryId: Number(this.queryId),
      targetCaseId: Number(this.selectedCase.case_id)
    }

    try {
      await moveQuery(detail.caseId, detail.queryId, detail.targetCaseId)
    } catch (error) {
      console.error("move-query-core: move failed", error)
      coreFlash.show("error", "Unable to move query.")
      if (generation === this.openGeneration) this.refreshUi()
      return
    }

    this.queryCommandBridgeOutlet.queryRemoved(detail)
    this.dispatch("completed", { detail })
    coreFlash.show("success", "Query moved successfully!")
    if (generation === this.openGeneration) this.hide()
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
      item.classList.toggle("active", isSameId(this.selectedCase?.case_id, acase.case_id))
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

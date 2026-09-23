import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"

/**
 * Move a query from the core case workspace to another case.
 *
 * The modal and case-list loading are Stimulus-owned. Query removal and score
 * refresh still go through the temporary Angular queriesSvc adapter because the
 * live query store has not migrated yet.
 */
export default class extends ModalTriggerControllerBase {
  static targets = ["title", "loading", "empty", "caseList", "submitButton"]

  static values = {
    casesUrl: String
  }

  get modalElementId() {
    return "moveQueryModal"
  }

  async openAsRoot(event) {
    const btn = event.currentTarget || event.target

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

      const response = await apiFetch(this.casesUrlValue, {
        headers: { Accept: "application/json" }
      })
      if (!response.ok) throw new Error(`Failed to load cases (${response.status})`)

      const data = await response.json()
      this.cases = (Array.isArray(data.all_cases) ? data.all_cases : []).filter(
        (acase) => String(acase.case_id) !== String(this.currentCaseId)
      )
      this.renderCases()
    } catch (error) {
      console.error("move-query-core: load cases failed", error)
      this.cases = []
      this.renderCases()
      window.quepidDom?.flash?.show("error", "Unable to load cases.")
    } finally {
      this.setLoading(false)
    }
  }

  selectCase(event) {
    const caseId = event.currentTarget?.dataset?.caseId
    this.selectedCase = this.cases.find((acase) => String(acase.case_id) === String(caseId)) || null
    this.renderCases()
  }

  async submit(event) {
    event.preventDefault()
    if (!this.selectedCase || !this.queryId) return

    const moveQuery = window.quepidSearch?.queryLifecycle?.moveQuery
    if (!moveQuery) {
      window.quepidDom?.flash?.show("error", "Unable to move query.")
      return
    }

    this.submitButtonTarget.disabled = true

    try {
      await moveQuery(this.queryId, this.selectedCase.case_id)
      window.quepidDom?.flash?.show("success", "Query moved successfully!")
      getOrCreateBsModal(this.element)?.hide()
    } catch (error) {
      console.error("move-query-core: move failed", error)
      window.quepidDom?.flash?.show("error", "Unable to move query.")
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
      item.dataset.caseId = acase.case_id
      item.textContent = acase.case_name
      item.classList.toggle("active", this.selectedCase?.case_id === acase.case_id)
      item.addEventListener("click", (event) => this.selectCase(event))
      this.caseListTarget.appendChild(item)
    })

    this.refreshUi()
  }

  setLoading(loading) {
    this.loading = loading
    if (this.hasLoadingTarget) this.loadingTarget.classList.toggle("d-none", !loading)
    if (this.hasCaseListTarget) this.caseListTarget.classList.toggle("d-none", loading)
    if (this.hasEmptyTarget) this.emptyTarget.classList.add("d-none")
    if (!loading && this.cases.length === 0 && this.hasEmptyTarget) {
      this.emptyTarget.classList.remove("d-none")
    }
    this.refreshUi()
  }

  refreshUi() {
    if (!this.hasSubmitButtonTarget) return

    this.submitButtonTarget.disabled = this.loading || !this.selectedCase
    this.submitButtonTarget.textContent = this.selectedCase
      ? `Move to ${this.selectedCase.case_name}`
      : "Move"
  }
}

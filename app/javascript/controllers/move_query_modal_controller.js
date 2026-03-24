import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"

const MOVE_QUERY_EMPTY_HINT = "Please create another case to move this query to first."

// Move query to another case (parity with Angular move-query).
// query-row dispatches "open-move-query" with { queryId }.
export default class extends Controller {
  static targets = ["caseBlock", "caseList", "loading", "empty", "confirmBtn", "confirmLabel"]

  connect() {
    this._onOpen = (e) => void this.open(e.detail)
    document.addEventListener("open-move-query", this._onOpen)
    this.queryId = null
    this.selectedCase = null
  }

  disconnect() {
    document.removeEventListener("open-move-query", this._onOpen)
  }

  async open({ queryId }) {
    this.queryId = queryId
    this.selectedCase = null
    if (this.hasConfirmBtnTarget) {
      this.confirmBtnTarget.disabled = true
    }
    if (this.hasConfirmLabelTarget) {
      this.confirmLabelTarget.textContent = ""
    }

    this.loadingTarget.classList.remove("d-none")
    this.emptyTarget.classList.add("d-none")
    this.emptyTarget.textContent = MOVE_QUERY_EMPTY_HINT
    this.caseBlockTarget.classList.add("d-none")
    this.caseListTarget.innerHTML = ""

    window.bootstrap.Modal.getOrCreateInstance(this.element).show()

    const currentCaseId = parseInt(document.body.dataset.caseId, 10)
    try {
      const response = await fetch(apiUrl("api/cases"), {
        headers: {
          Accept: "application/json",
          "X-CSRF-Token": csrfToken(),
        },
      })
      if (!response.ok) throw new Error(String(response.status))
      const data = await response.json()
      const cases = (data.all_cases || []).filter((c) => c.case_id !== currentCaseId)

      this.loadingTarget.classList.add("d-none")
      if (cases.length === 0) {
        this.emptyTarget.classList.remove("d-none")
        return
      }

      this.caseBlockTarget.classList.remove("d-none")
      for (const ac of cases) {
        const btn = document.createElement("button")
        btn.type = "button"
        btn.className = "list-group-item list-group-item-action"
        btn.textContent = ac.case_name
        btn.addEventListener("click", () => this._selectCase(ac, btn))
        this.caseListTarget.appendChild(btn)
      }
    } catch (error) {
      console.error("Failed to load cases for move query:", error)
      this.loadingTarget.classList.add("d-none")
      this.caseBlockTarget.classList.add("d-none")
      this.emptyTarget.textContent =
        "Could not load cases. Close this dialog and try again, or use the flash message above."
      this.emptyTarget.classList.remove("d-none")
      showFlash("Could not load cases to move this query.", "danger")
    }
  }

  _selectCase(acase, buttonEl) {
    this.selectedCase = acase
    this.caseListTarget.querySelectorAll(".list-group-item").forEach((el) => {
      el.classList.toggle("active", el === buttonEl)
    })
    if (this.hasConfirmBtnTarget) {
      this.confirmBtnTarget.disabled = false
    }
    if (this.hasConfirmLabelTarget) {
      this.confirmLabelTarget.textContent = acase.case_name
    }
  }

  async confirmMove() {
    if (!this.selectedCase || !this.queryId) return

    const fromCaseId = document.body.dataset.caseId
    try {
      const response = await fetch(apiUrl(`api/cases/${fromCaseId}/queries/${this.queryId}`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-CSRF-Token": csrfToken(),
        },
        body: JSON.stringify({ other_case_id: this.selectedCase.case_id }),
      })
      if (!response.ok) {
        showFlash("Unable to move query.", "danger")
        return
      }
      showFlash("Query moved successfully!", "success")
      window.bootstrap.Modal.getInstance(this.element)?.hide()

      const row = document.querySelector(`#query-list-shell [data-query-id="${this.queryId}"]`)
      document.dispatchEvent(
        new CustomEvent("query-moved-away", { detail: { queryId: this.queryId } }),
      )
      row?.remove()
    } catch (error) {
      console.error("Move query failed:", error)
      showFlash("Unable to move query.", "danger")
    }
  }
}

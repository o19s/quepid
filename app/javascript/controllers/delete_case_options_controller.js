import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = [
    "modal",
    "actionButton",
    "description",
    "confirmButton",
    "confirmLabel",
    "errorMessage",
  ]

  open(event) {
    event.preventDefault()
    this.selectedAction = null
    this._clearSelection()
    this._hideError()
    this.confirmButtonTarget.disabled = true
    this.confirmLabelTarget.textContent = "Confirm"

    const modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
    modal.show()
  }

  selectAction(event) {
    event.preventDefault()
    this.selectedAction = event.currentTarget.dataset.optionName

    // Update toggle button styles
    this.actionButtonTargets.forEach((btn) => {
      if (btn.dataset.optionName === this.selectedAction) {
        btn.classList.remove("btn-outline-secondary")
        btn.classList.add("btn-primary")
      } else {
        btn.classList.remove("btn-primary")
        btn.classList.add("btn-outline-secondary")
      }
    })

    // Update description text
    this.descriptionTargets.forEach((desc) => {
      if (desc.dataset.forAction === this.selectedAction) {
        desc.classList.remove("d-none")
      } else {
        desc.classList.add("d-none")
      }
    })

    // Update confirm button
    this.confirmButtonTarget.disabled = false
    switch (this.selectedAction) {
      case "delete_all_queries":
        this.confirmLabelTarget.textContent = "Delete All Queries"
        break
      case "archive_case":
        this.confirmLabelTarget.textContent = "Archive Case"
        break
      case "delete_case":
        this.confirmLabelTarget.textContent = "Delete Case"
        break
    }
  }

  async confirm(event) {
    event.preventDefault()
    if (!this.selectedAction) return

    this._hideError()
    this.confirmButtonTarget.disabled = true

    const caseId = document.body.dataset.caseId
    const token = csrfToken()

    try {
      switch (this.selectedAction) {
        case "delete_all_queries":
          await this._deleteAllQueries(caseId, token)
          break
        case "archive_case":
          await this._archiveCase(caseId, token)
          break
        case "delete_case":
          await this._deleteCase(caseId, token)
          break
      }
    } catch (error) {
      this._showError(error.message)
      this.confirmButtonTarget.disabled = false
    }
  }

  async _deleteAllQueries(caseId, token) {
    const response = await fetch(apiUrl(`api/bulk/cases/${caseId}/queries/delete`), {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": token,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete queries (${response.status})`)
    }

    // Close modal and reload to show empty query list
    window.bootstrap.Modal.getInstance(this.modalTarget)?.hide()
    window.location.reload()
  }

  async _archiveCase(caseId, token) {
    const response = await fetch(apiUrl(`cases/${caseId}/archive`), {
      method: "POST",
      headers: {
        "X-CSRF-Token": token,
        Accept: "text/html",
      },
    })

    if (!response.ok && !response.redirected) {
      throw new Error(`Failed to archive case (${response.status})`)
    }

    // The archive route redirects to /cases — follow it
    window.location.href = response.redirected ? response.url : apiUrl("cases")
  }

  async _deleteCase(caseId, token) {
    const response = await fetch(apiUrl(`api/cases/${caseId}`), {
      method: "DELETE",
      headers: {
        "X-CSRF-Token": token,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to delete case (${response.status})`)
    }

    window.location.href = apiUrl("cases")
  }

  _clearSelection() {
    this.actionButtonTargets.forEach((btn) => {
      btn.classList.remove("btn-primary")
      btn.classList.add("btn-outline-secondary")
    })
    this.descriptionTargets.forEach((desc) => desc.classList.add("d-none"))
  }

  _showError(message) {
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.textContent = message
      this.errorMessageTarget.classList.remove("d-none")
    }
  }

  _hideError() {
    if (this.hasErrorMessageTarget) {
      this.errorMessageTarget.classList.add("d-none")
    }
  }
}

import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"

export default class extends Controller {
  static targets = ["modal", "scorerList", "selectButton", "errorMessage"]
  static values = { caseId: Number }

  open(event) {
    event.preventDefault()
    this._hideError()
    this.selectedScorerId = null
    this.scorerListTarget.innerHTML = `
      <div class="text-center py-3">
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Loading scorers&hellip;
      </div>`
    this.selectButtonTarget.disabled = true

    const modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
    modal.show()

    this._loadScorers()
  }

  pick(event) {
    event.preventDefault()
    const id = event.currentTarget.dataset.scorerId

    this.selectedScorerId = id
    this.scorerListTarget.querySelectorAll(".list-group-item").forEach((item) => {
      if (item.dataset.scorerId === id) {
        item.classList.add("active")
      } else {
        item.classList.remove("active")
      }
    })
    this.selectButtonTarget.disabled = false
  }

  async select(event) {
    event.preventDefault()
    if (!this.selectedScorerId) return

    this.selectButtonTarget.disabled = true
    this._hideError()

    try {
      const response = await fetch(
        apiUrl(`api/cases/${this.caseIdValue}/scorers/${this.selectedScorerId}`),
        {
          method: "PUT",
          headers: {
            "X-CSRF-Token": csrfToken(),
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to update scorer (${response.status})`)
      }

      window.bootstrap.Modal.getInstance(this.modalTarget)?.hide()
      window.location.reload()
    } catch (error) {
      this._showError(error.message)
      this.selectButtonTarget.disabled = false
    }
  }

  async _loadScorers() {
    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/scorers`), {
        headers: { Accept: "application/json" },
      })

      if (!response.ok) throw new Error(`Failed to load scorers (${response.status})`)

      const data = await response.json()
      const currentId = data.default?.scorer_id
      const scorers = []

      // Communal scorers
      if (data.communal_scorers) {
        data.communal_scorers.forEach((s) => scorers.push(s))
      }

      // Also fetch user scorers
      const userResp = await fetch(apiUrl("api/scorers"), {
        headers: { Accept: "application/json" },
      })
      if (userResp.ok) {
        const userData = await userResp.json()
        if (userData.user_scorers) {
          userData.user_scorers.forEach((s) => {
            if (!scorers.find((e) => e.scorer_id === s.scorer_id)) {
              scorers.push(s)
            }
          })
        }
      }

      this._renderScorers(scorers, currentId)
    } catch (error) {
      this.scorerListTarget.innerHTML = `<p class="text-danger">Error loading scorers.</p>`
    }
  }

  _renderScorers(scorers, currentId) {
    if (scorers.length === 0) {
      this.scorerListTarget.innerHTML = `<p>No scorers available.</p>`
      return
    }

    const list = document.createElement("div")
    list.classList.add("list-group")

    scorers.forEach((s) => {
      const item = document.createElement("a")
      item.href = "#"
      item.className = "list-group-item list-group-item-action"
      item.dataset.scorerId = s.scorer_id
      item.dataset.action = "click->select-scorer#pick"
      item.textContent = s.name
      if (s.scorer_id === currentId) item.classList.add("active")
      list.appendChild(item)
    })

    this.scorerListTarget.replaceChildren(list)

    if (currentId) {
      this.selectedScorerId = String(currentId)
      this.selectButtonTarget.disabled = false
    }
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

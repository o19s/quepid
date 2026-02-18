import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

// Unarchive case modal: fetches archived cases, lets user unarchive them.
export default class extends Controller {
  static values = { teams: Array }
  static targets = ["modal", "teamFilter", "caseList", "loading"]

  open() {
    if (!this.hasModalTarget) return
    const modal = window.bootstrap?.Modal?.getOrCreateInstance(this.modalTarget)
    modal?.show()
    this._fetchArchivedCases()
  }

  async filterByTeam() {
    this._renderCases()
  }

  async unarchive(event) {
    const caseId = event.currentTarget.dataset.caseId
    if (!caseId) return

    event.currentTarget.disabled = true
    event.currentTarget.textContent = "Restoring…"

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", caseId)
      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ case: { archived: false } })
      })
      if (!res.ok) throw new Error(`Unarchive failed (${res.status})`)

      // Remove from local list and re-render
      this._archivedCases = this._archivedCases.filter(c => String(c.case_id) !== String(caseId))
      this._renderCases()

      if (window.flash) window.flash.success = "Case unarchived successfully."
    } catch (err) {
      console.error("Unarchive failed:", err)
      event.currentTarget.disabled = false
      event.currentTarget.textContent = "Unarchive"
      if (window.flash) window.flash.error = err.message
    }
  }

  async _fetchArchivedCases() {
    if (this.hasLoadingTarget) this.loadingTarget.classList.remove("d-none")
    if (this.hasCaseListTarget) this.caseListTarget.innerHTML = ""

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases") + "?archived=true"
      const res = await apiFetch(url, {
        headers: { Accept: "application/json" }
      })
      if (!res.ok) throw new Error(`Failed to fetch (${res.status})`)

      const data = await res.json()
      this._archivedCases = data.cases || data.all_cases || []
      this._renderCases()
    } catch (err) {
      console.error("Fetch archived cases failed:", err)
      if (this.hasCaseListTarget) {
        this.caseListTarget.innerHTML = `<p class="text-danger small">${this._escapeHtml(err.message)}</p>`
      }
    } finally {
      if (this.hasLoadingTarget) this.loadingTarget.classList.add("d-none")
    }
  }

  _renderCases() {
    if (!this.hasCaseListTarget || !this._archivedCases) return

    const teamId = this.hasTeamFilterTarget ? this.teamFilterTarget.value : ""
    let cases = this._archivedCases

    if (teamId) {
      cases = cases.filter(c => {
        const teams = c.teams || []
        return teams.some(t => String(t.id || t.team_id) === teamId)
      })
    }

    if (cases.length === 0) {
      this.caseListTarget.innerHTML = '<p class="text-muted small">No archived cases found.</p>'
      return
    }

    const html = cases.map(c => {
      const name = this._escapeHtml(c.case_name || c.caseName || `Case ${c.case_id}`)
      const id = this._escapeHtml(String(c.case_id || c.id))
      return `
        <div class="d-flex justify-content-between align-items-center border-bottom py-2">
          <div>
            <strong>${name}</strong>
            <span class="text-muted small ms-1">#${id}</span>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary"
                  data-action="click->unarchive-case#unarchive"
                  data-case-id="${id}">
            Unarchive
          </button>
        </div>
      `
    }).join("")

    this.caseListTarget.innerHTML = html
  }

  _escapeHtml(str) {
    if (str == null) return ""
    const div = document.createElement("div")
    div.textContent = String(str)
    return div.innerHTML
  }
}

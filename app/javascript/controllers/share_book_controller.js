import { Controller } from "@hotwired/stimulus"
import { parseTeamsJson, populateTeamSelect } from "utils/share_case_teams"

export default class extends Controller {
  connect() {
    this.bookIdInput = document.getElementById('share-book-id')
    this.unshareBookIdInput = document.getElementById('unshare-book-id')
    this.unshareTeamInput = document.getElementById('unshare-book-team')
    this.teamSelect = document.getElementById('share-book-team')
    this.titleEl = document.getElementById('shareBookModalLabel')
    this.sharedListEl = document.getElementById('share-book-shared-list')
    this.submitButton = document.getElementById('share-book-submit')
    this.unshareButton = document.getElementById('unshare-book-submit')
    this.selectedSharedTeamId = null
  }

  open(event) {
    const btn = event.currentTarget || event.target
    const bookId = btn?.dataset?.shareBookIdValue
    const bookName = btn?.dataset?.shareBookNameValue
    const sharedTeamsJson = btn?.dataset?.shareBookSharedTeamsJson
    const allTeamsJson = btn?.dataset?.shareBookAllTeamsJson

    if (this.bookIdInput) this.bookIdInput.value = bookId || ''
    if (this.unshareBookIdInput) this.unshareBookIdInput.value = bookId || ''
    if (this.titleEl) {
      this.titleEl.textContent = bookName ? `Share Book: ${bookName}` : 'Share Book'
    }
    if (this.unshareTeamInput) this.unshareTeamInput.value = ''
    this.selectedSharedTeamId = null
    
    // Rebuild dropdown with unshared teams only
    this.rebuildTeamDropdown(allTeamsJson, sharedTeamsJson)
    
    this.toggleSubmit()
    this.renderSharedTeams(sharedTeamsJson)
  }

  toggleSubmit() {
    if (!this.submitButton || !this.teamSelect) return
    const teamId = this.teamSelect.value
    this.submitButton.disabled = !teamId
  }

  toggleUnshareSubmit() {
    if (!this.unshareButton) return
    this.unshareButton.disabled = !this.selectedSharedTeamId
    if (this.unshareTeamInput) this.unshareTeamInput.value = this.selectedSharedTeamId || ''
  }

  renderSharedTeams(rawJson) {
    if (!this.sharedListEl) return

    const teams = parseTeamsJson(rawJson)

    this.sharedListEl.innerHTML = ''

    if (teams.length === 0) {
      this.sharedListEl.innerHTML = '<p class="text-muted mb-0">Not shared with any teams yet.</p>'
      return
    }

    teams.forEach(team => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'list-group-item list-group-item-action list-group-item-success'
      item.textContent = team.name || `Team ${team.id}`
      item.dataset.teamId = team.id
      item.addEventListener('click', (e) => this.toggleSharedSelect(e, team))
      this.sharedListEl.appendChild(item)
    })

    this.toggleUnshareSubmit()
  }

  toggleSharedSelect(e, team) {
    if (this.selectedSharedTeamId) {
      const prev = this.sharedListEl.querySelector(`[data-team-id="${this.selectedSharedTeamId}"]`)
      if (prev) prev.classList.remove('active')
    }

    if (this.selectedSharedTeamId === team.id) {
      this.selectedSharedTeamId = null
    } else {
      this.selectedSharedTeamId = team.id
      const el = e.currentTarget || e.target
      el.classList.add('active')
    }

    this.toggleUnshareSubmit()
  }

  rebuildTeamDropdown(allTeamsJson, sharedTeamsJson) {
    if (!this.teamSelect) return

    populateTeamSelect(this.teamSelect, parseTeamsJson(allTeamsJson), parseTeamsJson(sharedTeamsJson))
  }
}
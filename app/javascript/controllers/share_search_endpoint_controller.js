import { Controller } from "@hotwired/stimulus"
import { parseTeamsJson, populateTeamSelect } from "utils/share_case_teams"

export default class extends Controller {
  connect() {
    this.searchEndpointIdInput = document.getElementById('share-search-endpoint-id')
    this.unshareSearchEndpointIdInput = document.getElementById('unshare-search-endpoint-id')
    this.unshareTeamInput = document.getElementById('unshare-search-endpoint-team')
    this.teamSelect = document.getElementById('share-search-endpoint-team')
    this.titleEl = document.getElementById('shareSearchEndpointModalLabel')
    this.sharedListEl = document.getElementById('share-search-endpoint-shared-list')
    this.submitButton = document.getElementById('share-search-endpoint-submit')
    this.unshareButton = document.getElementById('unshare-search-endpoint-submit')
    this.selectedSharedTeamId = null
  }

  open(event) {
    const btn = event.currentTarget || event.target
    const searchEndpointId = btn?.dataset?.shareSearchEndpointIdValue
    const searchEndpointName = btn?.dataset?.shareSearchEndpointNameValue
    const sharedTeamsJson = btn?.dataset?.shareSearchEndpointSharedTeamsJson
    const allTeamsJson = btn?.dataset?.shareSearchEndpointAllTeamsJson

    if (this.searchEndpointIdInput) this.searchEndpointIdInput.value = searchEndpointId || ''
    if (this.unshareSearchEndpointIdInput) this.unshareSearchEndpointIdInput.value = searchEndpointId || ''
    if (this.titleEl) {
      this.titleEl.textContent = searchEndpointName ? `Share Search Endpoint: ${searchEndpointName}` : 'Share Search Endpoint'
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
    console.log('renderSharedTeams called with:', rawJson)
    if (!this.sharedListEl) return

    const teams = parseTeamsJson(rawJson)
    console.log('Parsed shared teams:', teams)

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
import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  connect() {
    this.scorerIdInput = document.getElementById('share-scorer-id')
    this.unshareScorerIdInput = document.getElementById('unshare-scorer-id')
    this.unshareTeamInput = document.getElementById('unshare-scorer-team')
    this.teamSelect = document.getElementById('share-scorer-team')
    this.titleEl = document.getElementById('shareScorerModalLabel')
    this.sharedListEl = document.getElementById('share-scorer-shared-list')
    this.submitButton = document.getElementById('share-scorer-submit')
    this.unshareButton = document.getElementById('unshare-scorer-submit')
    this.selectedSharedTeamId = null
  }

  open(event) {
    const btn = event.currentTarget || event.target
    const scorerId = btn?.dataset?.shareScorerId
    const scorerName = btn?.dataset?.shareScorerName
    const sharedTeamsJson = btn?.dataset?.shareScorerSharedTeamsJson

    if (this.scorerIdInput) this.scorerIdInput.value = scorerId || ''
    if (this.unshareScorerIdInput) this.unshareScorerIdInput.value = scorerId || ''
    if (this.titleEl) {
      this.titleEl.textContent = scorerName ? `Share Scorer: ${scorerName}` : 'Share Scorer'
    }
    if (this.teamSelect) this.teamSelect.value = ''
    if (this.unshareTeamInput) this.unshareTeamInput.value = ''
    this.selectedSharedTeamId = null
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

    let teams = []
    try {
      if (rawJson && rawJson.trim() !== '') {
        const parsed = JSON.parse(rawJson)
        if (Array.isArray(parsed)) teams = parsed
      }
    } catch (e) {
      teams = []
    }

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
}

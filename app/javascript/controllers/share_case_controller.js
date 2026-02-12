import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  connect() {
    this.caseIdInput = document.getElementById('share-case-id')
    this.unshareCaseIdInput = document.getElementById('unshare-case-id')
    this.unshareTeamInput = document.getElementById('unshare-case-team')
    this.teamHiddenInput = document.getElementById('share-case-team-hidden')
    this.teamSelect = document.getElementById('share-case-team')
    this.titleEl = document.getElementById('shareCaseModalLabel')
    this.sharedListEl = document.getElementById('share-case-shared-list')
    this.shareForm = document.getElementById('share-case-form')
    this.submitButton = document.getElementById('share-case-submit')
    this.unshareButton = document.getElementById('unshare-case-submit')
    this.selectedSharedTeamId = null
    this.userTeams = []
    this.currentCaseId = null
  }

  open(event) {
    const btn = event.currentTarget || event.target
    const caseId = btn?.dataset?.shareCaseIdValue
    const caseName = btn?.dataset?.shareCaseNameValue
    const sharedTeamsJson = btn?.dataset?.shareCaseSharedTeamsJson
    const userTeamsJson = btn?.dataset?.shareCaseUserTeamIdsJson

    this.currentCaseId = caseId

    if (this.caseIdInput) this.caseIdInput.value = caseId || ''
    if (this.unshareCaseIdInput) this.unshareCaseIdInput.value = caseId || ''
    if (this.titleEl) {
      this.titleEl.textContent = caseName ? `Share Case: ${caseName}` : 'Share Case'
    }

    // Parse user teams
    let userTeamIds = []
    try {
      if (userTeamsJson && userTeamsJson.trim() !== '') {
        const parsed = JSON.parse(userTeamsJson)
        if (Array.isArray(parsed)) userTeamIds = parsed.map(id => Number(id))
      }
    } catch (e) {
      userTeamIds = []
    }

    // Parse shared teams
    let sharedTeams = []
    try {
      if (sharedTeamsJson && sharedTeamsJson.trim() !== '') {
        const parsed = JSON.parse(sharedTeamsJson)
        if (Array.isArray(parsed)) sharedTeams = parsed
      }
    } catch (e) {
      sharedTeams = []
    }

    const sharedTeamIds = sharedTeams.map(t => Number(t.id))

    // Get all user teams from page data
    const dataEl = document.getElementById('share-case-data')
    this.userTeams = []
    if (dataEl && dataEl.dataset.shareCaseTeamsValue) {
      try {
        this.userTeams = JSON.parse(dataEl.dataset.shareCaseTeamsValue)
      } catch (e) {
        this.userTeams = []
      }
    }

    // Build unshared team list for select dropdown
    const unsharedTeams = this.userTeams.filter(team => !sharedTeamIds.includes(Number(team.id)))

    this.renderTeamSelect(unsharedTeams)
    this.renderSharedTeams(sharedTeams)

    // Update form action with correct team ID (will be set from the first available team)
    if (this.shareForm && unsharedTeams.length > 0) {
      const firstTeamId = unsharedTeams[0].id
      this.shareForm.action = `/teams2/${firstTeamId}/cases/${caseId}/share`
    }

    if (this.teamSelect) this.teamSelect.value = ''
    if (this.unshareTeamInput) this.unshareTeamInput.value = ''
    if (this.teamHiddenInput) this.teamHiddenInput.value = ''
    this.selectedSharedTeamId = null
    this.toggleSubmit()
    this.toggleUnshareSubmit()
  }

  renderTeamSelect(teams) {
    if (!this.teamSelect) return

    this.teamSelect.innerHTML = '<option value="">Select a team...</option>'

    teams.forEach(team => {
      const option = document.createElement('option')
      option.value = team.id
      option.textContent = team.name
      this.teamSelect.appendChild(option)
    })

    if (teams.length === 0) {
      this.teamSelect.innerHTML = '<option value="">No other teams to share with</option>'
      this.teamSelect.disabled = true
    } else {
      this.teamSelect.disabled = false
    }
  }

  toggleSubmit() {
    if (!this.submitButton || !this.teamSelect) return
    const teamId = this.teamSelect.value

    if (this.teamHiddenInput) this.teamHiddenInput.value = teamId
    this.submitButton.disabled = !teamId

    // Update form action with selected team
    if (this.shareForm && teamId && this.currentCaseId) {
      this.shareForm.action = `/teams2/${teamId}/cases/${this.currentCaseId}/share`
    }
  }

  toggleUnshareSubmit() {
    if (!this.unshareButton) return
    this.unshareButton.disabled = !this.selectedSharedTeamId
    if (this.unshareTeamInput) this.unshareTeamInput.value = this.selectedSharedTeamId || ''
  }

  renderSharedTeams(teams) {
    if (!this.sharedListEl) return

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

      // Update unshare form action
      const unshareForm = document.getElementById('unshare-case-form')
      if (unshareForm && this.currentCaseId) {
        unshareForm.action = `/teams2/${team.id}/cases/${this.currentCaseId}/unshare`
      }
    }

    this.toggleUnshareSubmit()
  }
}

        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({})
      })

      if (resp.ok) {
        // simple UX: reload to reflect changes
        location.reload()
      } else {
        const body = await resp.json().catch(() => null)
        alert((body && body.error) || 'Unable to share case with team.')
      }
    } catch (err) {
      console.error(err)
      alert('Unable to share case with team.')
    }
  }

  // Share using the single selected team (commit button)
  async shareSelected(event) {
    event.preventDefault()
    if (!this.selectedTeamId) return
    const teamId = this.selectedTeamId
    const caseId = this.currentCaseId
    const url = `/teams2/${teamId}/cases/${caseId}/share`
    const token = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      // Build a form and submit it so the server-side route handles adding the case to the team
      const form = document.createElement('form')
      form.method = 'post'
      form.action = url
      form.style.display = 'none'

      const tokenInput = document.createElement('input')
      tokenInput.type = 'hidden'
      tokenInput.name = 'authenticity_token'
      tokenInput.value = token || ''
      form.appendChild(tokenInput)

      // Add an empty payload param to ensure request has body (optional)
      const emptyInput = document.createElement('input')
      emptyInput.type = 'hidden'
      emptyInput.name = 'commit'
      emptyInput.value = '1'
      form.appendChild(emptyInput)

      document.body.appendChild(form)
      form.submit()
      // Note: we don't try to update the modal after submit because the browser will navigate.
    } catch (err) {
      console.error(err)
      alert('Unable to share case with team.')
    }
  }
}

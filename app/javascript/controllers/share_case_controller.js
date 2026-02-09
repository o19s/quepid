import { Controller } from "@hotwired/stimulus";

export default class extends Controller {
  static values = {
    id: Number,
    name: String,
    sharedTeams: Array,
    userTeamIds: Array,
    currentTeamId: Number
  }

  connect() {
    this.modalEl = document.getElementById('shareCaseModal')
    this.unsharedListEl = document.getElementById('share-case-unshared-list')
    this.sharedListEl = document.getElementById('share-case-shared-list')
    const dataEl = document.getElementById('share-case-data')
    this.userTeams = []
    if (dataEl && dataEl.dataset.shareCaseTeamsValue) {
      try {
        this.userTeams = JSON.parse(dataEl.dataset.shareCaseTeamsValue)
      } catch (e) {
        // ignore
      }
    }
    this.selectedTeamId = null
    this.commitButton = null
  }

  open(event) {
    try {
      event.preventDefault()
      // values are populated from data attributes on the button
      this.currentCaseId = this.idValue
      this.currentCaseName = this.nameValue
      // read JSON payloads directly from the clicked element's dataset to avoid Stimulus parsing issues
      const btn = event.currentTarget || event.target
      const rawSharedJson = btn.dataset.shareCaseSharedTeamsJson
      const rawUserJson = btn.dataset.shareCaseUserTeamIdsJson
    // Parse shared teams payload (array of {id,name}) from button dataset
    let parsedSharedTeams = []
    try {
      if (rawSharedJson && rawSharedJson.trim() !== '') {
        const parsed = JSON.parse(rawSharedJson)
        if (Array.isArray(parsed)) parsedSharedTeams = parsed.map(t => ({ id: Number(t.id), name: t.name }))
      }
    } catch (e) {
      console.error('share-case: failed parsing shared teams JSON from element', e, rawSharedJson)
      parsedSharedTeams = []
    }

    const sharedIdsFromObjects = parsedSharedTeams.map(t => Number(t.id))

    // IDs of teams the current user is a member of / has access to (robust parsing)
    this.currentUserTeamIds = []
    try {
      const rawUser = this.userTeamIdsValue
      console.debug('share-case rawUser:', rawUser)
      if (Array.isArray(rawUser)) {
        this.currentUserTeamIds = rawUser.map((id) => Number(id))
      } else if (typeof rawUser === 'string' && rawUser.trim() !== '') {
        const parsedU = JSON.parse(rawUser)
        console.debug('share-case parsedUser:', parsedU)
        this.currentUserTeamIds = Array.isArray(parsedU) ? parsedU.map((id) => Number(id)) : []
      } else if (typeof rawUser === 'number') {
        this.currentUserTeamIds = [Number(rawUser)]
      }
      console.debug('share-case parsedUserIds:', this.currentUserTeamIds)
    } catch (e) {
      console.error('share-case: failed parsing userTeamIdsValue', e, this.userTeamIdsValue)
      this.currentUserTeamIds = []
    }
    // Compute filtered lists:
    // - filteredSharedIds: teams that the case is already shared with AND the user is a member of
    // - filteredUnsharedIds: teams the user is a member of but the case is NOT shared with
    const sharedSet = new Set(sharedIdsFromObjects)
    let userIds = []
    try {
      if (rawUserJson && rawUserJson.trim() !== '') {
        const parsedU = JSON.parse(rawUserJson)
        if (Array.isArray(parsedU)) userIds = parsedU.map(i => Number(i))
      }
    } catch (e) {
      console.error('share-case: failed parsing user team ids JSON from element', e, rawUserJson)
    }
    const userSet = new Set(userIds)

    const filteredSharedIds = Array.from(sharedSet).filter((id) => userSet.has(id))
    const filteredUnsharedIds = Array.from(userSet).filter((id) => !sharedSet.has(id))

    // Build lookup from userTeams payload (id -> {id,name})
    const allUserTeamsById = {}
    try {
      (this.userTeams || []).forEach(t => { allUserTeamsById[Number(t.id)] = t })
    } catch (e) {
      console.error('share-case: failed building userTeams map', e, this.userTeams)
    }

    // Also merge names from parsedSharedTeams to ensure names are present
    parsedSharedTeams.forEach(t => { allUserTeamsById[Number(t.id)] = { id: Number(t.id), name: t.name } })

    try {
      this.filteredSharedTeams = filteredSharedIds.map(id => {
        return allUserTeamsById[id] || { id: id, name: `Team ${id}` }
      })

      this.filteredUnsharedTeams = filteredUnsharedIds.map(id => {
        return allUserTeamsById[id] || { id: id, name: `Team ${id}` }
      })
    } catch (e) {
      console.error('share-case: failed mapping filtered ids to team objects', e, {
        filteredSharedIds,
        filteredUnsharedIds,
        allUserTeamsById
      })
      this.filteredSharedTeams = []
      this.filteredUnsharedTeams = []
    }
    console.debug('share-case final lists', { shared: this.filteredSharedTeams, unshared: this.filteredUnsharedTeams })

    this.renderLists()
    // Show modal (Bootstrap 5) — guard if bootstrap isn't loaded
    if (this.modalEl) {
      try {
        if (typeof bootstrap !== 'undefined' && bootstrap && typeof bootstrap.Modal === 'function') {
          const modal = new bootstrap.Modal(this.modalEl)
          modal.show()
        } else if (this.modalEl.classList) {
          // fallback: show modal by toggling classes (basic)
          this.modalEl.classList.add('show')
          this.modalEl.style.display = 'block'
        }
      } catch (mbErr) {
        console.error('share-case: failed to show modal', mbErr)
      }
    }
  } catch (err) {
    // Log enough context to debug client-side issues
    console.error('share-case open error', err, {
      idValue: this.idValue,
      nameValue: this.nameValue,
      sharedTeamIdsValue: this.sharedTeamIdsValue,
      userTeamIdsValue: this.userTeamIdsValue,
      userTeamsPayload: this.userTeams && this.userTeams.length
    })
  }
  }

  renderLists() {
    // Clear
    this.unsharedListEl.innerHTML = ''
    this.sharedListEl.innerHTML = ''

    const sharedTeams = this.filteredSharedTeams || []
    const unsharedTeams = this.filteredUnsharedTeams || []

    // Find commit button (only once)
    if (!this.commitButton) {
      this.commitButton = document.getElementById('share-case-commit')
    }

    if (unsharedTeams.length === 0) {
      this.unsharedListEl.innerHTML = '<p class="text-muted">No other teams to share with.</p>'
    } else {
      unsharedTeams.forEach(t => {
        const item = document.createElement('button')
        item.type = 'button'
        item.className = 'list-group-item list-group-item-action'
        item.textContent = t.name
        item.dataset.teamId = t.id
        item.addEventListener('click', (e) => this.toggleSelect(e, t))
        this.unsharedListEl.appendChild(item)
      })
    }

    if (sharedTeams.length === 0) {
      this.sharedListEl.innerHTML = '<p class="text-muted">Not shared with any teams yet.</p>'
    } else {
      sharedTeams.forEach(t => {
        const item = document.createElement('div')
        item.className = 'list-group-item list-group-item-success'
        item.textContent = t.name
        this.sharedListEl.appendChild(item)
      })
    }
    // Ensure commit button state
    if (this.commitButton) {
      this.commitButton.disabled = !this.selectedTeamId
    }
  }

  toggleSelect(e, team) {
    // Deselect previous
    if (this.selectedTeamId) {
      const prev = this.unsharedListEl.querySelector(`[data-team-id="${this.selectedTeamId}"]`)
      if (prev) prev.classList.remove('active')
    }

    // If selecting same, clear
    if (this.selectedTeamId === team.id) {
      this.selectedTeamId = null
    } else {
      this.selectedTeamId = team.id
      const el = e.currentTarget || e.target
      el.classList.add('active')
    }

    if (this.commitButton) this.commitButton.disabled = !this.selectedTeamId
  }

  async shareTeam(event, team) {
    event.preventDefault()
    const teamId = team.id
    const caseId = this.currentCaseId

    const url = `/teams2/${teamId}/cases/${caseId}/share`
    const token = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      const resp = await fetch(url, {
        method: 'POST',
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

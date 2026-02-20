import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
  connect() {
    this.scorerIdInput = document.getElementById('share-scorer-id');
    this.unshareScorerIdInput = document.getElementById('unshare-scorer-id');
    this.unshareTeamInput = document.getElementById('unshare-scorer-team');
    this.teamSelect = document.getElementById('share-scorer-team');
    this.titleEl = document.getElementById('shareScorerModalLabel');
    this.sharedListEl = document.getElementById('share-scorer-shared-list');
    this.submitButton = document.getElementById('share-scorer-submit');
    this.unshareButton = document.getElementById('unshare-scorer-submit');
    this.selectedSharedTeamId = null;

    this._boundSharedListClick = (e) => this._handleSharedListClick(e);
    this.sharedListEl?.addEventListener('click', this._boundSharedListClick);
  }

  disconnect() {
    this.sharedListEl?.removeEventListener('click', this._boundSharedListClick);
  }

  _handleSharedListClick(event) {
    const btn = event.target.closest('button[data-team-id]');
    if (!btn) return;
    const team = {
      id: btn.dataset.teamId,
      name: btn.dataset.teamName || `Team ${btn.dataset.teamId}`,
    };
    this.toggleSharedSelect(event, team);
  }

  open(event) {
    const btn = event.currentTarget || event.target;
    const scorerId = btn?.dataset?.shareScorerId;
    const scorerName = btn?.dataset?.shareScorerName;
    const sharedTeamsJson = btn?.dataset?.shareScorerSharedTeamsJson;
    const allTeamsJson = btn?.dataset?.shareScorerAllTeamsJson;

    if (this.scorerIdInput) this.scorerIdInput.value = scorerId || '';
    if (this.unshareScorerIdInput) this.unshareScorerIdInput.value = scorerId || '';
    if (this.titleEl) {
      this.titleEl.textContent = scorerName ? `Share Scorer: ${scorerName}` : 'Share Scorer';
    }
    if (this.unshareTeamInput) this.unshareTeamInput.value = '';
    this.selectedSharedTeamId = null;

    // Rebuild dropdown with unshared teams only
    this.rebuildTeamDropdown(allTeamsJson, sharedTeamsJson);

    this.toggleSubmit();
    this.renderSharedTeams(sharedTeamsJson);
  }

  toggleSubmit() {
    if (!this.submitButton || !this.teamSelect) return;
    const teamId = this.teamSelect.value;
    this.submitButton.disabled = !teamId;
  }

  toggleUnshareSubmit() {
    if (!this.unshareButton) return;
    this.unshareButton.disabled = !this.selectedSharedTeamId;
    if (this.unshareTeamInput) this.unshareTeamInput.value = this.selectedSharedTeamId || '';
  }

  renderSharedTeams(rawJson) {
    if (!this.sharedListEl) return;

    let teams = [];
    try {
      if (rawJson && rawJson.trim() !== '') {
        const parsed = JSON.parse(rawJson);
        if (Array.isArray(parsed)) teams = parsed;
      }
    } catch (_e) {
      teams = [];
    }

    this.sharedListEl.innerHTML = '';

    if (teams.length === 0) {
      this.sharedListEl.innerHTML = '<p class="text-muted mb-0">Not shared with any teams yet.</p>';
      return;
    }

    teams.forEach((team) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'list-group-item list-group-item-action list-group-item-success';
      item.textContent = team.name || `Team ${team.id}`;
      item.dataset.teamId = team.id;
      item.dataset.teamName = team.name || '';
      this.sharedListEl.appendChild(item);
    });

    this.toggleUnshareSubmit();
  }

  toggleSharedSelect(e, team) {
    if (this.selectedSharedTeamId) {
      const prev = this.sharedListEl.querySelector(`[data-team-id="${this.selectedSharedTeamId}"]`);
      if (prev) prev.classList.remove('active');
    }

    if (this.selectedSharedTeamId === team.id) {
      this.selectedSharedTeamId = null;
    } else {
      this.selectedSharedTeamId = team.id;
      const el = e.target.closest('button[data-team-id]');
      if (el) el.classList.add('active');
    }

    this.toggleUnshareSubmit();
  }

  rebuildTeamDropdown(allTeamsJson, sharedTeamsJson) {
    if (!this.teamSelect) return;

    // Parse all user teams
    let allTeams = [];
    try {
      if (allTeamsJson && allTeamsJson.trim() !== '') {
        const parsed = JSON.parse(allTeamsJson);
        if (Array.isArray(parsed)) allTeams = parsed;
      }
    } catch (e) {
      console.error('Error parsing allTeamsJson:', e, allTeamsJson);
      allTeams = [];
    }

    // Parse shared teams
    let sharedTeams = [];
    try {
      if (sharedTeamsJson && sharedTeamsJson.trim() !== '') {
        const parsed = JSON.parse(sharedTeamsJson);
        if (Array.isArray(parsed)) sharedTeams = parsed;
      }
    } catch (_e) {
      sharedTeams = [];
    }

    const sharedTeamIds = sharedTeams.map((t) => String(t.id));

    // Filter out teams that already have the scorer (server-side style logic)
    const unsharedTeams = allTeams.filter((team) => !sharedTeamIds.includes(String(team.id)));

    // Rebuild dropdown with only unshared teams
    this.teamSelect.innerHTML = '<option value="">Select a team...</option>';

    if (unsharedTeams.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.text = 'No other teams to share with';
      this.teamSelect.appendChild(option);
      this.teamSelect.disabled = true;
    } else {
      unsharedTeams.forEach((team) => {
        const option = document.createElement('option');
        option.value = team.id;
        option.text = team.name;
        this.teamSelect.appendChild(option);
      });
      this.teamSelect.disabled = false;
    }

    // Reset selection to empty
    this.teamSelect.value = '';
  }
}

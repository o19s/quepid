import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';
import { getQuepidRootUrl, buildApiUrl } from 'utils/quepid_root';

// Handles the annotations panel: create, edit, and delete annotations via the
// api/v1/cases/:case_id/annotations REST API. Replaces the Angular annotations
// and annotation components. Uses buildApiUrl() and apiFetch for API calls.

export default class extends Controller {
  static values = {
    caseId: Number,
    lastScore: Object,
  };

  static targets = [
    'messageInput',
    'annotationsList',
    'editModal',
    'editMessageInput',
    'noScoreWarning',
    'annotation',
    'messageDisplay',
  ];

  connect() {
    this._editModal = null;
    this._editAnnotationId = null;
  }

  async create() {
    const message = this.messageInputTarget.value.trim();
    if (!message) return;

    const lastScore = this.lastScoreValue;
    if (!lastScore || !lastScore.try_id) {
      console.warn('No score data available to create annotation');
      return;
    }

    const body = {
      annotation: { message: message, source: 'viewcomponent' },
      score: {
        all_rated: lastScore.all_rated,
        score: lastScore.score,
        try_id: lastScore.try_id,
        queries: lastScore.queries || [],
      },
    };

    const root = getQuepidRootUrl();
    const url = buildApiUrl(root, 'cases', this.caseIdValue, 'annotations');
    const useTurboStream = !!window.Turbo;
    const accept = useTurboStream ? 'text/vnd.turbo-stream.html' : 'application/json';
    try {
      const res = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: accept },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }

      if (useTurboStream && res.headers.get('Content-Type')?.includes('turbo-stream')) {
        const html = await res.text();
        if (html?.trim()) window.Turbo.renderStreamMessage(html);
      } else {
        const data = await res.json();
        this._prependAnnotation(data);
      }
      this.messageInputTarget.value = '';
    } catch (err) {
      console.error('Create annotation failed:', err);
      if (window.flash)
        window.flash.error = err.message || 'Unable to create annotation, please try again.';
    }
  }

  async deleteAnnotation(event) {
    event.preventDefault();
    const annotationId = event.currentTarget.dataset.annotationId;
    if (!annotationId) return;

    if (!confirm('Are you sure you want to delete this annotation?')) return;

    const root = getQuepidRootUrl();
    const url = buildApiUrl(root, 'cases', this.caseIdValue, 'annotations', annotationId);
    try {
      const res = await apiFetch(url, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }

      // Remove the annotation <li> from the DOM
      const li = this.annotationTargets.find(
        (el) => el.dataset.annotationId === String(annotationId)
      );
      if (li) li.remove();
    } catch (err) {
      console.error('Delete annotation failed:', err);
      if (window.flash)
        window.flash.error = err.message || 'Unable to delete annotation, please try again.';
    }
  }

  openEditModal(event) {
    event.preventDefault();
    const { annotationId, annotationMessage } = event.currentTarget.dataset;
    this._editAnnotationId = annotationId;
    this.editMessageInputTarget.value = annotationMessage || '';

    if (!this._editModal) {
      const el = this.editModalTarget;
      this._editModal =
        window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el);
    }
    this._editModal.show();
  }

  async updateAnnotation() {
    const message = this.editMessageInputTarget.value.trim();
    if (!message || !this._editAnnotationId) return;

    const root = getQuepidRootUrl();
    const url = buildApiUrl(root, 'cases', this.caseIdValue, 'annotations', this._editAnnotationId);
    try {
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ annotation: { message: message } }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || data.error || res.statusText);
      }

      // Update the message text in the DOM
      const li = this.annotationTargets.find(
        (el) => el.dataset.annotationId === String(this._editAnnotationId)
      );
      if (li) {
        const msgEl = li.querySelector("[data-annotations-target='messageDisplay']");
        if (msgEl) msgEl.textContent = message;

        // Also update the edit button's data-annotation-message so re-opening edit shows new text
        const editBtn = li.querySelector("[data-action='click->annotations#openEditModal']");
        if (editBtn) editBtn.dataset.annotationMessage = message;
      }

      this._editModal?.hide();
      this._editAnnotationId = null;
    } catch (err) {
      console.error('Update annotation failed:', err);
      if (window.flash)
        window.flash.error = err.message || 'Unable to update annotation, please try again.';
    }
  }

  // Build an <li> from the API response and prepend it to the list
  _prependAnnotation(data) {
    const li = document.createElement('li');
    li.className = 'annotation';
    li.dataset.annotationsTarget = 'annotation';
    li.dataset.annotationId = data.id;

    const timeText = 'just now';
    const userName = data.user?.name || '';
    const tryId = data.score?.try_id ?? '';
    const score = data.score?.score ?? '';
    const message = data.message || '';

    li.innerHTML = `
      <div class="dropdown float-end">
        <a href="#" class="dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
          <i class="bi bi-three-dots-vertical"></i>
        </a>
        <ul class="dropdown-menu">
          <li>
            <a class="dropdown-item" href="#"
               data-action="click->annotations#openEditModal"
               data-annotation-id="${data.id}"
               data-annotation-message="${this._escapeAttr(message)}">
              <i class="bi bi-pencil"></i> Edit
            </a>
          </li>
          <li>
            <a class="dropdown-item text-danger" href="#"
               data-action="click->annotations#deleteAnnotation"
               data-annotation-id="${data.id}">
              <i class="bi bi-trash"></i> Delete
            </a>
          </li>
        </ul>
      </div>
      <em class="annotations-time">${timeText}</em>
      ${userName ? `<span class="annotation-source">by ${this._escapeHtml(userName)}</span>` : ''}
      <div>
        <span class="annotation-try">Try No: ${tryId}</span>
        <i class="bi bi-circle-fill"></i>
        <span class="annotation-score">Score: ${score}</span>
      </div>
      <div class="annotation-message" data-annotations-target="messageDisplay">
        ${this._escapeHtml(message)}
      </div>
    `;

    this.annotationsListTarget.prepend(li);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _escapeAttr(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

import { Controller } from '@hotwired/stimulus';
import { apiFetch } from 'api/fetch';

// Reusable double-click-to-edit controller for inline text editing.
// Swaps between a display element and an input field on dblclick.
// Saves on Enter or blur, cancels on Escape.
//
// Values:
//   url    — API endpoint for PUT (e.g. /api/v1/cases/1)
//   field  — param name (e.g. "case_name")
//   wrapper — top-level key (e.g. "case") → { case: { case_name: val } }
//
// Targets:
//   display — the read-only text element (dblclick to edit)
//   input   — the text input (hidden by default)
//
// Usage in ERB:
//   <span data-controller="inline-edit"
//         data-inline-edit-url-value="<%= api_v1_case_path(@case) %>"
//         data-inline-edit-field-value="case_name"
//         data-inline-edit-wrapper-value="case">
//     <span data-inline-edit-target="display" data-action="dblclick->inline-edit#edit">
//       <%= @case.case_name %>
//     </span>
//     <input type="text" class="form-control form-control-sm d-none"
//            data-inline-edit-target="input"
//            data-action="keydown->inline-edit#onKeydown blur->inline-edit#save"
//            value="<%= @case.case_name %>">
//   </span>
export default class extends Controller {
  static values = {
    url: String,
    field: String,
    wrapper: String,
  };

  static targets = ['display', 'input'];

  edit() {
    if (!this.hasDisplayTarget || !this.hasInputTarget) return;
    this._saving = false;
    this.inputTarget.value = this.displayTarget.textContent.trim();
    this.displayTarget.classList.add('d-none');
    this.inputTarget.classList.remove('d-none');
    this.inputTarget.focus();
    this.inputTarget.select();
  }

  onKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
    }
  }

  async save() {
    if (this._saving) return;
    if (!this.hasDisplayTarget || !this.hasInputTarget) return;
    this._saving = true;

    const newValue = this.inputTarget.value.trim();
    const oldValue = this.displayTarget.textContent.trim();

    // Hide input, show display
    this.inputTarget.classList.add('d-none');
    this.displayTarget.classList.remove('d-none');

    if (newValue === oldValue || newValue === '') return;

    // Optimistically update display
    this.displayTarget.textContent = newValue;

    try {
      const body = {};
      if (this.wrapperValue) {
        body[this.wrapperValue] = { [this.fieldValue]: newValue };
      } else {
        body[this.fieldValue] = newValue;
      }

      const res = await apiFetch(this.urlValue, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `Update failed (${res.status})`);
      }
    } catch (err) {
      console.error('Inline edit save failed:', err);
      // Revert on failure
      this.displayTarget.textContent = oldValue;
      if (window.flash) window.flash.error = err.message;
    }
  }

  cancel() {
    if (!this.hasInputTarget || !this.hasDisplayTarget) return;
    this.inputTarget.classList.add('d-none');
    this.displayTarget.classList.remove('d-none');
  }
}

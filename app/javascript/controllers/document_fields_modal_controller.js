import { Controller } from '@hotwired/stimulus';

export default class extends Controller {
  static targets = ['queryText', 'docId', 'content', 'modal'];

  show(event) {
    event.preventDefault();

    const link = event.currentTarget;
    const documentFields = link.dataset.documentFields;
    const queryText = link.dataset.queryText;
    const docId = link.dataset.docId;

    this.queryTextTarget.textContent = queryText;
    this.docIdTarget.textContent = docId;

    try {
      const parsed = JSON.parse(documentFields);
      this.contentTarget.textContent = JSON.stringify(parsed, null, 2);
    } catch (_e) {
      // Fallback: show raw content if JSON parsing fails
      this.contentTarget.textContent = documentFields;
    }

    const modal =
      window.bootstrap?.Modal?.getOrCreateInstance(this.modalTarget) ??
      new window.bootstrap.Modal(this.modalTarget);
    modal.show();
  }
}

import { Controller } from "@hotwired/stimulus"

// Shows a Bootstrap modal confirmation and submits a DELETE (or other) request
// with the CSRF token when confirmed. Falls back to native confirm() if
// Bootstrap's modal API is not available.
export default class extends Controller {
  static values = {
    url: String,
    method: { type: String, default: 'delete' },
    message: { type: String, default: 'Are you sure?' }
  }

  connect() {
    // Find or create a single modal element in the document
    this.modal = document.getElementById('confirmDeleteModal')
    if (!this.modal) {
      this._insertModal()
      this.modal = document.getElementById('confirmDeleteModal')
    }

    this.messageEl = this.modal.querySelector('.confirm-delete-message')
    this.confirmBtn = this.modal.querySelector('.confirm-delete-confirm')
    this._onConfirm = this._onConfirm.bind(this)
  }

  open(event) {
    event.preventDefault()
    // set message and remember url/method from values (data attrs)
    const msg = this.messageValue || this.element.dataset.confirmMessage || this.element.getAttribute('aria-label') || 'Are you sure?'
    this.messageEl.textContent = msg
    this.currentUrl = this.urlValue || this.element.dataset.confirmDeleteUrlValue || this.element.dataset.url
    this.currentMethod = (this.methodValue || this.element.dataset.confirmDeleteMethodValue || 'delete').toLowerCase()

    this.confirmBtn.addEventListener('click', this._onConfirm)

    // Try to use Bootstrap modal if available
    if (window.bootstrap && window.bootstrap.Modal) {
      this._bsModal = new window.bootstrap.Modal(this.modal)
      this._bsModal.show()
    } else {
      // fallback to native confirm
      const ok = window.confirm(msg)
      if (ok) this._submitDeleteForm()
    }
  }

  _onConfirm(e) {
    e.preventDefault()
    this._submitDeleteForm()
    if (this._bsModal) this._bsModal.hide()
    this.confirmBtn.removeEventListener('click', this._onConfirm)
  }

  _submitDeleteForm() {
    if (!this.currentUrl) return

    const token = document.querySelector('meta[name="csrf-token"]')?.content

    const form = document.createElement('form')
    form.method = 'post'
    form.action = this.currentUrl
    form.style.display = 'none'

    if (token) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'authenticity_token'
      input.value = token
      form.appendChild(input)
    }

    if (this.currentMethod !== 'post') {
      const methodInput = document.createElement('input')
      methodInput.type = 'hidden'
      methodInput.name = '_method'
      methodInput.value = this.currentMethod
      form.appendChild(methodInput)
    }

    document.body.appendChild(form)
    form.submit()
  }

  _insertModal() {
    const container = document.createElement('div')
    container.innerHTML = `
      <div class="modal fade" id="confirmDeleteModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Confirm</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <p class="confirm-delete-message"></p>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="button" class="btn btn-danger confirm-delete-confirm">Remove</button>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(container)
  }
}

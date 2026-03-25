import { Controller } from "@hotwired/stimulus"
import { csrfToken } from "modules/api_url"

// Shared `#confirmDeleteModal` is used by many Stimulus instances on one page.
// Pending action + one-time listeners avoid stacked per-instance handlers and wrong submits.

/** @type {{ url: string, method: string } | null} */
let pendingConfirmDelete = null

let confirmDeleteModalEl = null
let sharedConfirmDeleteHandlersInstalled = false

function submitDeleteForm(url, method) {
  if (!url) return

  const token = csrfToken()

  const form = document.createElement("form")
  form.method = "post"
  form.action = url
  form.style.display = "none"

  if (token) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = "authenticity_token"
    input.value = token
    form.appendChild(input)
  }

  if (method !== "post") {
    const methodInput = document.createElement("input")
    methodInput.type = "hidden"
    methodInput.name = "_method"
    methodInput.value = method
    form.appendChild(methodInput)
  }

  document.body.appendChild(form)
  form.submit()
}

function onSharedConfirmDeleteClick(e) {
  e.preventDefault()
  if (!pendingConfirmDelete) return
  const { url, method } = pendingConfirmDelete
  pendingConfirmDelete = null
  submitDeleteForm(url, method)
  window.bootstrap?.Modal?.getInstance(confirmDeleteModalEl)?.hide()
}

function onSharedConfirmDeleteModalHidden() {
  pendingConfirmDelete = null
}

function ensureSharedConfirmDeleteHandlers(modal) {
  if (sharedConfirmDeleteHandlersInstalled && confirmDeleteModalEl?.isConnected) return
  sharedConfirmDeleteHandlersInstalled = false

  const confirmBtn = modal.querySelector(".confirm-delete-confirm")
  if (!confirmBtn) return

  confirmDeleteModalEl = modal
  confirmBtn.addEventListener("click", onSharedConfirmDeleteClick)
  modal.addEventListener("hidden.bs.modal", onSharedConfirmDeleteModalHidden)
  sharedConfirmDeleteHandlersInstalled = true
}

// Shows a Bootstrap modal confirmation and submits a DELETE (or other) request
// with the CSRF token when confirmed. Falls back to native confirm() if
// Bootstrap's modal API is not available.
export default class extends Controller {
  static values = {
    url: String,
    method: { type: String, default: "delete" },
    message: { type: String, default: "Are you sure?" },
  }

  connect() {
    this.modal = document.getElementById("confirmDeleteModal")
    if (!this.modal) {
      this._insertModal()
      this.modal = document.getElementById("confirmDeleteModal")
    }

    this.messageEl = this.modal.querySelector(".confirm-delete-message")
  }

  open(event) {
    event.preventDefault()

    const msg =
      this.messageValue ||
      this.element.dataset.confirmMessage ||
      this.element.getAttribute("aria-label") ||
      "Are you sure?"
    const url =
      this.urlValue || this.element.dataset.confirmDeleteUrlValue || this.element.dataset.url
    const method = (
      this.methodValue ||
      this.element.dataset.confirmDeleteMethodValue ||
      "delete"
    ).toLowerCase()

    this.messageEl.textContent = msg

    if (window.bootstrap && window.bootstrap.Modal) {
      pendingConfirmDelete = { url, method }
      ensureSharedConfirmDeleteHandlers(this.modal)
      window.bootstrap.Modal.getOrCreateInstance(this.modal).show()
    } else {
      pendingConfirmDelete = null
      const ok = window.confirm(msg)
      if (ok) submitDeleteForm(url, method)
    }
  }

  _insertModal() {
    const container = document.createElement("div")
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
              <button type="button" class="btn btn-danger confirm-delete-confirm">Confirm</button>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(container)
  }
}

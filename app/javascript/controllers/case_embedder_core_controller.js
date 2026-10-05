import ModalTriggerControllerBase from "controllers/core_modal_trigger_controller_base"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal, hideBsModal } from "utils/bs_modal"
import { escapeHtml } from "utils/stimulus_ui"

const CHANGED_EVENT = "quepid:case-embedder-changed"

/**
 * Picks the case's embedder from the core case toolbar. New on core (there was no
 * Angular version); laid out like the Angular scorer picker (views/pick_scorer.html),
 * saving through Api::V1::CaseEmbeddersController and staying on the page.
 *
 * Dual-role like clone-case-core (ModalTriggerControllerBase): one instance on the
 * toolbar link, one on the modal in shared/_case_embedder_core_modal.html.erb, which
 * owns the URLs. A third, in the case header, shows the current embedder's name the
 * way the header shows the scorer's (hidden while there is none): it asks the modal
 * instance for it once Angular has filled in the case id, and again whenever a save
 * announces a change on `document`.
 */
export default class extends ModalTriggerControllerBase {
  static targets = ["title", "alert", "inaccessibleWarning", "list", "emptyNotice", "submitButton", "name"]

  static values = {
    id: String,
    indexUrlTemplate: String,
    updateUrlTemplate: String
  }

  get modalElementId() {
    return "caseEmbedderModal"
  }

  // --- case header instance ---

  // Rendered by Angular, so the id arrives as "{{ … }}" and is only later
  // interpolated into a number; act on the real one.
  idValueChanged() {
    if (!this.hasNameTarget || !/^\d+$/.test(this.idValue)) return

    this.modalController()?.fetchState(this.idValue).then((state) => this.renderLabel(state)).catch(() => {})
  }

  changed(event) {
    if (!this.hasNameTarget || String(event.detail?.caseId) !== this.idValue) return

    this.renderLabel(event.detail.state)
  }

  renderLabel(state) {
    this.nameTarget.textContent = state?.embedder?.name || ""
    this.element.hidden = !state?.embedder
  }

  // --- modal instance ---

  async openAsRoot(event) {
    const link = event.currentTarget || event.target
    this.caseId = link?.dataset?.caseEmbedderCoreIdValue || ""
    this.selectedId = null
    this.clearAlert()
    this.listTarget.innerHTML = ""
    this.submitButtonTarget.disabled = true

    try {
      this.state = await this.fetchState(this.caseId)
      this.selectedId = this.state.embedder_id ?? 0
      this.renderList()
    } catch (error) {
      this.showAlert(error.message || "Unable to load embedders.", "danger")
    }
  }

  async fetchState(caseId) {
    const url = this.indexUrlTemplateValue.replaceAll("__CASE_ID__", caseId)
    const response = await apiFetch(url, { headers: { Accept: "application/json" } })
    if (!response.ok) throw new Error(`Unable to load embedders (${response.status})`)

    return response.json()
  }

  renderList() {
    const { embedder: current, embedders } = this.state
    const items = [{ embedder_id: 0, name: "None", detail: "Don't vectorize this case's queries" }]
    embedders.forEach((embedder) => items.push({ ...embedder, detail: this.describe(embedder) }))
    // A teammate may have picked one that isn't shared with you: still show it as current.
    if (current && !current.accessible) items.push({ ...current, detail: this.describe(current) })

    this.listTarget.innerHTML = items
      .map(
        (item) =>
          `<button type="button" class="list-group-item list-group-item-action" data-embedder-id="${item.embedder_id}"` +
          ` data-action="click->case-embedder-core#select">` +
          `<div>${escapeHtml(item.name)}</div>` +
          `<small class="text-muted">${escapeHtml(item.detail)}</small></button>`
      )
      .join("")

    this.emptyNoticeTarget.classList.toggle("d-none", embedders.length > 0)

    const warning = this.inaccessibleWarningTarget
    warning.classList.toggle("d-none", !current || current.accessible)
    if (current && !current.accessible) {
      warning.textContent =
        `The embedder ${current.name} used by this case is NOT shared via a team with you, ` +
        "so if you switch away from it you won't have access to it again."
    }

    this.highlight()
  }

  describe(embedder) {
    const size = embedder.dimensions ? `${embedder.dimensions} dims` : "model default size"
    return `${embedder.provider} · ${embedder.model} · ${size}`
  }

  select(event) {
    this.selectedId = Number(event.currentTarget.dataset.embedderId)
    this.highlight()
  }

  highlight() {
    this.listTarget.querySelectorAll("[data-embedder-id]").forEach((item) => {
      item.classList.toggle("active", Number(item.dataset.embedderId) === this.selectedId)
    })
    this.submitButtonTarget.disabled = this.selectedId === (this.state?.embedder_id ?? 0)
  }

  async save() {
    this.clearAlert()
    this.submitButtonTarget.disabled = true

    try {
      const url = this.updateUrlTemplateValue
        .replaceAll("__CASE_ID__", this.caseId)
        .replaceAll("__EMBEDDER_ID__", String(this.selectedId))
      const response = await apiFetch(url, {
        method: "PUT",
        headers: { Accept: "application/json" }
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Unable to save (${response.status})`)

      this.state = data
      document.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: { caseId: this.caseId, state: data } }))
      hideBsModal(getOrCreateBsModal(this.element))
    } catch (error) {
      this.showAlert(error.message, "danger")
      this.submitButtonTarget.disabled = false
    }
  }

  showAlert(message, type) {
    this.alertTarget.className = `alert alert-${type}`
    this.alertTarget.textContent = message
  }

  clearAlert() {
    this.alertTarget.className = "alert d-none"
    this.alertTarget.textContent = ""
  }
}

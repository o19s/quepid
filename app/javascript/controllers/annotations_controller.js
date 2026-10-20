import { CORE_EVENTS } from "utils/core_events"
import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"
import coreFlash from "utils/core_flash"
import { getCoreStores } from "utils/core_store_access"
import { isSameId } from "utils/record_identity"

const STREAM_TYPE = "text/vnd.turbo-stream.html"

export default class extends Controller {
  static targets = ["message", "createButton", "list", "editModal", "editMessage", "editSave"]
  static values = {
    url: String,
    annotationUrlTemplate: String,
    caseId: Number,
    tryId: Number,
    lastScore: Object
  }

  connect() {
    this.onScoreChange = () => this.updateCreateState()
    this.onEditSubmit = (event) => this.saveEdit(event)
    this.scoringStore = getCoreStores().scoring
    this.unsubscribeScoringStore = this.scoringStore && subscribeToStore(this.scoringStore, { change: this.onScoreChange })
    this.updateCreateState()
  }

  disconnect() {
    this.unsubscribeScoringStore?.()
    this.editForm?.removeEventListener("submit", this.onEditSubmit)
  }

  async create(event) {
    event.preventDefault()
    const message = this.messageTarget.value.trim()
    const score = this.scorePayload()

    if (!score) {
      coreFlash.show("error", "Can't create a new annotation until searches have been run! Please rerun your searches.")
      return
    }

    this.createButtonTarget.disabled = true
    try {
      await this.stream(this.urlValue, "POST", { annotation: { message }, score })
      this.messageTarget.value = ""
      this.notifyScoreConsumers()
      coreFlash.show("success", "New Annotation created successfully!")
    } catch {
      coreFlash.show("error", "Unable to create Annotation.")
    } finally {
      this.updateCreateState()
    }
  }

  openEdit(event) {
    event.preventDefault()
    const annotation = this.findAnnotation(event.currentTarget.dataset.annotationId)
    if (!annotation) return
    this.editingId = annotation.dataset.annotationId
    const modal = this.editModalElement || this.editModalTarget
    this.editModalElement = modal
    this.editMessageElement = modal.querySelector('[data-annotations-target="editMessage"]')
    this.editSaveElement = modal.querySelector('[data-annotations-target="editSave"]')
    this.editForm = modal.querySelector("form")
    // The modal is reparented outside the controller element for Bootstrap's
    // stacking order, so bind its submit directly after locating it.
    this.editForm?.removeEventListener("submit", this.onEditSubmit)
    this.editForm?.addEventListener("submit", this.onEditSubmit)
    // Bootstrap places the backdrop under document.body. Reparenting the modal
    // avoids the east pane's stacking context putting that backdrop above it.
    if (modal.parentElement !== document.body) document.body.appendChild(modal)
    this.editMessageElement.value = annotation.querySelector(".annotation-message").textContent
    this.editModalInstance = getOrCreateBsModal(modal)
    this.editModalInstance?.show()
  }

  async saveEdit(event) {
    event.preventDefault()
    const annotation = this.findAnnotation(this.editingId)
    if (!annotation) return
    const annotationId = annotation.dataset.annotationId

    const editMessage = this.editMessageElement || this.editMessageTarget
    const editSave = this.editSaveElement || this.editSaveTarget
    editSave.disabled = true
    try {
      await this.stream(this.annotationUrl(annotationId), "PUT", { annotation: { message: editMessage.value } })
      this.editModalInstance?.hide()
      this.notifyScoreConsumers()
      coreFlash.show("success", "Annotation updated successfully!")
    } catch {
      coreFlash.show("error", "Unable to update Annotation.")
    } finally {
      editSave.disabled = false
    }
  }

  async delete(event) {
    event.preventDefault()
    const annotation = this.findAnnotation(event.currentTarget.dataset.annotationId)
    if (!annotation) return

    const annotationId = annotation.dataset.annotationId
    try {
      await this.stream(this.annotationUrl(annotationId), "DELETE")
      this.notifyScoreConsumers()
      coreFlash.show("success", "Annotation deleted successfully!")
    } catch {
      coreFlash.show("error", "Unable to delete Annotation.")
    }
  }

  annotationUrl(annotationId) {
    return this.annotationUrlTemplateValue.replaceAll("__ANNOTATION_ID__", String(annotationId))
  }

  scorePayload() {
    const score = this.scoringStore?.caseScore
    const queries = score ? this.scoringStore.snapshot().queryScores : {}
    if (Object.keys(queries).length > 0) {
      return {
        all_rated: score.allRated,
        score: score.score,
        try_id: this.tryIdValue,
        queries
      }
    }
    // No query scored this run (no queries, or every search failed). Like Legacy, fall back to the
    // case's recorded score; a case that has never scored a query has none, so Create is refused.
    if (!score || Object.keys(this.lastScoreValue).length === 0) return null
    return this.lastScoreValue
  }

  updateCreateState() {
    if (this.hasCreateButtonTarget) this.createButtonTarget.disabled = !this.scorePayload()
  }

  notifyScoreConsumers() {
    document.dispatchEvent(new CustomEvent(CORE_EVENTS.ANNOTATIONS_CHANGED, {
      bubbles: true,
      detail: { caseId: this.caseIdValue }
    }))
  }

  rows() {
    return [...this.listTarget.querySelectorAll("li.annotation")]
  }

  findAnnotation(id) {
    return this.rows().find((row) => isSameId(row.dataset.annotationId, id))
  }

  // Rails answers with prepend (create), replace (edit) or remove (delete)
  // streams targeting the list and its rows. Turbo applies them after the next
  // repaint, so the list has not changed yet when this resolves.
  async stream(url, method, body) {
    const headers = { Accept: STREAM_TYPE }
    const options = { method, headers }
    if (body) {
      headers["Content-Type"] = "application/json"
      options.body = JSON.stringify(body)
    }
    const response = await apiFetch(url, options)
    if (!response.ok || response.redirected || !response.headers.get("Content-Type")?.startsWith(STREAM_TYPE)) {
      throw new Error("Unable to save annotation")
    }
    Turbo.renderStreamMessage(await response.text())
  }
}

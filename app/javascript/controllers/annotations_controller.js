import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { deleteJson, getJson, postJson, putJson } from "api/json"
import { getOrCreateBsModal } from "utils/bs_modal"
import coreFlash from "utils/core_flash"
import { getCoreStores } from "utils/core_store_access"
import { formatScore } from "utils/scoring"
import { isSameId } from "utils/record_identity"

export default class extends Controller {
  static targets = ["message", "createButton", "list", "empty", "editModal", "editMessage", "editSave", "itemTemplate"]
  static values = {
    url: String,
    annotationUrlTemplate: String,
    caseId: Number,
    tryId: Number
  }

  connect() {
    this.annotations = []
    this.onScoreChange = () => this.updateCreateState()
    this.onEditSubmit = (event) => this.saveEdit(event)
    this.scoringStore = getCoreStores().scoring
    this.unsubscribeScoringStore = this.scoringStore && subscribeToStore(this.scoringStore, { change: this.onScoreChange })
    this.load()
  }

  disconnect() {
    this.unsubscribeScoringStore?.()
    this.editForm?.removeEventListener("submit", this.onEditSubmit)
  }

  async load() {
    try {
      const data = await getJson(this.urlValue)
      this.annotations = (data.annotations || []).map((annotation) => this.normalize(annotation))
      this.render()
    } catch {
      this.annotations = []
      this.render()
      coreFlash.show("error", "Unable to load annotations.")
    }
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
      const data = await postJson(this.urlValue, { annotation: { message }, score })

      this.annotations.unshift(this.normalize(data))
      this.messageTarget.value = ""
      this.render()
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
    this.editingId = annotation.id
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
    this.editMessageElement.value = annotation.message || ""
    this.editModalInstance = getOrCreateBsModal(modal)
    this.editModalInstance?.show()
  }

  async saveEdit(event) {
    event.preventDefault()
    const annotation = this.findAnnotation(this.editingId)
    if (!annotation) return

    const editMessage = this.editMessageElement || this.editMessageTarget
    const editSave = this.editSaveElement || this.editSaveTarget
    editSave.disabled = true
    try {
      const data = await putJson(this.annotationUrl(annotation.id), { annotation: { message: editMessage.value } })

      const updated = this.normalize(data)
      this.annotations = this.annotations.map((item) => item.id === updated.id ? updated : item)
      this.render()
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

    try {
      await deleteJson(this.annotationUrl(annotation.id))

      this.annotations = this.annotations.filter((item) => item.id !== annotation.id)
      this.render()
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
    if (!score) return null
    return {
      all_rated: score.allRated,
      score: score.score,
      try_id: this.tryIdValue,
      queries: this.scoringStore.snapshot().queryScores
    }
  }

  updateCreateState() {
    if (this.hasCreateButtonTarget) this.createButtonTarget.disabled = !this.scorePayload()
  }

  notifyScoreConsumers() {
    document.dispatchEvent(new CustomEvent("annotations:changed", {
      bubbles: true,
      detail: { caseId: this.caseIdValue }
    }))
  }

  findAnnotation(id) {
    return this.annotations.find((annotation) => isSameId(annotation.id, id))
  }

  normalize(annotation) {
    return {
      ...annotation,
      caseId: annotation.score?.case_id || this.caseIdValue,
      createdAt: annotation.created_at,
      score: annotation.score || {},
      user: annotation.user || {}
    }
  }

  render() {
    this.listTarget.replaceChildren(...this.annotations.map((annotation) => this.renderAnnotation(annotation)))
    this.emptyTarget.classList.toggle("d-none", this.annotations.length > 0)
    this.updateCreateState()
  }

  renderAnnotation(annotation) {
    const item = this.itemTemplateTarget.content.firstElementChild.cloneNode(true)
    const slot = name => item.querySelector(`[data-slot="${name}"]`)
    slot("edit").dataset.annotationId = String(annotation.id)
    slot("delete").dataset.annotationId = String(annotation.id)
    slot("time").textContent = `${this.timeAgo(annotation.createdAt)} - `

    const sources = { user: annotation.user?.name, source: annotation.source }
    Object.entries(sources).forEach(([name, value]) => {
      if (value) slot(name).textContent = `by ${value}`
      else slot(name).remove()
    })

    slot("try").append(annotation.score.try_number ?? annotation.score.try_id ?? "")
    const score = annotation.score.score
    slot("score").append(score == null ? "" : formatScore(score))
    slot("message").textContent = annotation.message || ""
    return item
  }

  timeAgo(value) {
    if (!value) return ""
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const units = [
      ["year", 60 * 60 * 24 * 365],
      ["month", 60 * 60 * 24 * 30],
      ["week", 60 * 60 * 24 * 7],
      ["day", 60 * 60 * 24],
      ["hour", 60 * 60],
      ["minute", 60],
      ["second", 1]
    ]
    const deltaSeconds = Math.round((date.getTime() - Date.now()) / 1000)
    const [unit, seconds] = units.find(([, size]) => Math.abs(deltaSeconds) >= size) || ["second", 1]
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(deltaSeconds / seconds), unit)
  }
}

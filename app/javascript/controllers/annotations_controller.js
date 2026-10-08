import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"
import coreFlash from "utils/core_flash"
import { getCoreStores } from "utils/core_store_access"
import { isSameId } from "utils/record_identity"

export default class extends Controller {
  static targets = ["message", "createButton", "list", "empty", "editModal", "editMessage", "editSave"]
  static values = {
    url: String,
    annotationUrlTemplate: String,
    caseId: Number,
    tryId: Number
  }

  connect() {
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
      this.render(await this.requestRows(this.urlValue))
    } catch {
      this.render([])
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
      const rows = await this.requestRows(this.urlValue, "POST", { annotation: { message }, score })

      this.render([...rows, ...this.rows()])
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
      const rows = await this.requestRows(this.annotationUrl(annotationId), "PUT", { annotation: { message: editMessage.value } })
      this.render(this.rows().flatMap((item) => isSameId(item.dataset.annotationId, annotationId) ? rows : [item]))
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
      await this.requestRows(this.annotationUrl(annotationId), "DELETE")

      this.render(this.rows().filter((item) => !isSameId(item.dataset.annotationId, annotationId)))
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

  rows() {
    return [...this.listTarget.querySelectorAll("li.annotation")]
  }

  findAnnotation(id) {
    return this.rows().find((row) => isSameId(row.dataset.annotationId, id))
  }

  async requestRows(url, method = "GET", body) {
    const headers = { Accept: "text/html" }
    const options = { method, headers }
    if (body) {
      headers["Content-Type"] = "application/json"
      options.body = JSON.stringify(body)
    }
    const response = await apiFetch(url, options)
    if (!response.ok || response.redirected) throw new Error("Unable to load annotation rows")
    if (response.status === 204) return []
    const html = await response.text()
    const document = new DOMParser().parseFromString(html, "text/html")
    const rows = [...document.querySelectorAll("li.annotation")]
    if (method !== "GET" && rows.length !== 1) throw new Error("Missing annotation row")
    return rows
  }

  render(rows) {
    // Rebuild the list as before, preserving create-at-top and edit-in-place order.
    this.listTarget.replaceChildren(...rows.map((row) => row.cloneNode(true)))
    this.listTarget.querySelectorAll(".annotations-time").forEach((time) => {
      time.textContent = `${this.timeAgo(time.dataset.createdAt)} - `
    })
    this.emptyTarget.classList.toggle("d-none", rows.length > 0)
    this.updateCreateState()
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

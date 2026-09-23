import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getOrCreateBsModal } from "utils/bs_modal"
import { showFlash } from "utils/flash"

export default class extends Controller {
  static targets = ["message", "createButton", "list", "empty", "editModal", "editMessage", "editSave"]
  static values = {
    urlTemplate: String,
    caseId: Number,
    tryId: Number
  }

  connect() {
    this.annotations = []
    this.onScoreChange = () => this.updateCreateState()
    this.onEditSubmit = (event) => this.saveEdit(event)
    this.scoringStore = window.quepidStore?.scoring
    this.scoringStore?.addEventListener("change", this.onScoreChange)
    this.load()
  }

  disconnect() {
    this.scoringStore?.removeEventListener("change", this.onScoreChange)
    this.editForm?.removeEventListener("submit", this.onEditSubmit)
  }

  async load() {
    try {
      const response = await apiFetch(this.annotationUrl())
      if (!response.ok) throw new Error(`Unable to load annotations (${response.status})`)
      const data = await response.json()
      this.annotations = (data.annotations || []).map((annotation) => this.normalize(annotation))
      this.render()
    } catch {
      this.annotations = []
      this.render()
      showFlash("error", "Unable to load annotations.")
    }
  }

  async create(event) {
    event.preventDefault()
    const message = this.messageTarget.value.trim()
    const score = this.scorePayload()

    if (!score) {
      showFlash("error", "Can't create a new annotation until searches have been run! Please rerun your searches.")
      return
    }

    this.createButtonTarget.disabled = true
    try {
      const response = await apiFetch(this.annotationUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation: { message }, score })
      })
      if (!response.ok) throw new Error(`Unable to create annotation (${response.status})`)
      this.annotations.unshift(this.normalize(await response.json()))
      this.messageTarget.value = ""
      this.render()
      this.notifyAngular()
      showFlash("success", "New Annotation created successfully!")
    } catch {
      showFlash("error", "Unable to create Annotation.")
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
      const response = await apiFetch(`${this.annotationUrl()}/${annotation.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotation: { message: editMessage.value } })
      })
      if (!response.ok) throw new Error(`Unable to update annotation (${response.status})`)
      const updated = this.normalize(await response.json())
      this.annotations = this.annotations.map((item) => item.id === updated.id ? updated : item)
      this.render()
      this.editModalInstance?.hide()
      this.notifyAngular()
      showFlash("success", "Annotation updated successfully!")
    } catch {
      showFlash("error", "Unable to update Annotation.")
    } finally {
      editSave.disabled = false
    }
  }

  async delete(event) {
    event.preventDefault()
    const annotation = this.findAnnotation(event.currentTarget.dataset.annotationId)
    if (!annotation) return

    try {
      const response = await apiFetch(`${this.annotationUrl()}/${annotation.id}`, { method: "DELETE" })
      if (!response.ok) throw new Error(`Unable to delete annotation (${response.status})`)
      this.annotations = this.annotations.filter((item) => item.id !== annotation.id)
      this.render()
      this.notifyAngular()
      showFlash("success", "Annotation deleted successfully!")
    } catch {
      showFlash("error", "Unable to delete Annotation.")
    }
  }

  annotationUrl() {
    return this.urlTemplateValue.replace("__CASE_ID__", this.caseIdValue)
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

  notifyAngular() {
    document.querySelector("queries")?.dispatchEvent(new CustomEvent("annotations:changed", {
      bubbles: true,
      detail: { caseId: this.caseIdValue }
    }))
  }

  findAnnotation(id) {
    return this.annotations.find((annotation) => String(annotation.id) === String(id))
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
    const item = document.createElement("li")
    item.className = "annotation"

    const menu = document.createElement("div")
    menu.className = "dropdown float-end"
    menu.innerHTML = `<a href="#" role="button" class="dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-list"></i></a>
      <ul class="dropdown-menu"><li><a href="#" class="dropdown-item" data-action="click->annotations#openEdit" data-annotation-id="${annotation.id}"><i class="bi bi-pencil-fill"></i> Edit</a></li>
      <li><a href="#" class="dropdown-item text-danger" data-action="click->annotations#delete" data-annotation-id="${annotation.id}"><i class="bi bi-trash-fill"></i> Delete</a></li></ul>`
    item.appendChild(menu)

    const time = document.createElement("em")
    time.className = "annotations-time"
    time.textContent = `${this.timeAgo(annotation.createdAt)} - `
    item.appendChild(time)

    if (annotation.user?.name) {
      const source = document.createElement("span")
      source.className = "annotation-source"
      source.textContent = `by ${annotation.user.name}`
      item.appendChild(source)
    }

    if (annotation.source) {
      const source = document.createElement("span")
      source.className = "annotation-source"
      source.textContent = `by ${annotation.source}`
      item.appendChild(source)
    }

    const score = document.createElement("div")
    score.innerHTML = `<span class="annotation-try">Try No: </span><i class="bi bi-circle-fill"></i><span class="annotation-score"> Score: </span>`
    score.querySelector(".annotation-try").append(annotation.score.try_id ?? "")
    score.querySelector(".annotation-score").append(annotation.score.score ?? "")
    item.appendChild(score)

    const message = document.createElement("div")
    message.className = "annotation-message"
    message.textContent = annotation.message || ""
    item.appendChild(message)
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

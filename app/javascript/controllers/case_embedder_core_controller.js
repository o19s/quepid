import CoreModalControllerBase from "controllers/core_modal_controller_base"
import { apiFetch } from "api/fetch"
import { CORE_EVENTS } from "utils/core_events"

const POLL_MS = 3000
const STATUS_LABELS = {
  current: "current",
  pending: "pending",
  stale: "outdated",
  failed: "failed"
}

function describe(embedder) {
  const size = embedder.dimensions ? `${embedder.dimensions} dims` : "model default size"
  return `${embedder.provider} · ${embedder.model} · ${size}`
}

/**
 * Picks the case's embedder from the core case toolbar. Laid out like the scorer
 * picker (pick-scorer-core), saving through Api::V1::CaseEmbeddersController and
 * staying on the page.
 *
 * Lives on the modal in shared/_case_embedder_core_modal.html.erb, which owns the
 * URLs and the case id. The case header shows the embedder's name server-side, so a
 * save asks for the header frame again (`quepid:case-header-stale`). The controller
 * also hands every query's vector status to the live query runtime
 * (`quepid:query-vectors-changed`, read by utils/live_query_events) and, while a
 * vectorisation run is queued or under way, polls for progress -- the core page has
 * no ActionCable.
 */
export default class extends CoreModalControllerBase {
  static targets = [
    "title",
    "alert",
    "inaccessibleWarning",
    "list",
    "emptyNotice",
    "submitButton",
    "vectorPanel",
    "vectorSummary",
    "revectorizeButton"
  ]

  static values = {
    id: String,
    indexUrlTemplate: String,
    updateUrlTemplate: String,
    vectorizeUrlTemplate: String
  }

  // A run may already be under way when the page loads (the statuses themselves
  // arrive with the queries).
  connect() {
    if (this.idValue) this.poll()
  }

  disconnect() {
    clearTimeout(this.pollTimer)
  }

  async poll() {
    try {
      this.applyState(await this.fetchState(this.idValue))
    } catch {
      // A failed poll leaves the page as it was; the next save or reload tries again.
    }
  }

  applyState(state) {
    if (state?.vectors) {
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.QUERY_VECTORS_CHANGED, {
          detail: { caseId: Number(this.idValue), queries: state.vectors.queries }
        })
      )
    }

    clearTimeout(this.pollTimer)
    if (state?.vectors?.running) this.pollTimer = setTimeout(() => this.poll(), POLL_MS)
  }

  async openFor(trigger) {
    this.caseId = this.triggerValue(trigger, "id") || this.idValue
    this.selectedId = null
    this.clearAlert()
    this.listTarget.replaceChildren()
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
    embedders.forEach((embedder) => items.push({ ...embedder, detail: describe(embedder) }))
    // A teammate may have picked one that isn't shared with you: still show it as current.
    if (current && !current.accessible) items.push({ ...current, detail: describe(current) })

    this.listTarget.replaceChildren(
      ...items.map((item) => {
        const button = document.createElement("button")
        button.type = "button"
        button.className = "list-group-item list-group-item-action"
        button.dataset.embedderId = item.embedder_id
        button.dataset.action = "click->case-embedder-core#select"
        const name = document.createElement("div")
        name.textContent = item.name
        const detail = document.createElement("small")
        detail.className = "text-muted"
        detail.textContent = item.detail
        button.append(name, detail)
        return button
      })
    )

    this.emptyNoticeTarget.classList.toggle("d-none", embedders.length > 0)

    const warning = this.inaccessibleWarningTarget
    warning.classList.toggle("d-none", !current || current.accessible)
    if (current && !current.accessible) {
      warning.textContent =
        `The embedder ${current.name} used by this case is NOT shared via a team with you, ` +
        "so if you switch away from it you won't have access to it again."
    }

    this.highlight()
    this.renderVectors()
  }

  // "18 current · 2 pending" plus the Re-vectorize button, for a case with an embedder.
  renderVectors() {
    const vectors = this.state?.vectors
    const show = Boolean(this.state?.embedder && vectors)
    this.vectorPanelTarget.hidden = !show
    if (!show) return

    const counts = Object.entries(STATUS_LABELS)
      .filter(([status]) => vectors.counts?.[status])
      .map(([status, label]) => `${vectors.counts[status]} ${label}`)
    const summary = counts.length > 0 ? counts.join(" · ") : "No queries yet"
    this.vectorSummaryTarget.textContent = vectors.running ? `${summary} — vectorising…` : summary
    this.revectorizeButtonTarget.disabled = Boolean(vectors.running)
  }

  async revectorize() {
    this.clearAlert()
    this.revectorizeButtonTarget.disabled = true

    try {
      const url = this.vectorizeUrlTemplateValue.replaceAll("__CASE_ID__", this.caseId)
      const response = await apiFetch(`${url}?force=true`, {
        method: "POST",
        headers: { Accept: "application/json" }
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Unable to re-vectorize (${response.status})`)

      this.state = data
      this.renderVectors()
      this.applyState(data)
    } catch (error) {
      this.showAlert(error.message, "danger")
      this.revectorizeButtonTarget.disabled = false
    }
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
      this.applyState(data)
      document.dispatchEvent(
        new CustomEvent(CORE_EVENTS.CASE_HEADER_STALE, {
          detail: { caseNo: Number(this.caseId), reason: "embedder" }
        })
      )
      this.hide()
    } catch (error) {
      this.showAlert(error.message, "danger")
      this.submitButtonTarget.disabled = false
    }
  }
}

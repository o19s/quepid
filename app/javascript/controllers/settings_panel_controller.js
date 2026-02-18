import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { getQuepidRootUrl, buildApiUrl } from "utils/quepid_root"

// Toggles the settings panel and handles saving try query params.
// Replaces SettingsCtrl and CurrSettingsCtrl.
export default class extends Controller {
  static values = { caseId: Number, tryNumber: Number, curatorVars: Object }
  static targets = ["trigger", "panel", "paramsForm", "queryParams", "escapeQuery", "numberOfRows", "curatorVarsContainer"]

  connect() {
    this._renderCuratorVarInputs()
  }

  toggle() {
    if (!this.hasPanelTarget) return
    const el = this.panelTarget
    const bsCollapse = window.bootstrap?.Collapse
    if (bsCollapse) {
      const instance = bsCollapse.getInstance(el) ?? new bsCollapse(el, { toggle: true })
      instance.toggle()
    } else {
      el.classList.toggle("show")
    }
  }

  extractVars() {
    this._renderCuratorVarInputs()
  }

  async duplicateTry(event) {
    const tryNumber = event.currentTarget.dataset.tryNumber
    if (!tryNumber || !this.caseIdValue) return

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", this.caseIdValue, "tries")
      const res = await apiFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ parent_try_number: tryNumber, try: {} })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Duplicate failed (${res.status})`)
      }
      const data = await res.json()
      const newTryNumber = data.try_number
      window.location.href = `${root}case/${this.caseIdValue}/try/${newTryNumber}`
    } catch (err) {
      console.error("Duplicate try failed:", err)
      if (window.flash) window.flash.error = err.message
    }
  }

  async deleteTry(event) {
    const tryNumber = event.currentTarget.dataset.tryNumber
    if (!tryNumber || !this.caseIdValue) return
    if (!confirm(`Delete Try ${tryNumber}? This cannot be undone.`)) return

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", this.caseIdValue, "tries", tryNumber)
      const res = await apiFetch(url, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      })
      if (!res.ok && res.status !== 204) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Delete failed (${res.status})`)
      }
      window.location.reload()
    } catch (err) {
      console.error("Delete try failed:", err)
      if (window.flash) window.flash.error = err.message
    }
  }

  async saveParams(event) {
    event.preventDefault()

    if (!this.caseIdValue || !this.tryNumberValue) return

    const curatorVars = this._collectCuratorVars()
    const body = {
      try: {
        query_params: this.hasQueryParamsTarget ? this.queryParamsTarget.value : "",
        escape_query: this.hasEscapeQueryTarget ? this.escapeQueryTarget.checked : false,
        number_of_rows: this.hasNumberOfRowsTarget ? parseInt(this.numberOfRowsTarget.value, 10) || 10 : 10
      }
    }
    if (Object.keys(curatorVars).length > 0) {
      body.curator_vars = curatorVars
    }

    try {
      const root = getQuepidRootUrl()
      const url = buildApiUrl(root, "cases", this.caseIdValue, "tries", this.tryNumberValue)

      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || data.message || `Update failed (${res.status})`)
      }

      // Try params change means all searches need re-running
      window.location.reload()
    } catch (err) {
      console.error("Save query params failed:", err)
      if (window.flash) window.flash.error = err.message
    }
  }

  // Extract ##varName## placeholders from query params text
  _extractCuratorVars() {
    if (!this.hasQueryParamsTarget) return []
    const text = this.queryParamsTarget.value || ""
    const regex = /##([^#]+?)##/g
    const vars = []
    const seen = new Set()
    let match
    while ((match = regex.exec(text)) !== null) {
      const name = match[1]
      if (!seen.has(name)) {
        seen.add(name)
        vars.push(name)
      }
    }
    return vars
  }

  // Render labeled inputs for each curator variable found in query params
  _renderCuratorVarInputs() {
    if (!this.hasCuratorVarsContainerTarget) return
    const varNames = this._extractCuratorVars()
    if (varNames.length === 0) {
      this.curatorVarsContainerTarget.innerHTML = ""
      return
    }

    const savedVars = this.curatorVarsValue || {}
    const html = varNames.map(name => {
      const value = savedVars[name] ?? ""
      const escapedName = name.replace(/"/g, "&quot;").replace(/</g, "&lt;")
      const escapedValue = String(value).replace(/"/g, "&quot;").replace(/</g, "&lt;")
      return `
        <div class="mb-2">
          <label class="form-label small text-muted mb-1">
            <code>##${escapedName}##</code>
          </label>
          <input type="text" class="form-control form-control-sm"
                 data-curator-var-name="${escapedName}" value="${escapedValue}">
        </div>
      `
    }).join("")

    this.curatorVarsContainerTarget.innerHTML = `
      <h6 class="card-title mt-2 small text-muted">Curator variables</h6>
      ${html}
    `
  }

  // Collect current curator variable values from the rendered inputs
  _collectCuratorVars() {
    if (!this.hasCuratorVarsContainerTarget) return {}
    const inputs = this.curatorVarsContainerTarget.querySelectorAll("[data-curator-var-name]")
    const vars = {}
    inputs.forEach(input => {
      vars[input.dataset.curatorVarName] = input.value
    })
    return vars
  }
}

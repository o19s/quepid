// Handles the "Custom Headers" modal: edit JSON headers for the search endpoint.
// Replaces Angular CustomHeadersCtrl. Uses PUT api/search_endpoints/:id.
import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { buildApiUrl, getQuepidRootUrl } from "utils/quepid_root"

export default class extends Controller {
  static values = { searchEndpointId: Number }
  static targets = ["modal", "trigger", "typeSelect", "jsonInput", "submitBtn", "validationError", "initialValue"]

  connect() {
    this._modal = null
  }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  open(event) {
    event.preventDefault()
    if (!this._modal) {
      const el = this.modalTarget
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el)
    }
    if (this.hasJsonInputTarget) {
      const initial = this.hasInitialValueTarget ? this.initialValueTarget.content.textContent : "{}"
      this.jsonInputTarget.value = this._parseAndPretty((initial || "").trim() || "{}")
      this.jsonInputTarget.readOnly = this.jsonInputTarget.value.trim() === ""
    }
    this._syncTypeFromContent()
    this._clearValidation()
    this._modal.show()
  }

  _syncTypeFromContent() {
    if (!this.hasTypeSelectTarget || !this.hasJsonInputTarget) return
    const raw = this.jsonInputTarget.value.trim()
    if (!raw) {
      this.typeSelectTarget.value = "None"
      return
    }
    if (raw.toLowerCase().includes("apikey")) {
      this.typeSelectTarget.value = "API Key"
    } else {
      this.typeSelectTarget.value = "Custom"
    }
  }

  typeChanged(event) {
    const type = event.target.value
    if (!this.hasJsonInputTarget) return
    if (type === "None") {
      this.jsonInputTarget.value = ""
      this.jsonInputTarget.readOnly = true
    } else {
      this.jsonInputTarget.readOnly = false
      if (type === "API Key") {
        this.jsonInputTarget.value = '{\n  "Authorization": "ApiKey XXX"\n}'
      } else {
        this.jsonInputTarget.value = '{\n  "KEY": "VALUE"\n}'
      }
    }
    this._clearValidation()
  }

  _parseAndPretty(str) {
    if (!str || str.trim() === "") return "{}"
    try {
      const parsed = JSON.parse(str)
      return typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed, null, 2) : str
    } catch {
      return str
    }
  }

  validate() {
    this._clearValidation()
    if (!this.hasJsonInputTarget) return
    const raw = this.jsonInputTarget.value.trim()
    if (raw === "") return
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        this._showValidation("Headers must be a JSON object.")
      }
    } catch {
      this._showValidation("Please provide valid JSON.")
    }
  }

  _clearValidation() {
    if (this.hasJsonInputTarget) this.jsonInputTarget.classList.remove("is-invalid")
    if (this.hasValidationErrorTarget) this.validationErrorTarget.textContent = "Please provide valid JSON."
  }

  _showValidation(message) {
    if (this.hasJsonInputTarget) this.jsonInputTarget.classList.add("is-invalid")
    if (this.hasValidationErrorTarget) this.validationErrorTarget.textContent = message || "Please provide valid JSON."
  }

  async save(event) {
    event.preventDefault()
    const raw = this.hasJsonInputTarget ? this.jsonInputTarget.value.trim() : ""
    let parsed
    if (raw === "") {
      parsed = {}
    } else {
      try {
        parsed = JSON.parse(raw)
      } catch {
        this._showValidation("Please provide valid JSON.")
        return
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        this._showValidation("Headers must be a JSON object.")
        return
      }
    }

    this._clearValidation()
    if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = true

    const url = buildApiUrl(this.rootUrl, "search_endpoints", this.searchEndpointIdValue)

    try {
      const res = await apiFetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          search_endpoint: {
            custom_headers: Object.keys(parsed).length > 0 ? parsed : ""
          }
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }

      if (window.flash) window.flash.success = "Custom headers saved successfully."
      this._modal?.hide()
    } catch (err) {
      console.error("Save custom headers failed:", err)
      this._showValidation(err.message || "Unable to save custom headers.")
    } finally {
      if (this.hasSubmitBtnTarget) this.submitBtnTarget.disabled = false
    }
  }
}

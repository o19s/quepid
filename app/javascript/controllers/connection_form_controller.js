import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

// Connection form (app/views/connections/_form.html.erb): fills in a service's defaults when the
// service changes, shows only the fields the chosen authentication needs, and runs the Check
// connection button against Connections::ChecksController with the form's current values.
//
// presets come from ConnectionService.presets, keyed by service.
export default class extends Controller {
  static values = { presets: Object, checkUrl: String }

  static targets = [
    "name",
    "service",
    "baseUrl",
    "apiVersionRow",
    "apiVersion",
    "authScheme",
    "authHeaderRow",
    "authHeader",
    "secretRow",
    "secretLabel",
    "secretHint",
    "help",
    "checkButton",
    "checkResult"
  ]

  connect() {
    this.refresh()
  }

  get preset() {
    return this.presetsValue[this.serviceTarget.value] || {}
  }

  // Switching service replaces the URL and how the key is sent with its defaults: values typed
  // for one vendor are almost never right for another.
  changeService() {
    const preset = this.preset
    this.baseUrlTarget.value = preset.base_url || ""
    this.authSchemeTarget.value = preset.auth_scheme || "bearer"
    this.authHeaderTarget.value = preset.auth_header || ""
    this.apiVersionTarget.value = preset.api_version || ""
    this.refresh()
  }

  refresh() {
    const preset = this.preset
    const scheme = this.authSchemeTarget.value

    // The name a blank one becomes, shown as the placeholder so it is no surprise on save.
    if (this.hasNameTarget) this.nameTarget.placeholder = `${preset.label || "Service"} Connection`

    this.helpTargets.forEach((help) => {
      help.hidden = help.dataset.service !== this.serviceTarget.value
    })
    this.apiVersionRowTarget.hidden = !preset.uses_api_version
    this.authHeaderRowTarget.hidden = scheme !== "header"
    this.secretRowTarget.hidden = scheme === "none"
    this.secretLabelTarget.textContent = scheme === "basic" ? "User:password" : "Key"

    const required = preset.requires_secret ? `Required for ${preset.label}.` : "Optional."
    this.secretHintTarget.textContent =
      scheme === "basic" ? `${required} Written as user:password.` : required
  }

  async check(event) {
    event.preventDefault()

    const data = new FormData(this.element.closest("form"))
    // The edit form overrides its method to PATCH; the check endpoint is a POST.
    data.delete("_method")

    this.setButtonLoading(this.checkButtonTarget, true)
    this.checkResultTarget.replaceChildren()

    try {
      const response = await apiFetch(this.checkUrlValue, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)

      const tone = { ok: "success", reachable: "warning" }[result.status] || "danger"
      const timing = result.elapsed_ms === null ? "" : ` (${result.elapsed_ms} ms)`
      const alert = document.createElement("div")
      alert.className = `alert alert-${tone} small mb-0`
      alert.textContent = `${result.message}${timing}`
      this.checkResultTarget.replaceChildren(alert)
    } catch (error) {
      const alert = document.createElement("div")
      alert.className = "alert alert-danger small mb-0"
      alert.textContent = error.message
      this.checkResultTarget.replaceChildren(alert)
    } finally {
      this.setButtonLoading(this.checkButtonTarget, false)
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true
      this.buttonContent = [...button.childNodes]
      const spinner = document.createElement("span")
      spinner.className = "spinner-border spinner-border-sm"
      spinner.setAttribute("role", "status")
      spinner.setAttribute("aria-hidden", "true")
      button.replaceChildren(spinner, " Loading...")
    } else {
      button.disabled = false
      if (this.buttonContent) button.replaceChildren(...this.buttonContent)
    }
  }
}

import { Controller } from "@hotwired/stimulus"
import { element, showMatchingHelp } from "utils/dom"
import { runCheck } from "utils/run_check"

// Connection form (app/views/connections/_form.html.erb): fills in a provider's defaults when the
// provider changes, shows only the fields the chosen authentication needs, and runs the Check
// connection button against Connections::ChecksController with the form's current values.
//
// presets come from ConnectionProvider.presets, keyed by provider.
export default class extends Controller {
  static values = { presets: Object, checkUrl: String }

  static targets = [
    "name",
    "provider",
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
    return this.presetsValue[this.providerTarget.value] || {}
  }

  // Switching provider replaces the URL and how the key is sent with its defaults: values typed
  // for one vendor are almost never right for another.
  changeProvider() {
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
    if (this.hasNameTarget) this.nameTarget.placeholder = `${preset.label || "Provider"} Connection`

    showMatchingHelp(this.helpTargets, "provider", this.providerTarget.value)
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

    await runCheck(this.checkUrlValue, data, {
      checkResultTarget: this.checkResultTarget,
      checkButtonTarget: this.checkButtonTarget,
      onSuccess: (result, checkResultTarget) => {
        const tone = { ok: "success", reachable: "warning" }[result.status] || "danger"
        const timing = result.elapsed_ms === null ? "" : ` (${result.elapsed_ms} ms)`
        checkResultTarget.replaceChildren(
          element("div", {
            className: `alert alert-${tone} small mb-0`,
            text: `${result.message}${timing}`
          })
        )
      }
    })
  }
}

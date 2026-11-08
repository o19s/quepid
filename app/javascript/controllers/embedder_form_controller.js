import { Controller } from "@hotwired/stimulus"
import { element, showMatchingHelp } from "utils/dom"
import { runCheck } from "utils/run_check"

// Embedder form (app/views/embedders/_form.html.erb): shows only the fields the chosen
// provider can use, fills in its defaults when the provider changes, and runs the Check connection
// button against Embedders::ConnectionChecksController with the form's current values.
//
// The URL, key and timeout come from the embedder's Connection, so they aren't on this form. The
// The connection's provider determines the model and provider-specific settings.
//
// presets come from EmbedderProvider.presets, keyed by provider.
export default class extends Controller {
  static values = { presets: Object, checkUrl: String, newConnectionUrl: String }

  static targets = [
    "connection",
    "connectionInfo",
    "noConnections",
    "newConnectionLink",
    "provider",
    "model",
    "truncation",
    "truncationHint",
    "dimensionsRow",
    "dimensions",
    "dimensionsHint",
    "instructionFields",
    "noInstructions",
    "help",
    "checkText",
    "checkButton",
    "checkHint",
    "checkResult"
  ]

  connect() {
    this.refresh()
  }

  get preset() {
    return this.presetsValue[this.providerTarget.value] || {}
  }

  // The chosen connection's option, or null while none is chosen.
  get connection() {
    if (!this.hasConnectionTarget) return null
    const value = this.connectionTarget.value
    if (!value) return null
    return [...this.connectionTarget.options].find((option) => option.value === value) || null
  }

  changeConnection() {
    const provider = this.connection?.dataset.provider || ""
    const providerChanged = provider !== this.providerTarget.value
    this.providerTarget.value = provider

    if (providerChanged && provider) this.applyProviderDefaults()

    this.refresh()
  }

  // A different provider usually needs a different model and may not support native truncation.
  applyProviderDefaults() {
    const preset = this.preset
    this.modelTarget.value = preset.model || ""
    if (!preset.supports_dimensions && this.truncationTarget.value === "native") {
      this.truncationTarget.value = "none"
    }
    this.refresh()
  }

  refresh() {
    const preset = this.preset

    showMatchingHelp(this.helpTargets, "provider", this.providerTarget.value)
    this.refreshConnection()
    this.instructionFieldsTarget.hidden =
      !this.providerTarget.value || !preset.supports_instructions
    if (this.hasNoInstructionsTarget) {
      this.noInstructionsTarget.hidden =
        !this.providerTarget.value || Boolean(preset.supports_instructions)
    }

    const nativeOption = this.truncationTarget.querySelector("option[value='native']")
    if (nativeOption) nativeOption.disabled = !preset.supports_dimensions

    const truncation = this.truncationTarget.value
    this.dimensionsRowTarget.hidden = truncation === "none"
    this.truncationHintTarget.textContent =
      truncation === "client"
        ? "Only correct for Matryoshka-trained models (e.g. OpenAI text-embedding-3, Qwen3-Embedding, nomic-embed-text v1.5)."
        : ""

    const allowed = preset.allowed_dimensions || []
    this.dimensionsHintTarget.textContent =
      truncation === "native" && allowed.length > 0
        ? `${preset.label} accepts ${allowed.join(", ")}.`
        : ""
  }

  refreshConnection() {
    if (!this.hasConnectionTarget) return

    const connection = this.connection
    const anyToPick = [...this.connectionTarget.options].some((option) => option.value)

    if (this.hasNoConnectionsTarget) this.noConnectionsTarget.hidden = anyToPick
    if (this.hasNewConnectionLinkTarget) {
      this.newConnectionLinkTarget.textContent = "Create a connection"
      this.newConnectionLinkTarget.href = this.newConnectionUrlValue
    }
    // There is nothing to check without a connection: the check goes through it.
    this.checkButtonTarget.disabled = connection === null
    if (this.hasCheckHintTarget) this.checkHintTarget.hidden = connection !== null

    if (!this.hasConnectionInfoTarget) return

    this.connectionInfoTarget.hidden = connection === null
    if (connection) {
      this.connectionInfoTarget.textContent = `${connection.dataset.providerLabel} at ${connection.dataset.url}. The URL, key and timeout come from this connection.`
    }
  }

  async check(event) {
    event.preventDefault()

    const form = this.element.closest("form")
    const data = new FormData(form)
    // The edit form overrides its method to PATCH; the connection check endpoint is a POST.
    data.delete("_method")
    data.set("text", this.checkTextTarget.value)

    await runCheck(this.checkUrlValue, data, {
      checkResultTarget: this.checkResultTarget,
      checkButtonTarget: this.checkButtonTarget,
      onSuccess: (result, checkResultTarget) => {
        const preview = result.preview.map((value) => value.toFixed(5)).join(", ")
        const ellipsis = result.dimensions > result.preview.length ? ", …" : ""
        const sent = element("code", { className: "text-break", text: result.input })
        sent.style.whiteSpace = "pre-wrap"
        checkResultTarget.replaceChildren(
          element("div", { className: "alert alert-success small mb-0" }, [
            element("div", {}, [
              element("strong", { text: `${result.dimensions} dimensions` }),
              ` in ${result.elapsed_ms} ms`
            ]),
            element("div", {}, ["Sent: ", sent]),
            element("div", {}, ["Vector: ", element("code", { text: `[${preview}${ellipsis}]` })])
          ])
        )
      }
    })
  }
}

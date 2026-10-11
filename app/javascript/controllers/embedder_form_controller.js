import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { setButtonLoading, escapeHtml } from "utils/stimulus_ui"

// Embedder form (app/views/embedders/_form.html.erb): shows only the fields the chosen
// provider can use, fills in its defaults when the provider changes, and runs the Test
// button against Embedders::TestsController with the form's current values.
//
// presets come from EmbedderProvider.presets, keyed by provider.
export default class extends Controller {
  static values = { presets: Object, testUrl: String }

  static targets = [
    "provider",
    "serviceUrl",
    "model",
    "apiKeyRow",
    "apiKeyHint",
    "truncation",
    "truncationHint",
    "dimensionsRow",
    "dimensions",
    "dimensionsHint",
    "instructionFields",
    "help",
    "testText",
    "testButton",
    "testResult"
  ]

  connect() {
    this.refresh()
  }

  get preset() {
    return this.presetsValue[this.providerTarget.value] || {}
  }

  // Switching provider replaces URL and model with its defaults: values typed for one
  // vendor are almost never right for another.
  changeProvider() {
    const preset = this.preset
    this.serviceUrlTarget.value = preset.service_url || ""
    this.modelTarget.value = preset.model || ""
    if (!preset.supports_dimensions && this.truncationTarget.value === "native") {
      this.truncationTarget.value = "none"
    }
    this.refresh()
  }

  refresh() {
    const preset = this.preset

    this.helpTarget.innerHTML = preset.help || ""
    this.apiKeyRowTarget.hidden = preset.uses_key === false
    if (this.hasApiKeyHintTarget) {
      this.apiKeyHintTarget.textContent = preset.requires_key ? `Required for ${preset.label}.` : "Optional."
    }
    this.instructionFieldsTarget.hidden = !preset.supports_instructions

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
      truncation === "native" && allowed.length > 0 ? `${preset.label} accepts ${allowed.join(", ")}.` : ""
  }

  async test(event) {
    event.preventDefault()

    const form = this.element.closest("form")
    const data = new FormData(form)
    // The edit form overrides its method to PATCH; the test endpoint is a POST.
    data.delete("_method")
    data.set("text", this.testTextTarget.value)

    setButtonLoading(this.testButtonTarget, true)
    this.testResultTarget.innerHTML = ""

    try {
      const response = await apiFetch(this.testUrlValue, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)

      const preview = result.preview.map((value) => value.toFixed(5)).join(", ")
      this.testResultTarget.innerHTML =
        "<div class=\"alert alert-success small mb-0\">" +
        `<div><strong>${escapeHtml(String(result.dimensions))} dimensions</strong> in ${escapeHtml(String(result.elapsed_ms))} ms</div>` +
        `<div>Sent: <code class="text-break" style="white-space: pre-wrap">${escapeHtml(result.input)}</code></div>` +
        `<div>Vector: <code>[${escapeHtml(preview)}, …]</code></div>` +
        "</div>"
    } catch (error) {
      this.testResultTarget.innerHTML =
        `<div class="alert alert-danger small mb-0">${escapeHtml(error.message)}</div>`
    } finally {
      setButtonLoading(this.testButtonTarget, false)
    }
  }
}

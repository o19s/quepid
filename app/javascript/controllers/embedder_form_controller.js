import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

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

    this.helpTargets.forEach((help) => {
      help.hidden = help.dataset.provider !== this.providerTarget.value
    })
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

    this.setButtonLoading(this.testButtonTarget, true)
    this.testResultTarget.replaceChildren()

    try {
      const response = await apiFetch(this.testUrlValue, {
        method: "POST",
        headers: { Accept: "application/json" },
        body: data
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`)

      const preview = result.preview.map((value) => value.toFixed(5)).join(", ")
      const sent = element("code", { className: "text-break", text: result.input })
      sent.style.whiteSpace = "pre-wrap"
      this.testResultTarget.replaceChildren(
        element("div", { className: "alert alert-success small mb-0" }, [
          element("div", {}, [element("strong", { text: `${result.dimensions} dimensions` }), ` in ${result.elapsed_ms} ms`]),
          element("div", {}, ["Sent: ", sent]),
          element("div", {}, ["Vector: ", element("code", { text: `[${preview}, …]` })])
        ])
      )
    } catch (error) {
      this.testResultTarget.replaceChildren(
        element("div", { className: "alert alert-danger small mb-0", text: error.message })
      )
    } finally {
      this.setButtonLoading(this.testButtonTarget, false)
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true
      this.buttonContent = [...button.childNodes]
      const spinner = element("span", { className: "spinner-border spinner-border-sm" })
      spinner.setAttribute("role", "status")
      spinner.setAttribute("aria-hidden", "true")
      button.replaceChildren(spinner, " Loading...")
    } else {
      button.disabled = false
      if (this.buttonContent) button.replaceChildren(...this.buttonContent)
    }
  }
}

function element(tag, { className, text } = {}, children = []) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  node.append(...children)
  return node
}

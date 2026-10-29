import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

// Embedder form (app/views/embedders/_form.html.erb): shows only the fields the chosen
// provider can use, fills in its defaults when the provider changes, and runs the Check connection
// button against Embedders::ConnectionChecksController with the form's current values.
//
// The URL, key and timeout come from the embedder's Connection, so they aren't on this form. A
// connection is for one provider, so the connection list only offers the ones for the chosen
// provider (each option carries its service, URL and label as data), and when there are none a
// link offers to create one for that provider.
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
    this.refresh()
  }

  // Switching provider replaces the model with its default: a model typed for one vendor is
  // almost never right for another.
  changeProvider() {
    const preset = this.preset
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
    this.refreshConnection()
    this.instructionFieldsTarget.hidden = !preset.supports_instructions
    if (this.hasNoInstructionsTarget)
      this.noInstructionsTarget.hidden = Boolean(preset.supports_instructions)

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

  // Only the connections for the chosen provider can be picked. One that no longer fits the
  // provider (it was changed after choosing) is dropped, so the form never posts a mismatch.
  // With none to pick, a link offers to create one for this provider.
  filterConnections() {
    if (!this.hasConnectionTarget) return

    const provider = this.providerTarget.value
    ;[...this.connectionTarget.options].forEach((option) => {
      if (!option.value) return
      const fits = option.dataset.service === provider
      option.hidden = !fits
      option.disabled = !fits
    })
    if (this.connection?.disabled) this.connectionTarget.value = ""
  }

  refreshConnection() {
    this.filterConnections()
    if (!this.hasConnectionTarget) return

    const connection = this.connection
    const anyToPick = [...this.connectionTarget.options].some(
      (option) => option.value && !option.disabled
    )

    if (this.hasNoConnectionsTarget) this.noConnectionsTarget.hidden = anyToPick
    if (this.hasNewConnectionLinkTarget) {
      const label = this.preset.label || this.providerTarget.value
      this.newConnectionLinkTarget.textContent = `Create a ${label} connection`
      this.newConnectionLinkTarget.href = `${this.newConnectionUrlValue}?service=${encodeURIComponent(this.providerTarget.value)}`
    }
    // There is nothing to check without a connection: the check goes through it.
    this.checkButtonTarget.disabled = connection === null
    if (this.hasCheckHintTarget) this.checkHintTarget.hidden = connection !== null

    if (!this.hasConnectionInfoTarget) return

    this.connectionInfoTarget.hidden = connection === null
    if (connection) {
      this.connectionInfoTarget.textContent = `${connection.dataset.serviceLabel} at ${connection.dataset.url}. The URL, key and timeout come from this connection.`
    }
  }

  async check(event) {
    event.preventDefault()

    const form = this.element.closest("form")
    const data = new FormData(form)
    // The edit form overrides its method to PATCH; the connection check endpoint is a POST.
    data.delete("_method")
    data.set("text", this.checkTextTarget.value)

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

      const preview = result.preview.map((value) => value.toFixed(5)).join(", ")
      const sent = element("code", { className: "text-break", text: result.input })
      sent.style.whiteSpace = "pre-wrap"
      this.checkResultTarget.replaceChildren(
        element("div", { className: "alert alert-success small mb-0" }, [
          element("div", {}, [
            element("strong", { text: `${result.dimensions} dimensions` }),
            ` in ${result.elapsed_ms} ms`
          ]),
          element("div", {}, ["Sent: ", sent]),
          element("div", {}, ["Vector: ", element("code", { text: `[${preview}, …]` })])
        ])
      )
    } catch (error) {
      this.checkResultTarget.replaceChildren(
        element("div", { className: "alert alert-danger small mb-0", text: error.message })
      )
    } finally {
      this.setButtonLoading(this.checkButtonTarget, false)
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

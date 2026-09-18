import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"

// Provider presets for auto-filling URL/model/API version and the help text
// shown beside the structured fields.
const PROVIDER_PRESETS = {
  openai: {
    llmServiceUrl: "https://api.openai.com",
    llmApiVersion: "",
    llmModel: "gpt-4o",
    help:
      "<strong>OpenAI</strong> &mdash; Direct API access.<br>" +
      "<b>URL:</b> <code>https://api.openai.com</code><br>" +
      "<b>Model:</b> e.g. <code>gpt-4o</code>, <code>gpt-4.1</code><br>" +
      "<b>Key:</b> Your OpenAI API key (starts with <code>sk-</code>)<br>" +
      "<b>API Version:</b> Leave blank"
  },
  azure_openai: {
    llmServiceUrl: "https://RESOURCE.openai.azure.com",
    llmApiVersion: "",
    llmModel: "gpt-4.1",
    help:
      "<strong>Azure OpenAI</strong> &mdash; OpenAI models hosted on Azure.<br>" +
      "<b>URL:</b> <code>https://YOUR-RESOURCE.openai.azure.com</code><br>" +
      "<b>Model:</b> Your deployment name, e.g. <code>gpt-4.1</code>, <code>gpt-5.1</code><br>" +
      "<b>Key:</b> Azure resource API key<br>" +
      "<b>API Version:</b> Set to use deployment-based routing " +
      "(e.g. <code>2024-12-01-preview</code>), or leave blank for <code>/openai/v1/</code> path"
  },
  azure_ai_foundry: {
    llmServiceUrl: "https://RESOURCE.services.ai.azure.com",
    llmApiVersion: "2025-01-01-preview",
    llmModel: "gpt-4o",
    help:
      "<strong>Azure AI Foundry</strong> &mdash; Unified Azure AI endpoint.<br>" +
      "<b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com</code><br>" +
      "<b>Model:</b> Model name, e.g. <code>gpt-4o</code><br>" +
      "<b>Key:</b> Azure AI services key<br>" +
      "<b>API Version:</b> Defaults to <code>2025-01-01-preview</code>"
  },
  azure_ai_foundry_serverless: {
    llmServiceUrl: "https://MODEL-NAME.REGION.models.ai.azure.com",
    llmApiVersion: "",
    llmModel: "",
    help:
      "<strong>Azure AI Foundry (Serverless)</strong> &mdash; Models-as-a-Service pay-per-token endpoint.<br>" +
      "<b>URL:</b> <code>https://MODEL-NAME.REGION.models.ai.azure.com</code><br>" +
      "<b>Model:</b> Model name from the deployment<br>" +
      "<b>Key:</b> Serverless endpoint key<br>" +
      "<b>API Version:</b> Leave blank"
  },
  azure_ai_foundry_anthropic: {
    llmServiceUrl: "https://RESOURCE.services.ai.azure.com/anthropic",
    llmApiVersion: "",
    llmModel: "claude-3-5-haiku-20241022",
    help:
      "<strong>Azure AI Foundry (Anthropic)</strong> &mdash; Claude models via Azure using the native Anthropic Messages API.<br>" +
      "<b>URL:</b> <code>https://YOUR-RESOURCE.services.ai.azure.com/anthropic</code><br>" +
      "<b>Model:</b> e.g. <code>claude-3-5-haiku-20241022</code><br>" +
      "<b>Key:</b> Azure AI services key (sent as <code>x-api-key</code> header)<br>" +
      "<b>API Version:</b> Leave blank (the <code>anthropic-version</code> header is set automatically)"
  },
  anthropic: {
    llmServiceUrl: "https://api.anthropic.com",
    llmApiVersion: "",
    llmModel: "claude-sonnet-4-5-20250514",
    help:
      "<strong>Anthropic</strong> &mdash; Direct Anthropic API access.<br>" +
      "<b>URL:</b> <code>https://api.anthropic.com</code><br>" +
      "<b>Model:</b> e.g. <code>claude-opus-4-6</code>, <code>claude-sonnet-4-5-20250514</code><br>" +
      "<b>Key:</b> Your Anthropic API key (sent as <code>x-api-key</code> header)<br>" +
      "<b>API Version:</b> Leave blank"
  },
  google_gemini: {
    llmServiceUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    llmApiVersion: "",
    llmModel: "gemini-2.0-flash",
    help:
      "<strong>Google Gemini</strong> &mdash; Uses the OpenAI-compatible endpoint.<br>" +
      "<b>URL:</b> <code>https://generativelanguage.googleapis.com/v1beta/openai</code><br>" +
      "<b>Model:</b> e.g. <code>gemini-2.0-flash</code><br>" +
      "<b>Key:</b> Your Google AI API key<br>" +
      "<b>API Version:</b> Leave blank"
  },
  ollama: {
    llmServiceUrl: "http://ollama:31434",
    llmApiVersion: "",
    llmModel: "qwen3:0.6b",
    help:
      "<strong>Ollama</strong> &mdash; Local models via the Ollama container.<br>" +
      "<b>URL:</b> <code>http://ollama:31434</code> (Docker) or <code>http://localhost:31434</code> (local)<br>" +
      "<b>Model:</b> e.g. <code>qwen3:0.6b</code>, <code>llama3</code><br>" +
      "<b>Key:</b> Leave blank - Ollama doesn't check one<br>" +
      "<b>API Version:</b> Leave blank"
  }
}

/**
 * Combined AI judge create/edit wizard: step 1 (configure) is a normal Rails
 * form submit handled by AiJudgesController#create/#update - this controller
 * only handles step 2 (test & refine), which runs entirely against the
 * *current* form values via AiJudges::WizardController's stateless JSON
 * endpoints. Nothing step 2 does is ever saved until the real form submits.
 */
export default class extends Controller {
  static targets = [
    "name",
    "llmKey",
    "llmProvider",
    "llmServiceUrl",
    "llmModel",
    "llmTimeout",
    "llmApiVersion",
    "providerHelp",
    "structuredTab",
    "jsonTab",
    "structuredField",
    "jsonField",
    "systemPrompt",
    "step2",
    "queryText",
    "docId",
    "informationNeed",
    "documentFields",
    "options",
    "notes",
    "position",
    "status",
    "ratingInfo",
    "loadingSpinner",
    "runPromptButton"
  ]

  static values = {
    sampleUrl: String,
    testUrl: String,
    existing: Boolean
  }

  connect() {
    this.documentFieldsEditor = null
    this.optionsEditor = null
    setTimeout(() => this.captureEditors(), 500)

    if (this.hasLlmProviderTarget) {
      this.updateProviderHelp(this.llmProviderTarget.value)
    }

    if (this.existingValue) {
      this.revealStep2()
    }
  }

  captureEditors() {
    if (this.hasDocumentFieldsTarget && this.documentFieldsTarget.editor) {
      this.documentFieldsEditor = this.documentFieldsTarget.editor
    }
    if (this.hasOptionsTarget && this.optionsTarget.editor) {
      this.optionsEditor = this.optionsTarget.editor
    }
  }

  // Reveal step 2 once a name has been entered - there's no expensive
  // server step gating this (unlike Mapper Wizard's HTML fetch), so this is
  // a pure client-side check.
  checkReveal() {
    if (this.hasNameTarget && this.nameTarget.value.trim()) {
      this.revealStep2()
    }
  }

  revealStep2() {
    if (this.hasStep2Target && this.step2Target.style.display !== "block") {
      this.step2Target.style.display = "block"
      this.sampleQueryDocPair()
    }
  }

  showStructuredTab() {
    this.jsonFieldTargets.forEach((field) => { field.disabled = true })
    this.structuredFieldTargets.forEach((field) => { field.disabled = false })
  }

  showJsonTab() {
    this.structuredFieldTargets.forEach((field) => { field.disabled = true })
    this.jsonFieldTargets.forEach((field) => { field.disabled = false })
  }

  updateProviderPreset() {
    const preset = PROVIDER_PRESETS[this.llmProviderTarget.value]
    if (!preset) return

    if (this.hasLlmServiceUrlTarget) this.llmServiceUrlTarget.value = preset.llmServiceUrl
    if (this.hasLlmApiVersionTarget) this.llmApiVersionTarget.value = preset.llmApiVersion
    if (this.hasLlmModelTarget) this.llmModelTarget.value = preset.llmModel

    this.updateProviderHelp(this.llmProviderTarget.value)
  }

  updateProviderHelp(provider) {
    const preset = PROVIDER_PRESETS[provider]
    if (!this.hasProviderHelpTarget) return

    if (preset?.help) {
      this.providerHelpTarget.innerHTML = preset.help
      this.providerHelpTarget.style.display = "block"
    } else {
      this.providerHelpTarget.style.display = "none"
    }
  }

  judgeOptions() {
    return {
      llm_provider: this.hasLlmProviderTarget ? this.llmProviderTarget.value : "",
      llm_service_url: this.hasLlmServiceUrlTarget ? this.llmServiceUrlTarget.value : "",
      llm_model: this.hasLlmModelTarget ? this.llmModelTarget.value : "",
      llm_timeout: this.hasLlmTimeoutTarget ? this.llmTimeoutTarget.value : "",
      llm_api_version: this.hasLlmApiVersionTarget ? this.llmApiVersionTarget.value : ""
    }
  }

  async sampleQueryDocPair(event) {
    event?.preventDefault?.()

    try {
      const response = await apiFetch(this.sampleUrlValue, { headers: { Accept: "application/json" } })
      if (!response.ok) throw new Error(`Failed to load a query/doc pair (${response.status})`)

      const data = await response.json()
      this.applyQueryDocPair(data.query_doc_pair || {})
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "danger")
    }
  }

  applyQueryDocPair(pair) {
    this.captureEditors()

    if (this.hasQueryTextTarget) this.queryTextTarget.value = pair.query_text || ""
    if (this.hasDocIdTarget) this.docIdTarget.value = pair.doc_id || ""
    if (this.hasInformationNeedTarget) this.informationNeedTarget.value = pair.information_need || ""
    if (this.hasNotesTarget) this.notesTarget.value = pair.notes || ""
    if (this.hasPositionTarget) this.positionTarget.value = pair.position ?? ""

    const documentFieldsJson = JSON.stringify(pair.document_fields || {}, null, 2)
    const optionsJson = JSON.stringify(pair.options || {}, null, 2)

    if (this.documentFieldsEditor) {
      this.documentFieldsEditor.setValue(documentFieldsJson)
    } else if (this.hasDocumentFieldsTarget) {
      this.documentFieldsTarget.value = documentFieldsJson
    }

    if (this.optionsEditor) {
      this.optionsEditor.setValue(optionsJson)
    } else if (this.hasOptionsTarget) {
      this.optionsTarget.value = optionsJson
    }
  }

  async runPrompt(event) {
    event.preventDefault()

    this.captureEditors()
    this.setButtonLoading(this.runPromptButtonTarget, true)
    if (this.hasRatingInfoTarget) this.ratingInfoTarget.style.display = "none"
    if (this.hasLoadingSpinnerTarget) this.loadingSpinnerTarget.style.display = "block"

    const documentFields = this.documentFieldsEditor
      ? this.documentFieldsEditor.getValue()
      : (this.hasDocumentFieldsTarget ? this.documentFieldsTarget.value : "")
    const options = this.optionsEditor
      ? this.optionsEditor.getValue()
      : (this.hasOptionsTarget ? this.optionsTarget.value : "")

    try {
      const response = await apiFetch(this.testUrlValue, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: this.hasSystemPromptTarget ? this.systemPromptTarget.value : "",
          llm_key: this.hasLlmKeyTarget ? this.llmKeyTarget.value : "",
          judge_options: this.judgeOptions(),
          query_doc_pair: {
            query_text: this.hasQueryTextTarget ? this.queryTextTarget.value : "",
            doc_id: this.hasDocIdTarget ? this.docIdTarget.value : "",
            information_need: this.hasInformationNeedTarget ? this.informationNeedTarget.value : "",
            document_fields: documentFields,
            options: options,
            notes: this.hasNotesTarget ? this.notesTarget.value : "",
            position: this.hasPositionTarget ? this.positionTarget.value : ""
          }
        })
      })

      const data = await response.json()

      if (this.hasRatingInfoTarget) {
        this.ratingInfoTarget.innerHTML =
          `<h2>Rating Information</h2><div>LLM Response: ${this.escapeHtml(String(data.rating))}<br>${this.escapeHtml(data.explanation || "")}</div>`
        this.ratingInfoTarget.style.display = "block"
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "danger")
    } finally {
      if (this.hasLoadingSpinnerTarget) this.loadingSpinnerTarget.style.display = "none"
      this.setButtonLoading(this.runPromptButtonTarget, false)
    }
  }

  showStatus(message, variant) {
    if (!this.hasStatusTarget) return
    this.statusTarget.textContent = message
    this.statusTarget.className = `alert alert-${variant}`
    this.statusTarget.style.display = "block"
  }

  setButtonLoading(button, loading) {
    if (!button) return

    if (loading) {
      button.disabled = true
      button.dataset.originalText = button.innerHTML
      button.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...'
    } else {
      button.disabled = false
      button.innerHTML = button.dataset.originalText || button.innerHTML
    }
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}

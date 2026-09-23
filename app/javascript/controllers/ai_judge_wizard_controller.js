import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { showStatusMessage } from "utils/status_message"
import { setButtonLoading, escapeHtml } from "utils/stimulus_ui"

// Normalize line endings before comparing prompts: a textarea gives back CRLF
// where the stored text had LF.
const normalizePrompt = (text) => (text || "").replace(/\r\n?/g, "\n").trim()

// null for text that isn't JSON, so a typo can be told apart from real content.
function parseJsonOrNull(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function showPanel(element, html) {
  if (!element) return

  if (html) {
    element.innerHTML = html
    element.style.display = "block"
  } else {
    element.style.display = "none"
  }
}

/**
 * Combined AI judge create/edit wizard: step 1 (configure) is a normal Rails
 * form submit handled by AiJudgesController#create/#update - this controller
 * only handles step 2 (test & refine), which runs entirely against the
 * *current* form values via AiJudges::WizardController's stateless JSON
 * endpoints. Nothing step 2 does is ever saved until the real form submits.
 *
 * Provider presets (URL/model/API version, help text, prompt defaults) come
 * from the LlmProviders registry (app/models/llm_providers.rb) via the
 * presets value -- add providers there, not here.
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
    "providerNotice",
    "providerOptionField",
    "structuredTab",
    "jsonTab",
    "structuredField",
    "jsonField",
    "systemPrompt",
    "systemPromptLabel",
    "systemPromptHint",
    "systemPromptWarning",
    "defaultPromptProvider",
    "criteriaTable",
    "criteriaProse",
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
    existing: Boolean,
    presets: Object,
    stockPrompts: Array
  }

  connect() {
    this.documentFieldsEditor = null
    this.optionsEditor = null
    setTimeout(() => this.captureEditors(), 500)

    this.readStoredOptions()

    if (this.hasLlmProviderTarget) {
      this.updateProviderPanels(this.llmProviderTarget.value)
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

  // The two tabs are one set of values seen two ways, and only the visible one is
  // submitted. Without syncing, editing a field and switching tabs shows the *stored*
  // value instead of what you just typed -- and saving from there silently discards it.
  // Anything in options that has no field of its own (or belongs to another provider)
  // is carried through untouched.
  showStructuredTab() {
    this.applyJsonToFields()
    this.jsonFieldTargets.forEach((field) => { field.disabled = true })
    this.structuredFieldTargets.forEach((field) => { field.disabled = false })
    this.showProviderOptionFields(this.hasLlmProviderTarget ? this.llmProviderTarget.value : "")
  }

  showJsonTab() {
    this.showFieldsAsJson()
    this.structuredFieldTargets.forEach((field) => { field.disabled = true })
    this.jsonFieldTargets.forEach((field) => { field.disabled = false })
  }

  readStoredOptions() {
    this.otherOptions = {}
    if (!this.hasJsonFieldTarget) return

    try {
      const { judge_options: _ignored, ...rest } = JSON.parse(this.jsonFieldTarget.value || "{}")
      this.otherOptions = rest
    } catch {
      this.otherOptions = {}
    }
  }

  showFieldsAsJson() {
    if (!this.hasJsonFieldTarget) return

    this.jsonFieldTarget.value = JSON.stringify({ ...this.otherOptions, judge_options: this.judgeOptions() }, null, 2)
  }

  applyJsonToFields() {
    if (!this.hasJsonFieldTarget) return

    const parsed = parseJsonOrNull(this.jsonFieldTarget.value)
    if (!parsed) return // leave the fields alone rather than wiping them over a typo

    const { judge_options: judgeOptions = {}, ...rest } = parsed
    this.otherOptions = rest

    Object.entries(judgeOptions).forEach(([key, value]) => {
      const field = this.element.querySelector(`#judge_options_${key}`)
      if (field) field.value = value === null || value === undefined ? "" : value
    })

    if (this.hasLlmProviderTarget && judgeOptions.llm_provider) {
      this.llmProviderTarget.value = judgeOptions.llm_provider
      this.updateProviderPanels(this.llmProviderTarget.value)
    }
  }

  updateProviderPreset() {
    const preset = this.presetsValue[this.llmProviderTarget.value]
    if (!preset) return

    if (this.hasLlmServiceUrlTarget) this.llmServiceUrlTarget.value = preset.llm_service_url
    if (this.hasLlmApiVersionTarget) this.llmApiVersionTarget.value = preset.llm_api_version
    if (this.hasLlmModelTarget) this.llmModelTarget.value = preset.llm_model

    this.offerDefaultSystemPrompt(preset)
    this.updateProviderPanels(this.llmProviderTarget.value)
  }

  updateProviderPanels(provider) {
    const preset = this.presetsValue[provider]

    showPanel(this.hasProviderNoticeTarget && this.providerNoticeTarget, preset?.notice)
    showPanel(this.hasProviderHelpTarget && this.providerHelpTarget, preset?.help)
    this.applyReadOnlyFields(preset)
    this.describePromptField(preset)
    this.showProviderOptionFields(provider)
    this.showCriteria(preset)
  }

  // Fields the provider fixes for us (e.g. a single endpoint and model) are shown
  // read-only rather than hidden, so it is clear what the judge will actually call.
  applyReadOnlyFields(preset) {
    const readOnly = preset?.read_only || []
    const fields = {
      llm_service_url: this.hasLlmServiceUrlTarget && this.llmServiceUrlTarget,
      llm_api_version: this.hasLlmApiVersionTarget && this.llmApiVersionTarget,
      llm_model: this.hasLlmModelTarget && this.llmModelTarget
    }

    Object.entries(fields).forEach(([name, field]) => {
      if (!field) return

      field.readOnly = readOnly.includes(name)
      field.classList.toggle("bg-body-secondary", field.readOnly)
    })
  }

  // A field only one provider understands is disabled while another is selected, so
  // switching away never posts a setting the chosen provider has no idea about.
  showProviderOptionFields(provider) {
    this.providerOptionFieldTargets.forEach((row) => {
      const mine = row.dataset.provider === provider

      row.style.display = mine ? "" : "none"
      row.querySelectorAll("input").forEach((input) => { input.disabled = !mine })
    })
  }

  // For a typed model the book's scale is sent as the question's criteria; a chat
  // model gets it described in prose inside the prompt. Show whichever this is.
  showCriteria(preset) {
    const asCriteria = Boolean(preset?.scale_as_criteria)

    if (this.hasCriteriaTableTarget) this.criteriaTableTarget.style.display = asCriteria ? "" : "none"
    if (this.hasCriteriaProseTarget) this.criteriaProseTarget.style.display = asCriteria ? "none" : ""
  }

  isStockPrompt(text) {
    const current = normalizePrompt(text)
    return this.stockPromptsValue.some((prompt) => normalizePrompt(prompt) === current)
  }

  // What a judge should be told depends on the dialect it speaks: a chat model
  // needs the rating scale and an output format spelled out, while a typed
  // model is handed both as part of the request and only needs to be told what
  // to weigh. So offer the new provider's prompt -- but never over one somebody
  // has edited.
  offerDefaultSystemPrompt(preset) {
    if (!this.hasSystemPromptTarget || !preset?.system_prompt) return

    const current = this.systemPromptTarget.value
    if (normalizePrompt(current) !== "" && !this.isStockPrompt(current)) return

    this.systemPromptTarget.value = preset.system_prompt
  }

  // A chat model is given a system prompt; a typed model is given instructions
  // on a question. Same stored text, different thing, so say which one this is.
  describePromptField(preset) {
    if (this.hasSystemPromptLabelTarget && preset?.prompt_label) {
      this.systemPromptLabelTarget.textContent = preset.prompt_label
    }
    if (this.hasSystemPromptHintTarget) {
      this.systemPromptHintTarget.textContent = preset?.prompt_hint || ""
      this.systemPromptHintTarget.style.display = preset?.prompt_hint ? "block" : "none"
    }
    if (!this.hasSystemPromptWarningTarget) return

    // An existing judge switched to another dialect keeps text written for the
    // old one, which is worse than useless: the stock chat prompt dictates a
    // 0-3 scale this book may not use, and an output format Jev cannot follow.
    const current = this.hasSystemPromptTarget ? this.systemPromptTarget.value : ""
    const foreign = Boolean(preset?.system_prompt) &&
      this.isStockPrompt(current) &&
      normalizePrompt(preset.system_prompt) !== normalizePrompt(current)

    if (foreign && this.hasDefaultPromptProviderTarget && this.hasLlmProviderTarget) {
      const select = this.llmProviderTarget
      this.defaultPromptProviderTarget.textContent = select.options[select.selectedIndex].text
    }
    this.systemPromptWarningTarget.style.display = foreign ? "block" : "none"
  }

  useDefaultPrompt(event) {
    event?.preventDefault?.()
    if (!this.hasLlmProviderTarget || !this.hasSystemPromptTarget) return

    const preset = this.presetsValue[this.llmProviderTarget.value]
    if (!preset) return

    this.systemPromptTarget.value = preset.system_prompt
    this.describePromptField(preset)
  }

  // Every judge option currently on the structured tab, including options only
  // the selected provider understands (hidden rows belong to other providers).
  judgeOptions() {
    const collected = {}

    this.structuredFieldTargets.forEach((field) => {
      if (!field.id.startsWith("judge_options_")) return

      const optionRow = field.closest(".provider-option-field")
      if (optionRow && optionRow.style.display === "none") return

      collected[field.id.replace("judge_options_", "")] = field.value
    })

    return collected
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
    setButtonLoading(this.runPromptButtonTarget, true)
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

      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)

      if (this.hasRatingInfoTarget) {
        // The server holds the preview to the same rules a real judging run applies, so a
        // rating this book would reject shows as unrateable rather than as a usable rating.
        const rating = data.unrateable
          ? "<span class=\"badge text-bg-warning\">Unrateable</span>"
          : escapeHtml(String(data.rating))
        this.ratingInfoTarget.innerHTML =
          `<h2>Rating Information</h2><div>LLM Response: ${rating}<br>${escapeHtml(data.explanation || "")}</div>`
        this.ratingInfoTarget.style.display = "block"
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, "danger")
    } finally {
      if (this.hasLoadingSpinnerTarget) this.loadingSpinnerTarget.style.display = "none"
      setButtonLoading(this.runPromptButtonTarget, false)
    }
  }

  showStatus(message, variant) {
    if (!this.hasStatusTarget) return

    this.statusTarget.style.display = "block"
    showStatusMessage(this.statusTarget, {
      message,
      className: `alert alert-${variant}`
    })
  }
}

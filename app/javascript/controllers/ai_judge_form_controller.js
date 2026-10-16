import { Controller } from "@hotwired/stimulus"

const normalizePrompt = text => (text || "").replace(/\r\n?/g, "\n").trim()

export default class extends Controller {
  static targets = ["structured", "json", "jsonTab", "provider", "preset", "help", "url", "version", "model", "images", "imagesHidden", "imagesNotice", "imagesNoticeProvider", "providerOptionField", "systemPrompt", "systemPromptLabel", "systemPromptHint", "systemPromptWarning", "defaultPromptProvider", "criteriaTable", "criteriaProse", "runPromptButton", "needsScaleNotice"]
  static values = { presets: Object, stockPrompts: Array, hasScale: Boolean, optionDefaults: Object }

  connect() {
    this.syncTab()
    this.updateProviderPanels()
  }

  syncTab() {
    const json = this.jsonTabTarget.classList.contains("active")
    if (this.jsonActive !== undefined && json !== this.jsonActive) {
      if (json) this.showFieldsAsJson()
      else this.applyJsonToFields()
    }
    this.jsonActive = json
    this.jsonTarget.disabled = !json
    this.structuredTargets.forEach(field => { field.disabled = json })
    this.updateProviderPanels()
  }

  showFieldsAsJson() {
    let stored
    try { stored = JSON.parse(this.jsonTarget.value || "{}") } catch { return }
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return
    const options = { ...stored.judge_options }
    this.structuredTargets.forEach(field => {
      if (!field.id.startsWith("judge_options_")) return
      options[field.id.replace("judge_options_", "")] = field.type === "checkbox" ?
        (field.dataset.unsupported === "true" ? field.dataset.wanted : String(field.checked)) : field.value
    })
    this.jsonTarget.value = JSON.stringify({ ...stored, judge_options: options }, null, 2)
  }

  applyJsonToFields() {
    let parsed
    try { parsed = JSON.parse(this.jsonTarget.value) } catch { return }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return
    const options = parsed.judge_options ?? {}
    if (typeof options !== "object" || Array.isArray(options)) return
    this.structuredTargets.forEach(field => {
      if (!field.id.startsWith("judge_options_")) return
      const key = field.id.replace("judge_options_", "")
      const value = Object.hasOwn(options, key) ? options[key] : this.optionDefaultsValue?.[key]
      if (field.type === "checkbox") {
        const on = value === null || value === "" || ![false, "false", "0", 0].includes(value)
        field.dataset.wanted = String(on)
        if (field.dataset.unsupported !== "true") field.checked = on
      } else field.value = value ?? ""
    })
  }

  currentPreset() {
    if (!this.hasProviderTarget) return null
    return this.presetsValue?.[this.providerTarget.value]
  }

  providerChanged() {
    const preset = this.currentPreset()
    if (!preset) return
    if (this.hasUrlTarget) this.urlTarget.value = preset.llm_service_url
    if (this.hasVersionTarget) this.versionTarget.value = preset.llm_api_version
    if (this.hasModelTarget) this.modelTarget.value = preset.llm_model
    this.offerDefaultSystemPrompt(preset)
    this.updateProviderPanels()
  }

  updateProviderPanels() {
    const preset = this.currentPreset()
    this.showHelp()
    this.applyReadOnlyFields(preset)
    this.describePromptField(preset)
    this.showProviderOptionFields(this.hasProviderTarget ? this.providerTarget.value : "")
    this.showCriteria(preset)
    this.syncImages()
    this.jsonChanged()
  }

  jsonChanged() {
    let preset = this.currentPreset()
    if (this.jsonTabTarget.classList.contains("active")) {
      try {
        const parsed = JSON.parse(this.jsonTarget.value)
        preset = this.presetsValue?.[parsed?.judge_options?.llm_provider]
      } catch {
        // Keep malformed JSON runnable so the wizard can report its existing error.
        preset = null
      }
    }
    this.updateRunAvailability(preset)
  }

  updateRunAvailability(preset) {
    const missingScale = Boolean(preset?.needs_scale) && !this.hasScaleValue
    if (this.hasRunPromptButtonTarget) this.runPromptButtonTarget.disabled = missingScale
    if (this.hasNeedsScaleNoticeTarget) this.needsScaleNoticeTarget.style.display = missingScale ? "" : "none"
  }

  syncImages() {
    if (!this.hasImagesTarget) return
    const field = this.imagesTarget
    const supported = this.currentPreset()?.supports_images !== false
    if (field.dataset.unsupported !== "true") field.dataset.wanted = String(field.checked)
    field.checked = supported && field.dataset.wanted !== "false"
    field.disabled = !supported || this.jsonTabTarget.classList.contains("active")
    field.dataset.unsupported = String(!supported)
    if (this.hasImagesHiddenTarget) this.imagesHiddenTarget.value = supported ? "false" : field.dataset.wanted
    if (this.hasImagesNoticeProviderTarget) this.imagesNoticeProviderTarget.textContent = this.currentPreset()?.label || ""
    if (this.hasImagesNoticeTarget) this.imagesNoticeTarget.style.display = supported ? "none" : ""
  }

  showHelp() {
    const template = this.hasProviderTarget && this.presetTargets.find(preset => preset.dataset.provider === this.providerTarget.value)
    this.helpTarget.replaceChildren(...(template ? [template.content.cloneNode(true)] : []))
    this.helpTarget.style.display = template ? "block" : "none"
  }

  applyReadOnlyFields(preset) {
    const readOnly = preset?.read_only || []
    const fields = {
      llm_service_url: this.hasUrlTarget && this.urlTarget,
      llm_api_version: this.hasVersionTarget && this.versionTarget,
      llm_model: this.hasModelTarget && this.modelTarget
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
      row.querySelectorAll("input").forEach((input) => { input.disabled = !mine || this.jsonTabTarget.classList.contains("active") })
    })
  }

  // A typed model receives the book's scale as the question's criteria; a chat
  // model receives it as prose inside the prompt instead. Toggle the matching element.
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

    if (foreign && this.hasDefaultPromptProviderTarget && this.hasProviderTarget) {
      const select = this.providerTarget
      this.defaultPromptProviderTarget.textContent = select.options[select.selectedIndex].text
    }
    this.systemPromptWarningTarget.style.display = foreign ? "block" : "none"
  }

  useDefaultPrompt(event) {
    event?.preventDefault?.()
    if (!this.hasProviderTarget || !this.hasSystemPromptTarget) return

    const preset = this.presetsValue[this.providerTarget.value]
    if (!preset) return

    this.systemPromptTarget.value = preset.system_prompt
    this.describePromptField(preset)
  }

}

import { Controller } from "@hotwired/stimulus"

const normalizePrompt = (text) => (text || "").replace(/\r\n?/g, "\n").trim()

const IMAGE_TYPE_LABELS = { url: "URL", base64: "Base64" }

export default class extends Controller {
  static targets = [
    "provider",
    "connection",
    "preset",
    "help",
    "url",
    "version",
    "model",
    "images",
    "imagesHidden",
    "imagesNotice",
    "imagesNoticeProvider",
    "advanced",
    "imageSettings",
    "imageType",
    "imageTypeHidden",
    "imageTypeHint",
    "imageDimensions",
    "imageDimensionsHint",
    "imageTimeout",
    "providerOptionField",
    "systemPrompt",
    "systemPromptLabel",
    "systemPromptHint",
    "systemPromptWarning",
    "defaultPromptProvider",
    "criteriaTable",
    "criteriaProse",
    "runPromptButton",
    "needsScaleNotice"
  ]
  static values = {
    presets: Object,
    stockPrompts: Array,
    hasScale: Boolean
  }

  connect() {
    this.updateProviderPanels()
  }

  currentPreset() {
    if (!this.hasProviderTarget) return null
    return this.presetsValue?.[this.providerTarget.value]
  }

  // A connection is for one provider, so choosing it chooses the provider too.
  connectionChanged() {
    const provider = this.connectionTarget.selectedOptions[0]?.dataset.provider
    const row = this.hasProviderTarget ? this.providerTarget.closest(".row") : null
    if (!provider || !this.hasProviderTarget) {
      // Hidden again once there is no connection to take it from.
      row?.classList.add("d-none")
      if (this.hasAdvancedTarget) this.advancedTarget.style.display = "none"
      return
    }
    row?.classList.remove("d-none")
    if (this.providerTarget.value === provider) return
    this.providerTarget.value = provider
    this.providerChanged()
  }

  providerChanged() {
    const preset = this.currentPreset()
    if (!preset) return
    if (this.hasUrlTarget) this.urlTarget.value = preset.llm_service_url
    if (this.hasVersionTarget) this.versionTarget.value = preset.llm_api_version
    if (this.hasModelTarget) this.modelTarget.value = preset.llm_model
    if (this.hasImageDimensionsTarget) this.imageDimensionsTarget.value = ""
    if (this.hasImageTimeoutTarget) this.imageTimeoutTarget.value = ""
    // No option has an empty value, so the provider's default type is picked next.
    if (this.hasImageTypeTarget) this.imageTypeTarget.value = ""
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
    this.syncImageSettings()
    this.updateRunAvailability(preset)
  }

  // A provider that needs a scale (currently: one sent the scale as its criteria,
  // like Jev) has nothing to judge against without one, so don't offer a run that
  // can only fail, and say why.
  updateRunAvailability(preset = this.currentPreset()) {
    const missingScale = Boolean(preset?.needs_scale) && !this.hasScaleValue

    // ai-judge-wizard flags a scale outside the judge's typed limit; that keeps Run off too.
    if (this.hasRunPromptButtonTarget)
      this.runPromptButtonTarget.disabled =
        missingScale || this.runPromptButtonTarget.dataset.unsupportedScale === "true"
    if (this.hasNeedsScaleNoticeTarget)
      this.needsScaleNoticeTarget.style.display = missingScale ? "" : "none"
  }

  syncImages() {
    if (!this.hasImagesTarget) return
    const field = this.imagesTarget
    const supported = this.currentPreset()?.supports_images !== false
    const optIn = supported && this.currentPreset()?.images_by_default === false
    const provider = this.hasProviderTarget ? this.providerTarget.value : ""
    const switched = field.dataset.provider !== undefined && field.dataset.provider !== provider
    // An opt-in provider's (Jev's) switch is its own: it starts off on arrival, and
    // neither sets nor takes the preference the other providers share.
    if (field.dataset.unsupported !== "true" && field.dataset.optIn !== "true")
      field.dataset.wanted = String(field.checked)
    if (!optIn) field.checked = supported && field.dataset.wanted !== "false"
    else if (switched) field.checked = false
    field.dataset.provider = provider
    field.dataset.optIn = String(optIn)
    field.disabled = !supported
    field.dataset.unsupported = String(!supported)
    if (this.hasImagesHiddenTarget)
      this.imagesHiddenTarget.value = supported ? "false" : field.dataset.wanted
    if (this.hasImagesNoticeProviderTarget)
      this.imagesNoticeProviderTarget.textContent = this.currentPreset()?.label || ""
    if (this.hasImagesNoticeTarget) this.imagesNoticeTarget.style.display = supported ? "none" : ""
  }

  // The Advanced section: how the image reaches the model and the size it is resized to,
  // limited to what the provider accepts (LlmProvider#image_types / #image_dimensions).
  // Nothing in it is sent while images are off.
  syncImageSettings() {
    if (!this.hasAdvancedTarget) return
    const preset = this.currentPreset()
    const supported = preset?.supports_images !== false
    const types = (supported && preset?.image_types) || []
    const bounds = supported ? preset?.image_dimensions : null
    const offered = types.length > 1 || Boolean(bounds)
    const imagesOn =
      this.hasImagesTarget && this.imagesTarget.checked && !this.imagesTarget.disabled
    // Advanced settings has the model and scale limits for any provider; the image rows only
    // for one with image settings to pick.
    this.advancedTarget.style.display = preset ? "" : "none"
    if (this.hasImageSettingsTarget) this.imageSettingsTarget.style.display = offered ? "" : "none"

    let type = types[0] || ""
    if (this.hasImageTypeTarget) {
      const select = this.imageTypeTarget
      const current = select.value
      select.replaceChildren(
        ...types.map((value) => {
          const option = document.createElement("option")
          option.value = value
          option.textContent = IMAGE_TYPE_LABELS[value] || value
          return option
        })
      )
      select.value = types.includes(current) ? current : type
      type = select.value
      select.disabled = !imagesOn || types.length < 2
      if (this.hasImageTypeHiddenTarget) {
        this.imageTypeHiddenTarget.value = type
        this.imageTypeHiddenTarget.disabled = !imagesOn
      }
      if (this.hasImageTypeHintTarget)
        this.imageTypeHintTarget.textContent =
          types.length === 1 ? `Fixed for ${preset?.label || ""}.` : ""
    }

    if (this.hasImageDimensionsTarget) {
      const field = this.imageDimensionsTarget
      field.min = bounds ? String(bounds.min) : ""
      field.max = bounds ? String(bounds.max) : ""
      field.placeholder = bounds ? String(bounds.recommended) : ""
      field.disabled = !imagesOn || !bounds || type === "url"
    }
    // Only a base64 image is downloaded by Quepid, so only it has a download to time out.
    if (this.hasImageTimeoutTarget)
      this.imageTimeoutTarget.disabled = !imagesOn || type !== "base64"
    if (this.hasImageDimensionsHintTarget)
      this.imageDimensionsHintTarget.textContent = bounds
        ? `Resize images to this size (${bounds.min}–${bounds.max} px). Blank uses the recommended ${bounds.recommended} px. Smaller images use fewer tokens, but can make judgements less accurate.`
        : ""
  }

  showHelp() {
    const template =
      this.hasProviderTarget &&
      this.presetTargets.find((preset) => preset.dataset.provider === this.providerTarget.value)
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
      row.querySelectorAll("input").forEach((input) => {
        input.disabled = !mine
      })
    })
  }

  // A typed model receives the book's scale as the question's criteria; a chat
  // model receives it as prose inside the prompt instead. Toggle the matching element.
  showCriteria(preset) {
    const asCriteria = Boolean(preset?.scale_as_criteria)

    if (this.hasCriteriaTableTarget)
      this.criteriaTableTarget.style.display = asCriteria ? "" : "none"
    if (this.hasCriteriaProseTarget)
      this.criteriaProseTarget.style.display = asCriteria ? "none" : ""
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
    const foreign =
      Boolean(preset?.system_prompt) &&
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

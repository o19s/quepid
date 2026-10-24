import { afterEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import AiJudgeWizardController from "controllers/ai_judge_wizard_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn()
}))

// A structured-tab field as the form renders it: judgeOptions() reads these by id.
function judgeOptionField(key, value) {
  const field = document.createElement("input")
  field.id = `judge_options_${key}`
  field.value = value
  return field
}

function buildController(overrides = {}) {
  const controller = Object.create(AiJudgeWizardController.prototype)

  // saveDraft/restoreDraft walk up to the nearest <form> from the controller's
  // own element - a bare card inside one, with nothing else in it, is enough
  // for every test that doesn't care about draft persistence itself.
  const form = document.createElement("form")
  controller.element = document.createElement("div")
  form.appendChild(controller.element)
  controller.draftKeyValue = "new"

  controller.hasNameTarget = true
  controller.nameTarget = { value: "" }
  controller.hasStep2Target = true
  controller.step2Target = document.createElement("div")
  controller.step2Target.style.display = "none"
  controller.sampleUrlValue = "/ai_judges/new/sample_query_doc_pair"
  controller.testUrlValue = "/ai_judges/new/test_prompt"
  controller.existingValue = false

  controller.hasQueryTextTarget = true
  controller.queryTextTarget = { value: "" }
  controller.hasDocIdTarget = true
  controller.docIdTarget = { value: "" }
  controller.hasInformationNeedTarget = true
  controller.informationNeedTarget = { value: "" }
  controller.hasDocumentFieldsTarget = true
  controller.documentFieldsTarget = { value: "" }
  controller.hasOptionsTarget = true
  controller.optionsTarget = { value: "" }
  controller.hasNotesTarget = true
  controller.notesTarget = { value: "" }
  controller.hasPositionTarget = true
  controller.positionTarget = { value: "" }

  controller.hasSystemPromptTarget = true
  controller.systemPromptTarget = { value: "Rate the document." }
  controller.hasLlmKeyTarget = true
  controller.llmKeyTarget = { value: "sk-test" }
  controller.hasLlmProviderTarget = true
  controller.llmProviderTarget = judgeOptionField("llm_provider", "openai")
  controller.hasLlmServiceUrlTarget = true
  controller.llmServiceUrlTarget = judgeOptionField("llm_service_url", "https://api.openai.com")
  controller.hasLlmModelTarget = true
  controller.llmModelTarget = judgeOptionField("llm_model", "gpt-4o")
  controller.hasLlmTimeoutTarget = true
  controller.llmTimeoutTarget = judgeOptionField("llm_timeout", "30")
  controller.hasLlmApiVersionTarget = true
  controller.llmApiVersionTarget = judgeOptionField("llm_api_version", "")
  controller.structuredFieldTargets = [
    controller.llmProviderTarget,
    controller.llmServiceUrlTarget,
    controller.llmModelTarget,
    controller.llmTimeoutTarget,
    controller.llmApiVersionTarget
  ]
  controller.providerOptionFieldTargets = []
  controller.presetsValue = {}
  controller.stockPromptsValue = []

  controller.hasRatingInfoTarget = true
  controller.ratingInfoTarget = document.createElement("div")
  controller.hasLoadingSpinnerTarget = true
  controller.loadingSpinnerTarget = document.createElement("div")
  controller.runPromptButtonTarget = document.createElement("button")
  controller.hasStatusTarget = true
  controller.statusTarget = document.createElement("div")

  controller.captureEditors = vi.fn()
  controller.documentFieldsEditor = null
  controller.optionsEditor = null

  Object.assign(controller, overrides)
  return controller
}

describe("AiJudgeWizardController reveal", () => {
  it("reveals step 2 and samples a query/doc pair once a name is entered", () => {
    const controller = buildController({ nameTarget: { value: "My Judge" } })
    controller.sampleQueryDocPair = vi.fn()

    AiJudgeWizardController.prototype.checkReveal.call(controller)

    expect(controller.step2Target.style.display).toBe("block")
    expect(controller.sampleQueryDocPair).toHaveBeenCalledOnce()
  })

  it("does not reveal step 2 when the name is blank", () => {
    const controller = buildController({ nameTarget: { value: "   " } })
    controller.sampleQueryDocPair = vi.fn()

    AiJudgeWizardController.prototype.checkReveal.call(controller)

    expect(controller.step2Target.style.display).toBe("none")
    expect(controller.sampleQueryDocPair).not.toHaveBeenCalled()
  })
})

describe("AiJudgeWizardController sampleQueryDocPair", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("fetches sampleUrlValue and populates the query/doc pair fields", async () => {
    const controller = buildController()

    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          query_doc_pair: {
            query_text: "shirts",
            doc_id: "d1",
            information_need: "find shirts",
            document_fields: { title: "Red Shirt" },
            options: {},
            notes: "",
            position: 1
          }
        })
    })

    await AiJudgeWizardController.prototype.sampleQueryDocPair.call(controller, {
      preventDefault: vi.fn()
    })

    expect(apiFetch).toHaveBeenCalledWith("/ai_judges/new/sample_query_doc_pair", {
      headers: { Accept: "application/json" }
    })
    expect(controller.queryTextTarget.value).toBe("shirts")
    expect(controller.docIdTarget.value).toBe("d1")
    expect(controller.documentFieldsTarget.value).toContain("Red Shirt")
  })
})

describe("AiJudgeWizardController runPrompt", () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it("posts the current form values to testUrlValue and shows the result", async () => {
    const controller = buildController()

    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rating: 3,
          explanation: "Perfectly relevant."
        })
    })

    await AiJudgeWizardController.prototype.runPrompt.call(controller, {
      preventDefault: vi.fn()
    })

    expect(apiFetch).toHaveBeenCalledOnce()
    const [url, options] = apiFetch.mock.calls[0]
    expect(url).toBe("/ai_judges/new/test_prompt")
    const body = JSON.parse(options.body)
    expect(body.system_prompt).toBe("Rate the document.")
    expect(body.llm_key).toBe("sk-test")
    expect(body.judge_options).toEqual({
      llm_provider: "openai",
      llm_service_url: "https://api.openai.com",
      llm_model: "gpt-4o",
      llm_timeout: "30",
      llm_api_version: ""
    })

    expect(controller.ratingInfoTarget.innerHTML).toContain("Perfectly relevant.")
    expect(controller.ratingInfoTarget.style.display).toBe("block")
  })

  it("shows a rating the book would reject as Unrateable, not as a number", async () => {
    const controller = buildController()

    apiFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          rating: null,
          unrateable: true,
          explanation: "Perfect [LLM returned rating 3.0, outside the scale [0, 1]]"
        })
    })

    await AiJudgeWizardController.prototype.runPrompt.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.ratingInfoTarget.innerHTML).toContain("Unrateable")
    expect(controller.ratingInfoTarget.innerHTML).not.toContain("null")
    expect(controller.ratingInfoTarget.innerHTML).toContain("outside the scale")
  })

  it("shows an error and does not render a rating when the request fails", async () => {
    const controller = buildController()

    apiFetch.mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ error: "Document fields must be valid JSON" })
    })

    await AiJudgeWizardController.prototype.runPrompt.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.statusTarget.textContent).toContain("Document fields must be valid JSON")
    expect(controller.ratingInfoTarget.style.display).not.toBe("block")
  })
})

describe("AiJudgeWizardController connect", () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it("reveals step 2 and samples immediately when editing an existing judge", () => {
    const controller = buildController({ existingValue: true })
    controller.sampleQueryDocPair = vi.fn()
    controller.updateProviderPanels = vi.fn()

    AiJudgeWizardController.prototype.connect.call(controller)

    expect(controller.step2Target.style.display).toBe("block")
    expect(controller.sampleQueryDocPair).toHaveBeenCalledOnce()
  })
})

describe("AiJudgeWizardController scale picker draft", () => {
  // A real <form> with real named fields - saveDraft/restoreDraft walk the
  // DOM directly (via this.element.closest("form")), not the mocked target
  // objects buildController otherwise uses for everything else.
  function buildFormController(overrides = {}) {
    const controller = buildController(overrides)
    const form = controller.element.closest("form")

    const name = document.createElement("input")
    name.name = "user[name]"
    name.value = ""
    form.appendChild(name)

    const llmKey = document.createElement("input")
    llmKey.name = "user[llm_key]"
    llmKey.value = ""
    form.appendChild(llmKey)

    const imagesOn = document.createElement("input")
    imagesOn.type = "checkbox"
    imagesOn.name = "user[judge_options][llm_include_images]"
    imagesOn.value = "true"
    imagesOn.checked = true
    form.appendChild(imagesOn)

    const teamA = document.createElement("input")
    teamA.type = "checkbox"
    teamA.name = "user[team_ids][]"
    teamA.value = "1"
    teamA.checked = false
    form.appendChild(teamA)

    const teamB = document.createElement("input")
    teamB.type = "checkbox"
    teamB.name = "user[team_ids][]"
    teamB.value = "2"
    teamB.checked = false
    form.appendChild(teamB)

    // The real view's name field carries both the Stimulus target and the
    // name= HTML attribute on the same element - checkReveal() reads the
    // former, saveDraft/restoreDraft find it via the latter, so the test
    // double has to be one element serving both roles too, not two.
    controller.nameTarget = name
    controller.nameField = name
    controller.llmKeyField = llmKey
    controller.imagesField = imagesOn
    controller.teamAField = teamA
    controller.teamBField = teamB

    return controller
  }

  afterEach(() => {
    sessionStorage.clear()
  })

  it("saves and restores every named field, checkboxes included", () => {
    const controller = buildFormController()
    controller.nameField.value = "Draft Judge"
    controller.llmKeyField.value = "sk-draft"
    controller.imagesField.checked = false
    controller.teamBField.checked = true

    AiJudgeWizardController.prototype.saveDraft.call(controller)

    // A fresh page load - fields reset to whatever the server rendered, same
    // as navigating away and back for real.
    const restored = buildFormController()
    AiJudgeWizardController.prototype.restoreDraft.call(restored)

    expect(restored.nameField.value).toBe("Draft Judge")
    expect(restored.llmKeyField.value).toBe("sk-draft")
    expect(restored.imagesField.checked).toBe(false)
    expect(restored.teamAField.checked).toBe(false)
    expect(restored.teamBField.checked).toBe(true)
  })

  it("reveals step 2 when the restored name is non-blank", () => {
    const controller = buildFormController()
    controller.nameField.value = "Draft Judge"
    AiJudgeWizardController.prototype.saveDraft.call(controller)

    const restored = buildFormController()
    restored.sampleQueryDocPair = vi.fn()

    AiJudgeWizardController.prototype.restoreDraft.call(restored)

    expect(restored.step2Target.style.display).toBe("block")
  })

  it("clears the stored draft once restored, so a later plain reload doesn't reapply it", () => {
    const controller = buildFormController()
    controller.nameField.value = "Draft Judge"
    AiJudgeWizardController.prototype.saveDraft.call(controller)

    AiJudgeWizardController.prototype.restoreDraft.call(buildFormController())

    expect(sessionStorage.getItem("ai_judge_wizard_draft:new")).toBeNull()
  })

  it("is a no-op when there is nothing to restore", () => {
    const controller = buildFormController()

    expect(() => AiJudgeWizardController.prototype.restoreDraft.call(controller)).not.toThrow()
    expect(controller.nameField.value).toBe("")
  })

  it("navigateToScale saves a draft and navigates to the picked option's url", () => {
    const originalLocation = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "http://localhost/ai_judges/new" }
    })

    const controller = buildFormController()
    controller.nameField.value = "Draft Judge"
    controller.saveDraft = vi.fn(AiJudgeWizardController.prototype.saveDraft.bind(controller))

    const select = document.createElement("select")
    const option = document.createElement("option")
    option.value = "3"
    option.dataset.url = "/ai_judges/new?scorer_id=3"
    select.appendChild(option)
    select.selectedIndex = 0

    AiJudgeWizardController.prototype.navigateToScale.call(controller, { target: select })

    expect(controller.saveDraft).toHaveBeenCalledOnce()
    expect(window.location.href).toBe("/ai_judges/new?scorer_id=3")

    Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
  })

  it("navigateToScale does nothing for the blank placeholder option", () => {
    const controller = buildFormController()
    controller.saveDraft = vi.fn()

    const select = document.createElement("select")
    const option = document.createElement("option")
    option.value = ""
    select.appendChild(option)
    select.selectedIndex = 0

    AiJudgeWizardController.prototype.navigateToScale.call(controller, { target: select })

    expect(controller.saveDraft).not.toHaveBeenCalled()
  })
})

describe("AiJudgeWizardController provider switching", () => {
  const presets = {
    openai: { system_prompt: "Chat prompt", prompt_label: "System prompt" },
    typesafe_jev: { system_prompt: "Jev instructions", prompt_label: "Judging instructions", read_only: ["llm_model"] }
  }

  it("swaps in the new provider's default over an untouched stock prompt", () => {
    const controller = buildController({
      presetsValue: presets,
      stockPromptsValue: ["Chat prompt", "Jev instructions"],
      systemPromptTarget: { value: "Chat prompt\r\n" }
    })

    AiJudgeWizardController.prototype.offerDefaultSystemPrompt.call(controller, presets.typesafe_jev)

    expect(controller.systemPromptTarget.value).toBe("Jev instructions")
  })

  it("never replaces a prompt somebody wrote", () => {
    const controller = buildController({
      presetsValue: presets,
      stockPromptsValue: ["Chat prompt", "Jev instructions"],
      systemPromptTarget: { value: "Only rate wine labels." }
    })

    AiJudgeWizardController.prototype.offerDefaultSystemPrompt.call(controller, presets.typesafe_jev)

    expect(controller.systemPromptTarget.value).toBe("Only rate wine labels.")
  })

  it("warns when the prompt is another provider's default", () => {
    const warning = document.createElement("div")
    const select = document.createElement("select")
    const option = document.createElement("option")
    option.value = "typesafe_jev"
    option.textContent = "TypeSafe Jev"
    select.appendChild(option)
    const controller = buildController({
      stockPromptsValue: ["Chat prompt", "Jev instructions"],
      systemPromptTarget: { value: "Chat prompt" },
      llmProviderTarget: select,
      hasSystemPromptWarningTarget: true,
      systemPromptWarningTarget: warning,
      hasDefaultPromptProviderTarget: true,
      defaultPromptProviderTarget: document.createElement("span")
    })

    AiJudgeWizardController.prototype.describePromptField.call(controller, presets.typesafe_jev)

    expect(warning.style.display).toBe("block")
    expect(controller.defaultPromptProviderTarget.textContent).toBe("TypeSafe Jev")
  })

  it("sends a provider's own option only while that provider is selected", () => {
    const row = document.createElement("div")
    row.className = "provider-option-field"
    row.dataset.provider = "typesafe_jev"
    const floor = judgeOptionField("jev_min_confidence", "0.4")
    row.appendChild(floor)

    const controller = buildController({ providerOptionFieldTargets: [row] })
    controller.structuredFieldTargets = [...controller.structuredFieldTargets, floor]

    AiJudgeWizardController.prototype.showProviderOptionFields.call(controller, "typesafe_jev")
    expect(AiJudgeWizardController.prototype.judgeOptions.call(controller).jev_min_confidence).toBe("0.4")

    AiJudgeWizardController.prototype.showProviderOptionFields.call(controller, "openai")
    expect(floor.disabled).toBe(true)
    expect(AiJudgeWizardController.prototype.judgeOptions.call(controller)).not.toHaveProperty("jev_min_confidence")
  })

  it("disables Run Judgement for a provider that needs a scale when there is none", () => {
    const notice = document.createElement("div")
    const controller = buildController({ hasScaleValue: false, hasNeedsScaleNoticeTarget: true, needsScaleNoticeTarget: notice })
    controller.hasRunPromptButtonTarget = true

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(true)
    expect(notice.style.display).toBe("")

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_scale: false })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
    expect(notice.style.display).toBe("none")
  })

  it("lets a provider that needs a scale run once there is one", () => {
    const controller = buildController({ hasScaleValue: true })
    controller.hasRunPromptButtonTarget = true

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
  })
})

describe("AiJudgeWizardController include images switch", () => {
  function switchField(checked) {
    const field = judgeOptionField("llm_include_images", "true")
    field.type = "checkbox"
    field.checked = checked
    return field
  }

  it("sends the switch as true or false, not the checkbox's fixed value", () => {
    const field = switchField(false)
    const controller = buildController()
    controller.structuredFieldTargets = [...controller.structuredFieldTargets, field]

    expect(AiJudgeWizardController.prototype.judgeOptions.call(controller).llm_include_images).toBe("false")

    field.checked = true
    expect(AiJudgeWizardController.prototype.judgeOptions.call(controller).llm_include_images).toBe("true")
  })

  it("sets the switch from the JSON tab, treating anything but false as on", () => {
    const field = switchField(true)
    const element = document.createElement("div")
    element.appendChild(field)
    const controller = buildController({ element, hasJsonFieldTarget: true, hasLlmProviderTarget: false })

    controller.jsonFieldTarget = { value: JSON.stringify({ judge_options: { llm_include_images: false } }) }
    AiJudgeWizardController.prototype.applyJsonToFields.call(controller)
    expect(field.checked).toBe(false)

    controller.jsonFieldTarget = { value: JSON.stringify({ judge_options: { llm_include_images: "true" } }) }
    AiJudgeWizardController.prototype.applyJsonToFields.call(controller)
    expect(field.checked).toBe(true)
  })

  function imageSupportController(checked) {
    const field = switchField(checked)
    const hidden = document.createElement("input")
    hidden.type = "hidden"
    hidden.value = "false"
    const notice = document.createElement("div")
    notice.style.display = "none"
    const noticeProvider = document.createElement("span")
    const controller = buildController({
      hasIncludeImagesTarget: true,
      includeImagesTarget: field,
      hasIncludeImagesHiddenTarget: true,
      includeImagesHiddenTarget: hidden,
      hasIncludeImagesNoticeTarget: true,
      includeImagesNoticeTarget: notice,
      hasIncludeImagesNoticeProviderTarget: true,
      includeImagesNoticeProviderTarget: noticeProvider
    })
    controller.structuredFieldTargets = [...controller.structuredFieldTargets, field]
    return { controller, field, hidden, notice, noticeProvider }
  }

  it("disables the switch for a provider that cannot take images, and says which", () => {
    const { controller, field, hidden, notice, noticeProvider } = imageSupportController(true)

    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "Ollama", supports_images: false })

    expect(field.disabled).toBe(true)
    expect(field.checked).toBe(false)
    expect(notice.style.display).toBe("")
    expect(noticeProvider.textContent).toBe("Ollama")
    // the judge's own choice is still what gets saved
    expect(hidden.value).toBe("true")
    expect(AiJudgeWizardController.prototype.judgeOptions.call(controller).llm_include_images).toBe("true")
  })

  it("restores the judge's own choice on moving back to a provider that takes images", () => {
    const { controller, field, hidden, notice } = imageSupportController(false)

    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "TypeSafe Jev", supports_images: false })
    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "OpenAI", supports_images: true })

    expect(field.disabled).toBe(false)
    expect(field.checked).toBe(false)
    expect(notice.style.display).toBe("none")
    expect(hidden.value).toBe("false")

    field.checked = true
    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "Ollama", supports_images: false })
    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "Anthropic", supports_images: true })
    expect(field.checked).toBe(true)
  })

  it("keeps a JSON-tab edit as the choice while the provider cannot take images", () => {
    const { controller, field } = imageSupportController(true)
    const element = document.createElement("div")
    element.appendChild(field)
    Object.assign(controller, { element, hasJsonFieldTarget: true, hasLlmProviderTarget: false })

    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "Ollama", supports_images: false })
    controller.jsonFieldTarget = { value: JSON.stringify({ judge_options: { llm_include_images: false } }) }
    AiJudgeWizardController.prototype.applyJsonToFields.call(controller)
    AiJudgeWizardController.prototype.applyImageSupport.call(controller, { label: "OpenAI", supports_images: true })

    expect(field.checked).toBe(false)
  })
})

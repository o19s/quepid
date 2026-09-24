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
          explanation: "Perfect [LLM returned rating 3.0, outside this book's scale [0, 1]]"
        })
    })

    await AiJudgeWizardController.prototype.runPrompt.call(controller, {
      preventDefault: vi.fn()
    })

    expect(controller.ratingInfoTarget.innerHTML).toContain("Unrateable")
    expect(controller.ratingInfoTarget.innerHTML).not.toContain("null")
    expect(controller.ratingInfoTarget.innerHTML).toContain("outside this book")
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
  it("reveals step 2 and samples immediately when editing an existing judge", () => {
    const controller = buildController({ existingValue: true })
    controller.sampleQueryDocPair = vi.fn()
    controller.updateProviderPanels = vi.fn()

    AiJudgeWizardController.prototype.connect.call(controller)

    expect(controller.step2Target.style.display).toBe("block")
    expect(controller.sampleQueryDocPair).toHaveBeenCalledOnce()
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

  it("disables Run Judgement for a provider that needs a book when there is none", () => {
    const notice = document.createElement("div")
    const controller = buildController({ hasBookValue: false, hasNeedsBookNoticeTarget: true, needsBookNoticeTarget: notice })
    controller.hasRunPromptButtonTarget = true

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_book: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(true)
    expect(notice.style.display).toBe("")

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_book: false })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
    expect(notice.style.display).toBe("none")
  })

  it("lets a provider that needs a book run once there is one", () => {
    const controller = buildController({ hasBookValue: true })
    controller.hasRunPromptButtonTarget = true

    AiJudgeWizardController.prototype.updateRunAvailability.call(controller, { needs_book: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
  })
})

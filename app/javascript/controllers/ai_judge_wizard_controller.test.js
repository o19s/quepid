import { afterEach, describe, expect, it, vi } from "vitest"
import { apiFetch } from "api/fetch"
import AiJudgeWizardController from "./ai_judge_wizard_controller"

vi.mock("api/fetch", () => ({
  apiFetch: vi.fn(),
}))

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
  controller.llmProviderTarget = { value: "openai" }
  controller.hasLlmServiceUrlTarget = true
  controller.llmServiceUrlTarget = { value: "https://api.openai.com" }
  controller.hasLlmModelTarget = true
  controller.llmModelTarget = { value: "gpt-4o" }
  controller.hasLlmTimeoutTarget = true
  controller.llmTimeoutTarget = { value: "30" }
  controller.hasLlmApiVersionTarget = true
  controller.llmApiVersionTarget = { value: "" }

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
  controller.setButtonLoading = vi.fn()

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
            position: 1,
          },
        }),
    })

    await AiJudgeWizardController.prototype.sampleQueryDocPair.call(controller, {
      preventDefault: vi.fn(),
    })

    expect(apiFetch).toHaveBeenCalledWith("/ai_judges/new/sample_query_doc_pair", {
      headers: { Accept: "application/json" },
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
      json: () =>
        Promise.resolve({
          rating: 3,
          explanation: "Perfectly relevant.",
        }),
    })

    await AiJudgeWizardController.prototype.runPrompt.call(controller, {
      preventDefault: vi.fn(),
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
      llm_api_version: "",
    })

    expect(controller.ratingInfoTarget.innerHTML).toContain("Perfectly relevant.")
    expect(controller.ratingInfoTarget.style.display).toBe("block")
  })
})

describe("AiJudgeWizardController connect", () => {
  it("reveals step 2 and samples immediately when editing an existing judge", () => {
    const controller = buildController({ existingValue: true })
    controller.sampleQueryDocPair = vi.fn()
    controller.updateProviderHelp = vi.fn()

    AiJudgeWizardController.prototype.connect.call(controller)

    expect(controller.step2Target.style.display).toBe("block")
    expect(controller.sampleQueryDocPair).toHaveBeenCalledOnce()
  })
})

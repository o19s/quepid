import { describe, expect, it } from "vitest"
import AiJudgeFormController from "controllers/ai_judge_form_controller"
import { buildControllerFixture } from "../support/controller_fixture"

it("shows the provider's help and only overwrites provider fields on a provider change", () => {
  const preset = document.createElement("template")
  preset.innerHTML = "<strong>Provider help</strong>"
  preset.dataset.provider = "ollama"
  const provider = document.createElement("select")
  provider.innerHTML = '<option value="ollama">Ollama</option>'
  const url = document.createElement("input")
  url.value = "custom URL"
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: {
        ollama: {
          llm_service_url: "http://ollama:11434",
          llm_api_version: "",
          llm_model: "qwen",
          supports_images: false
        },
        openai: { supports_images: true }
      },
      stockPrompts: []
    },
    targets: {
      providerOptionField: [],
      provider,
      preset: [preset],
      help: document.createElement("div"),
      url,
      version: null,
      model: null
    }
  })
  controller.connect()
  expect(url.value).toBe("custom URL")
  expect(controller.helpTarget.textContent).toBe("Provider help")
  controller.providerChanged()
  expect(url.value).toBe("http://ollama:11434")
})

it("keeps image options disabled for Ollama and restores the saved checkbox state", () => {
  const images = document.createElement("input")
  images.type = "checkbox"
  images.checked = false
  const provider = document.createElement("select")
  provider.innerHTML =
    '<option value="ollama">Ollama</option><option value="openai">OpenAI</option>'
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: {
        ollama: {
          llm_service_url: "http://ollama:11434",
          llm_api_version: "",
          llm_model: "qwen",
          supports_images: false
        },
        openai: { supports_images: true }
      },
      stockPrompts: []
    },
    targets: {
      providerOptionField: [],
      provider,
      preset: [],
      help: document.createElement("div"),
      images
    }
  })
  controller.connect()
  expect(images.disabled).toBe(true)
  provider.value = "openai"
  controller.updateProviderPanels()
  expect(images.disabled).toBe(false)
  expect(images.checked).toBe(false)
})

function buildController(overrides = {}) {
  const controller = Object.create(AiJudgeFormController.prototype)
  Object.assign(
    controller,
    {
      hasProviderTarget: true,
      hasSystemPromptTarget: true,
      systemPromptTarget: { value: "" },
      providerOptionFieldTargets: [],
      stockPromptsValue: [],
      presetsValue: {},
      runPromptButtonTarget: document.createElement("button")
    },
    overrides
  )
  return controller
}

describe("AiJudgeFormController provider switching", () => {
  const presets = {
    openai: { system_prompt: "Chat prompt", prompt_label: "System prompt" },
    typesafe_jev: {
      system_prompt: "Jev instructions",
      prompt_label: "Judging instructions",
      read_only: ["llm_model"]
    }
  }

  it("swaps in the new provider's default over an untouched stock prompt", () => {
    const controller = buildController({
      presetsValue: presets,
      stockPromptsValue: ["Chat prompt", "Jev instructions"],
      systemPromptTarget: { value: "Chat prompt\r\n" }
    })

    AiJudgeFormController.prototype.offerDefaultSystemPrompt.call(controller, presets.typesafe_jev)

    expect(controller.systemPromptTarget.value).toBe("Jev instructions")
  })

  it("never replaces a prompt somebody wrote", () => {
    const controller = buildController({
      presetsValue: presets,
      stockPromptsValue: ["Chat prompt", "Jev instructions"],
      systemPromptTarget: { value: "Only rate wine labels." }
    })

    AiJudgeFormController.prototype.offerDefaultSystemPrompt.call(controller, presets.typesafe_jev)

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
      providerTarget: select,
      hasSystemPromptWarningTarget: true,
      systemPromptWarningTarget: warning,
      hasDefaultPromptProviderTarget: true,
      defaultPromptProviderTarget: document.createElement("span")
    })

    AiJudgeFormController.prototype.describePromptField.call(controller, presets.typesafe_jev)

    expect(warning.style.display).toBe("block")
    expect(controller.defaultPromptProviderTarget.textContent).toBe("TypeSafe Jev")
  })

  it("disables Run Judgement for a provider that needs a scale when there is none", () => {
    const notice = document.createElement("div")
    const controller = buildController({
      hasScaleValue: false,
      hasNeedsScaleNoticeTarget: true,
      needsScaleNoticeTarget: notice
    })
    controller.hasRunPromptButtonTarget = true

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(true)
    expect(notice.style.display).toBe("")

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: false })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
    expect(notice.style.display).toBe("none")
  })

  it("lets a provider that needs a scale run once there is one, and drops the notice", () => {
    const notice = document.createElement("div")
    const controller = buildController({
      hasScaleValue: true,
      hasNeedsScaleNoticeTarget: true,
      needsScaleNoticeTarget: notice
    })
    controller.hasRunPromptButtonTarget = true

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
    // The scale picker lives outside the notice, so it stays without it.
    expect(notice.style.display).toBe("none")
  })
})

it("keeps the wanted image choice across unsupported providers", () => {
  const images = document.createElement("input")
  images.id = "judge_options_llm_include_images"
  images.type = "checkbox"
  images.checked = true
  const hidden = document.createElement("input")
  const provider = document.createElement("select")
  provider.innerHTML =
    '<option value="openai">OpenAI</option><option value="typesafe_jev">Jev</option>'
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: { openai: { supports_images: true }, typesafe_jev: { supports_images: false } },
      stockPrompts: []
    },
    targets: {
      providerOptionField: [],
      provider,
      preset: [],
      help: document.createElement("div"),
      images,
      imagesHidden: hidden
    }
  })
  controller.connect()
  provider.value = "typesafe_jev"
  controller.syncImages()
  expect(images.checked).toBe(false)
  expect(hidden.value).toBe("true")
  provider.value = "openai"
  controller.syncImages()
  expect(images.checked).toBe(true)
  expect(images.disabled).toBe(false)
  images.checked = false
  provider.value = "typesafe_jev"
  controller.syncImages()
  expect(hidden.value).toBe("false")
  provider.value = "openai"
  controller.syncImages()
  expect(images.checked).toBe(false)
})

it("gates Run Prompt on whether the chosen provider needs a scale", () => {
  const provider = document.createElement("select")
  provider.innerHTML =
    '<option value="typesafe_jev">Jev</option><option value="openai">OpenAI</option>'
  const run = document.createElement("button")
  const notice = document.createElement("div")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: { typesafe_jev: { needs_scale: true }, openai: { needs_scale: false } },
      stockPrompts: [],
      hasScale: false
    },
    targets: {
      providerOptionField: [],
      preset: [],
      provider,
      help: document.createElement("div"),
      runPromptButton: run,
      needsScaleNotice: notice
    }
  })
  controller.connect()
  expect(run.disabled).toBe(true)
  expect(notice.style.display).toBe("")
  provider.value = "openai"
  controller.updateRunAvailability()
  expect(run.disabled).toBe(false)
  expect(notice.style.display).toBe("none")
  provider.value = "typesafe_jev"
  controller.updateRunAvailability()
  expect(run.disabled).toBe(true)
  controller.hasScaleValue = true
  controller.updateRunAvailability()
  expect(run.disabled).toBe(false)
})

it("takes the provider from a chosen connection", () => {
  const provider = document.createElement("select")
  provider.innerHTML =
    '<option value="openai">OpenAI</option><option value="ollama">Ollama</option>'
  const row = document.createElement("div")
  row.className = "row d-none"
  row.append(provider)
  const connection = document.createElement("select")
  connection.innerHTML =
    '<option value="">Choose a connection</option><option value="3" data-provider="ollama">Local (Ollama)</option>'
  const model = document.createElement("input")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: { ollama: { llm_model: "qwen" }, openai: { llm_model: "gpt-4o" } },
      stockPrompts: []
    },
    overrides: { offerDefaultSystemPrompt() {}, updateProviderPanels() {} },
    targets: { provider, connection, model }
  })

  connection.value = "3"
  controller.connectionChanged()
  expect(provider.value).toBe("ollama")
  expect(model.value).toBe("qwen")
  expect(row.classList.contains("d-none")).toBe(false)
})

it("hides the provider row again when the connection is cleared", () => {
  // A fresh <select> per assertion: happy-dom's selectedOptions goes stale after the first
  // read on a given element, so re-reading it post-clear on the same node this test built
  // for "chosen" wouldn't reflect the real browser's live-updating selectedOptions.
  const provider = document.createElement("select")
  provider.innerHTML =
    '<option value="openai">OpenAI</option><option value="ollama">Ollama</option>'
  const row = document.createElement("div")
  row.className = "row" // Already visible, as if a connection was chosen earlier.
  row.append(provider)
  const connection = document.createElement("select")
  connection.innerHTML =
    '<option value="" selected>Choose a connection</option><option value="3" data-provider="ollama">Local (Ollama)</option>'
  const model = document.createElement("input")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: {
      presets: { ollama: { llm_model: "qwen" }, openai: { llm_model: "gpt-4o" } },
      stockPrompts: []
    },
    overrides: { offerDefaultSystemPrompt() {}, updateProviderPanels() {} },
    targets: { provider, connection, model }
  })

  controller.connectionChanged()
  expect(row.classList.contains("d-none")).toBe(true)
})

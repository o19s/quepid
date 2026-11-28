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

describe("images on an opt-in provider and the Advanced section (ADR 0009)", () => {
  const presets = {
    openai: {
      label: "OpenAI",
      supports_images: true,
      images_by_default: true,
      image_types: ["url", "base64"],
      image_dimensions: { min: 32, max: 2048, recommended: 768 }
    },
    typesafe_jev: {
      label: "TypeSafe Jev",
      supports_images: true,
      images_by_default: false,
      image_types: ["base64"],
      image_dimensions: { min: 280, max: 1568, recommended: 300 }
    },
    anthropic: {
      label: "Anthropic",
      supports_images: true,
      images_by_default: true,
      image_types: ["url"],
      image_dimensions: null
    }
  }

  function build(checked = true) {
    const images = document.createElement("input")
    images.type = "checkbox"
    images.checked = checked
    const provider = document.createElement("select")
    provider.innerHTML = Object.keys(presets)
      .map((key) => `<option value="${key}">${key}</option>`)
      .join("")
    const imageType = document.createElement("select")
    const imageDimensions = document.createElement("input")
    imageDimensions.type = "number"
    const targets = {
      providerOptionField: [],
      provider,
      preset: [],
      help: document.createElement("div"),
      images,
      imagesHidden: document.createElement("input"),
      advanced: document.createElement("div"),
      imageType,
      imageTypeHidden: document.createElement("input"),
      imageTypeHint: document.createElement("div"),
      imageDimensions,
      imageDimensionsHint: document.createElement("div")
    }
    const controller = buildControllerFixture(AiJudgeFormController, {
      values: { presets, stockPrompts: [] },
      targets
    })
    controller.connect()
    return { controller, ...targets }
  }

  function switchTo(controller, provider, key) {
    provider.value = key
    controller.providerChanged()
  }

  it("starts the switch off when switching to Jev, and restores the other choice on the way back", () => {
    const { controller, provider, images } = build(true)
    switchTo(controller, provider, "typesafe_jev")
    expect(images.disabled).toBe(false)
    expect(images.checked).toBe(false)
    images.checked = true
    controller.syncImageSettings()
    switchTo(controller, provider, "openai")
    expect(images.checked).toBe(true)
    images.checked = false
    switchTo(controller, provider, "typesafe_jev")
    expect(images.checked).toBe(false)
    switchTo(controller, provider, "openai")
    expect(images.checked).toBe(false)
  })

  it("keeps a saved Jev choice when the page loads", () => {
    const images = document.createElement("input")
    images.type = "checkbox"
    images.checked = true
    const provider = document.createElement("select")
    provider.innerHTML = '<option value="typesafe_jev">Jev</option>'
    buildControllerFixture(AiJudgeFormController, {
      values: { presets, stockPrompts: [] },
      targets: {
        providerOptionField: [],
        provider,
        preset: [],
        help: document.createElement("div"),
        images
      }
    }).connect()
    expect(images.checked).toBe(true)
  })

  it("locks Jev to base64 and offers both types for OpenAI", () => {
    const { controller, provider, images, imageType, imageTypeHidden, imageTypeHint } = build()
    switchTo(controller, provider, "typesafe_jev")
    images.checked = true
    controller.syncImageSettings()
    expect([...imageType.options].map((option) => option.value)).toEqual(["base64"])
    expect(imageType.disabled).toBe(true)
    expect(imageTypeHidden.value).toBe("base64")
    expect(imageTypeHidden.disabled).toBe(false)
    expect(imageTypeHint.textContent).toBe("Fixed for TypeSafe Jev.")

    switchTo(controller, provider, "openai")
    expect([...imageType.options].map((option) => option.value)).toEqual(["url", "base64"])
    expect(imageType.disabled).toBe(false)
    expect(imageType.value).toBe("url")
    expect(imageTypeHint.textContent).toBe("")
  })

  it("takes the dimension bounds and recommended size from the provider, and only for base64", () => {
    const { controller, provider, images, imageType, imageDimensions, imageDimensionsHint } =
      build()
    switchTo(controller, provider, "typesafe_jev")
    images.checked = true
    controller.syncImageSettings()
    expect(imageDimensions.min).toBe("280")
    expect(imageDimensions.max).toBe("1568")
    expect(imageDimensions.value).toBe("")
    expect(imageDimensions.placeholder).toBe("300")
    expect(imageDimensionsHint.textContent).toContain("Blank uses the recommended 300 px.")
    expect(imageDimensionsHint.textContent).toContain(
      "fewer tokens, but can make judgements less accurate"
    )
    expect(imageDimensions.disabled).toBe(false)

    switchTo(controller, provider, "openai")
    expect(imageDimensions.max).toBe("2048")
    expect(imageDimensions.placeholder).toBe("768")
    expect(imageDimensions.disabled).toBe(true)
    imageType.value = "base64"
    controller.syncImageSettings()
    expect(imageDimensions.disabled).toBe(false)
  })

  it("sends nothing from the section while images are off, and hides it when there is nothing to pick", () => {
    const { controller, provider, images, advanced, imageType, imageTypeHidden, imageDimensions } =
      build()
    switchTo(controller, provider, "openai")
    images.checked = false
    controller.syncImageSettings()
    expect(imageType.disabled).toBe(true)
    expect(imageTypeHidden.disabled).toBe(true)
    expect(imageDimensions.disabled).toBe(true)
    expect(advanced.style.display).toBe("")

    switchTo(controller, provider, "anthropic")
    expect(advanced.style.display).toBe("none")
  })
})

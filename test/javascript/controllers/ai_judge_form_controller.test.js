import { describe, expect, it } from "vitest"
import AiJudgeFormController from "controllers/ai_judge_form_controller"
import { buildControllerFixture } from "../support/controller_fixture"

it("restores the active tab and only overwrites provider fields on a provider change", () => {
  const preset = document.createElement("template")
  preset.innerHTML = "<strong>Provider help</strong>"
  Object.assign(preset.dataset, { provider: "ollama", url: "http://ollama:11434", version: "", model: "qwen" })
  const provider = document.createElement("select")
  provider.innerHTML = '<option value="ollama">Ollama</option>'
  const jsonTab = document.createElement("button")
  jsonTab.classList.add("active")
  const url = document.createElement("input")
  url.value = "custom URL"
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { presets: { ollama: { llm_service_url: "http://ollama:11434", llm_api_version: "", llm_model: "qwen", supports_images: false }, openai: { supports_images: true } }, stockPrompts: [] },
    targets: { providerOptionField: [], provider, preset: [preset], help: document.createElement("div"), structured: [url], json: document.createElement("textarea"), jsonTab, url, version: null, model: null }
  })
  controller.connect()
  expect(url.disabled).toBe(true)
  expect(url.value).toBe("custom URL")
  expect(controller.jsonTarget.disabled).toBe(false)
  expect(controller.helpTarget.textContent).toBe("Provider help")
  controller.providerChanged()
  expect(url.value).toBe("http://ollama:11434")
  jsonTab.classList.remove("active")
  controller.syncTab()
  expect(url.disabled).toBe(false)
  expect(controller.jsonTarget.disabled).toBe(true)
})

it("keeps image options disabled for Ollama and JSON editing and restores the saved checkbox state", () => {
  const images = document.createElement("input")
  images.type = "checkbox"
  images.checked = false
  const provider = document.createElement("select")
  provider.innerHTML = '<option value="ollama">Ollama</option><option value="openai">OpenAI</option>'
  const jsonTab = document.createElement("button")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { presets: { ollama: { llm_service_url: "http://ollama:11434", llm_api_version: "", llm_model: "qwen", supports_images: false }, openai: { supports_images: true } }, stockPrompts: [] },
    targets: { providerOptionField: [], provider, preset: [], help: document.createElement("div"), structured: [images], images, json: document.createElement("textarea"), jsonTab }
  })
  controller.connect()
  expect(images.disabled).toBe(true)
  provider.value = "openai"
  controller.syncTab()
  expect(images.disabled).toBe(false)
  expect(images.checked).toBe(false)
  jsonTab.classList.add("active")
  controller.syncTab()
  expect(images.disabled).toBe(true)
})

function buildController(overrides = {}) {
  const controller = Object.create(AiJudgeFormController.prototype)
  Object.assign(controller, {
    hasProviderTarget: true,
    hasSystemPromptTarget: true, systemPromptTarget: { value: "" },
    providerOptionFieldTargets: [], stockPromptsValue: [], presetsValue: {},
    runPromptButtonTarget: document.createElement("button")
  }, overrides)
  return controller
}

describe("AiJudgeFormController provider switching", () => {
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
    const controller = buildController({ hasScaleValue: false, hasNeedsScaleNoticeTarget: true, needsScaleNoticeTarget: notice })
    controller.hasRunPromptButtonTarget = true

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(true)
    expect(notice.style.display).toBe("")

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: false })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
    expect(notice.style.display).toBe("none")
  })

  it("lets a provider that needs a scale run once there is one", () => {
    const controller = buildController({ hasScaleValue: true })
    controller.hasRunPromptButtonTarget = true

    AiJudgeFormController.prototype.updateRunAvailability.call(controller, { needs_scale: true })
    expect(controller.runPromptButtonTarget.disabled).toBe(false)
  })
})


it("keeps the wanted image choice across unsupported providers and JSON edits", () => {
  const images = document.createElement("input")
  images.id = "judge_options_llm_include_images"
  images.type = "checkbox"
  images.checked = true
  const hidden = document.createElement("input")
  const provider = document.createElement("select")
  provider.innerHTML = '<option value="openai">OpenAI</option><option value="typesafe_jev">Jev</option>'
  const jsonTab = document.createElement("button")
  const json = document.createElement("textarea")
  json.value = '{"other":{"retained":true},"judge_options":{"custom":"retained"}}'
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { presets: { openai: { supports_images: true }, typesafe_jev: { supports_images: false } }, stockPrompts: [] },
    targets: { providerOptionField: [], provider, preset: [], help: document.createElement("div"),
      structured: [images], images, imagesHidden: hidden, json, jsonTab }
  })
  controller.connect()
  provider.value = "typesafe_jev"
  controller.syncImages()
  expect(images.checked).toBe(false)
  expect(hidden.value).toBe("true")
  jsonTab.classList.add("active")
  controller.syncTab()
  expect(JSON.parse(json.value)).toEqual({ other: { retained: true }, judge_options: { custom: "retained", llm_include_images: "true" } })
  json.value = '{"judge_options":{"llm_include_images":false}}'
  jsonTab.classList.remove("active")
  controller.syncTab()
  provider.value = "openai"
  controller.syncImages()
  expect(images.checked).toBe(false)
  expect(images.disabled).toBe(false)
  images.checked = true
  provider.value = "typesafe_jev"
  controller.syncImages()
  provider.value = "openai"
  controller.syncImages()
  expect(images.checked).toBe(true)
})

it("clears a removed confidence floor across JSON and structured tab switches", () => {
  const confidence = document.createElement("input")
  confidence.id = "judge_options_jev_min_confidence"
  confidence.type = "number"
  confidence.value = "0.9"
  const json = document.createElement("textarea")
  json.value = '{"judge_options":{"jev_min_confidence":"0.9"}}'
  const jsonTab = document.createElement("button")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { presets: {}, stockPrompts: [] },
    targets: { providerOptionField: [], preset: [], help: document.createElement("div"),
      structured: [confidence], json, jsonTab }
  })
  controller.connect()
  jsonTab.classList.add("active")
  controller.syncTab()
  json.value = '{"judge_options":{}}'
  jsonTab.classList.remove("active")
  controller.syncTab()
  expect(confidence.value).toBe("")
  jsonTab.classList.add("active")
  controller.syncTab()
  expect(JSON.parse(json.value).judge_options.jev_min_confidence).toBe("")
})

it("gates the active JSON provider and allows malformed JSON errors to be retried", () => {
  const jsonTab = document.createElement("button")
  jsonTab.classList.add("active")
  const json = document.createElement("textarea")
  const provider = document.createElement("select")
  provider.innerHTML = '<option value="typesafe_jev">Jev</option>'
  const run = document.createElement("button")
  const notice = document.createElement("div")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { presets: { typesafe_jev: { needs_scale: true }, openai: { needs_scale: false } },
      stockPrompts: [], hasScale: false },
    targets: { providerOptionField: [], preset: [], provider, help: document.createElement("div"),
      structured: [], json, jsonTab, runPromptButton: run, needsScaleNotice: notice }
  })
  json.value = '{"judge_options":{"llm_provider":"typesafe_jev"}}'
  controller.connect()
  expect(run.disabled).toBe(true)
  json.value = '{"judge_options":{"llm_provider":"openai"}}'
  controller.jsonChanged()
  expect(run.disabled).toBe(false)
  expect(notice.style.display).toBe("none")
  json.value = '{"judge_options":{"llm_provider":"typesafe_jev"}}'
  controller.jsonChanged()
  expect(run.disabled).toBe(true)
  json.value = '{'
  controller.jsonChanged()
  expect(run.disabled).toBe(false)
  json.value = '{"judge_options":{"llm_provider":"typesafe_jev"}}'
  controller.hasScaleValue = true
  controller.jsonChanged()
  expect(run.disabled).toBe(false)
})

it("restores effective connection defaults for omitted keys without restoring a deleted confidence floor", () => {
  const defaults = { llm_provider: "openai", llm_service_url: "https://api.openai.com", llm_model: "gpt-4o", llm_timeout: 30 }
  const fields = Object.keys(defaults).concat("jev_min_confidence").map(key => {
    const input = document.createElement("input")
    input.id = `judge_options_${key}`
    input.value = "old value"
    return input
  })
  const json = document.createElement("textarea")
  const controller = buildControllerFixture(AiJudgeFormController, {
    values: { optionDefaults: defaults }, targets: { structured: fields, json }
  })
  for (const config of [{ judge_options: {} }, {}]) {
    json.value = JSON.stringify(config)
    controller.applyJsonToFields()
    controller.showFieldsAsJson()
    expect(JSON.parse(json.value).judge_options).toEqual({
      ...defaults, llm_timeout: "30", jev_min_confidence: ""
    })
  }
  json.value = '{"judge_options":{"llm_service_url":"https://custom.example","llm_model":"","llm_timeout":null}}'
  controller.applyJsonToFields()
  controller.showFieldsAsJson()
  expect(JSON.parse(json.value).judge_options).toEqual({
    llm_provider: "openai", llm_service_url: "https://custom.example", llm_model: "",
    llm_timeout: "", jev_min_confidence: ""
  })
})

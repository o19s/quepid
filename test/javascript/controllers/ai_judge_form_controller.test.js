import { expect, it } from "vitest"
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
    targets: { provider, preset: [preset], help: document.createElement("div"), structured: [url], json: document.createElement("textarea"), jsonTab, url, version: null, model: null }
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

import { beforeEach, afterEach, expect, it, vi } from "vitest"
import AiJudgeWizardController from "controllers/ai_judge_wizard_controller"
import { buildControllerFixture } from "../support/controller_fixture"
import { getJson, postJson } from "api/json"
import { HttpError } from "api/http_error"

vi.mock("api/json", () => ({ getJson: vi.fn(), postJson: vi.fn() }))

function fixture() {
  const form = document.createElement("form")
  form.innerHTML = '<input name="user[llm_key]" value="key"><textarea name="user[system_prompt]">draft</textarea><input name="user[judge_options][llm_provider]" value="openai"><input name="user[judge_options][llm_include_images]" value="false">'
  const element = document.createElement("div")
  form.appendChild(element)
  const targets = Object.fromEntries(AiJudgeWizardController.targets.map(name => [name, document.createElement(name === "runPromptButton" ? "button" : ["rating", "explanation", "status", "ratingInfo", "step2", "loadingSpinner"].includes(name) ? "div" : "input")]))
  targets.step2.style.display = "none"
  const controller = buildControllerFixture(AiJudgeWizardController, {
    element, targets, values: { sampleUrl: "sample", testUrl: "test", existing: false }
  })
  getJson.mockResolvedValue({ query_doc_pair: { query_text: "q", doc_id: "d", document_fields: {}, options: {}, position: 0 } })
  controller.connect()
  return controller
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.restoreAllMocks())

it("reveals testing once a name is entered and samples only once", async () => {
  const c = fixture()
  c.checkReveal()
  expect(getJson).not.toHaveBeenCalled()
  c.nameTarget.value = "Judge"
  c.checkReveal()
  c.checkReveal()
  await vi.waitFor(() => expect(c.queryTextTarget.value).toBe("q"))
  expect(getJson).toHaveBeenCalledTimes(1)
  expect(c.positionTarget.value).toBe("0")
})

it("uses the active JSON configuration and current editor content with image preferences", async () => {
  const c = fixture()
  const form = c.element.closest("form")
  const json = document.createElement("textarea")
  json.name = "user[options]"
  json.value = '{"judge_options":{"llm_provider":"ollama","llm_include_images":false}}'
  form.appendChild(json)
  c.documentFieldsTarget.editor = { getValue: () => '{"title":"Edited"}' }
  postJson.mockResolvedValue({ rating: 0, explanation: "<script>text</script>" })
  await c.runPrompt({ preventDefault() {} })
  expect(postJson).toHaveBeenCalledWith("test", expect.objectContaining({
    system_prompt: "draft", judge_options: { llm_provider: "ollama", llm_include_images: false },
    query_doc_pair: expect.objectContaining({ document_fields: '{"title":"Edited"}' })
  }), expect.anything())
  expect(c.ratingTarget.textContent).toBe("0")
  expect(c.explanationTarget.textContent).toBe("<script>text</script>")
  expect(c.explanationTarget.querySelector("script")).toBeNull()
})

it("shows server failures and restores the button without showing a stale rating", async () => {
  const c = fixture()
  postJson.mockRejectedValue(new HttpError({ status: 422, data: { error: "Invalid JSON" } }))
  await c.runPrompt({ preventDefault() {} })
  expect(c.statusTarget.textContent).toContain("Invalid JSON")
  expect(c.ratingInfoTarget.style.display).toBe("none")
  expect(c.runPromptButtonTarget.disabled).toBe(false)
  expect(c.loadingSpinnerTarget.style.display).toBe("none")
})

it("aborts requests on Turbo disconnect and ignores a stale sample", async () => {
  const c = fixture()
  let resolveSample
  getJson.mockReturnValue(new Promise(resolve => { resolveSample = resolve }))
  const sampling = c.sampleQueryDocPair()
  c.disconnect()
  resolveSample({ query_doc_pair: { query_text: "stale" } })
  await sampling
  expect(c.abortController.signal.aborted).toBe(true)
  expect(c.queryTextTarget.value).toBe("")
})

it("shows rejected ratings as Unrateable and clears that state on a successful retry", async () => {
  const c = fixture()
  postJson.mockResolvedValue({ rating: null, unrateable: true, explanation: "Low confidence" })
  await c.runPrompt({ preventDefault() {} })
  expect(c.unrateableTarget.style.display).toBe("")
  expect(c.ratingTarget.textContent).toBe("")
  postJson.mockResolvedValue({ rating: 0, unrateable: false, explanation: "Accepted zero" })
  await c.runPrompt({ preventDefault() {} })
  expect(c.unrateableTarget.style.display).toBe("none")
  expect(c.ratingTarget.textContent).toBe("0")
})

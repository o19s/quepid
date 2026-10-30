import { beforeEach, afterEach, expect, it, vi } from "vitest"
import AiJudgeWizardController from "controllers/ai_judge_wizard_controller"
import { buildControllerFixture } from "../support/controller_fixture"
import { getJson, postJson } from "api/json"
import { HttpError } from "api/http_error"

vi.mock("api/json", () => ({ getJson: vi.fn(), postJson: vi.fn() }))

function fixture(valueOverrides = {}) {
  const form = document.createElement("form")
  form.innerHTML =
    '<input name="user[llm_key]" value="key"><textarea name="user[system_prompt]">draft</textarea><input name="user[judge_options][llm_provider]" value="openai"><input name="user[judge_options][llm_include_images]" value="false">'
  const element = document.createElement("div")
  form.appendChild(element)
  const targets = Object.fromEntries(
    AiJudgeWizardController.targets.map((name) => [
      name,
      document.createElement(
        name === "runPromptButton"
          ? "button"
          : ["rating", "explanation", "status", "ratingInfo", "step2", "loadingSpinner"].includes(
                name
              )
            ? "div"
            : "input"
      )
    ])
  )
  targets.step2.style.display = "none"
  const controller = buildControllerFixture(AiJudgeWizardController, {
    element,
    targets,
    values: { sampleUrl: "sample", testUrl: "test", existing: false, ...valueOverrides }
  })
  getJson.mockResolvedValue({
    query_doc_pair: { query_text: "q", doc_id: "d", document_fields: {}, options: {}, position: 0 }
  })
  controller.connect()
  return controller
}

// saveDraft/restoreDraft walk the real DOM via this.element.closest("form"),
// not the mocked target objects fixture() otherwise uses for everything else -
// so the name target here is a real named field, not a detached stand-in, and
// connect() is left for the caller to trigger once the draft (if any) is set up.
function draftFixture(valueOverrides = {}) {
  const form = document.createElement("form")
  form.innerHTML = '<input name="user[name]" value="">'
  const element = document.createElement("div")
  form.appendChild(element)
  const targets = Object.fromEntries(
    AiJudgeWizardController.targets.map((name) => [
      name,
      document.createElement(
        name === "runPromptButton"
          ? "button"
          : ["rating", "explanation", "status", "ratingInfo", "step2", "loadingSpinner"].includes(
                name
              )
            ? "div"
            : "input"
      )
    ])
  )
  targets.step2.style.display = "none"
  targets.name = form.querySelector('[name="user[name]"]')
  const controller = buildControllerFixture(AiJudgeWizardController, {
    element,
    targets,
    values: {
      sampleUrl: "sample",
      testUrl: "test",
      existing: false,
      draftKey: "new",
      ...valueOverrides
    }
  })
  getJson.mockResolvedValue({
    query_doc_pair: { query_text: "q", doc_id: "d", document_fields: {}, options: {}, position: 0 }
  })
  return controller
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  vi.restoreAllMocks()
  sessionStorage.clear()
})

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

it("reveals step 2 and samples immediately when editing an existing judge", async () => {
  const c = fixture({ existing: true })
  expect(c.step2Target.style.display).toBe("block")
  await vi.waitFor(() => expect(c.queryTextTarget.value).toBe("q"))
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
  expect(postJson).toHaveBeenCalledWith(
    "test",
    expect.objectContaining({
      system_prompt: "draft",
      judge_options: { llm_provider: "ollama", llm_include_images: false },
      query_doc_pair: expect.objectContaining({ document_fields: '{"title":"Edited"}' })
    }),
    expect.anything()
  )
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
  getJson.mockReturnValue(
    new Promise((resolve) => {
      resolveSample = resolve
    })
  )
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

it("scrolls to Test & Refine when the url carries ?scorer_id=", () => {
  const originalLocation = window.location
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { search: "?scorer_id=3" }
  })

  const c = fixture()
  const section = document.createElement("div")
  section.id = "test-and-refine"
  section.scrollIntoView = vi.fn()
  section.appendChild(c.step2Target)

  c.scrollToStep2IfRequested()

  expect(section.scrollIntoView).toHaveBeenCalledWith({ block: "start" })
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
})

it("does not scroll without ?scorer_id=", () => {
  const c = fixture()
  const section = document.createElement("div")
  section.id = "test-and-refine"
  section.scrollIntoView = vi.fn()
  section.appendChild(c.step2Target)

  c.scrollToStep2IfRequested()

  expect(section.scrollIntoView).not.toHaveBeenCalled()
})

it("navigateToScale saves a draft and navigates to the picked option's url", () => {
  const originalLocation = window.location
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { href: "http://localhost/ai_judges/new" }
  })

  const c = draftFixture()
  c.saveDraft = vi.fn(AiJudgeWizardController.prototype.saveDraft.bind(c))

  const select = document.createElement("select")
  const option = document.createElement("option")
  option.value = "3"
  option.dataset.url = "/ai_judges/new?scorer_id=3"
  select.appendChild(option)
  select.selectedIndex = 0

  c.navigateToScale({ target: select })

  expect(c.saveDraft).toHaveBeenCalledOnce()
  expect(window.location.href).toBe("/ai_judges/new?scorer_id=3")

  Object.defineProperty(window, "location", { configurable: true, value: originalLocation })
})

it("navigateToScale does nothing for the blank placeholder option", () => {
  const c = draftFixture()
  c.saveDraft = vi.fn()

  const select = document.createElement("select")
  const option = document.createElement("option")
  option.value = ""
  select.appendChild(option)
  select.selectedIndex = 0

  c.navigateToScale({ target: select })

  expect(c.saveDraft).not.toHaveBeenCalled()
})

it("connect() restores a saved draft, including the name field, and reveals step 2", async () => {
  const c = draftFixture()
  c.nameTarget.value = "Draft Judge"
  c.saveDraft()

  const restored = draftFixture()
  restored.connect()

  expect(restored.nameTarget.value).toBe("Draft Judge")
  expect(restored.step2Target.style.display).toBe("block")
  await vi.waitFor(() => expect(getJson).toHaveBeenCalled())
})

it("clears the stored draft once restored, so a later plain connect doesn't reapply it", () => {
  const c = draftFixture()
  c.nameTarget.value = "Draft Judge"
  c.saveDraft()

  draftFixture().connect()

  expect(sessionStorage.getItem("ai_judge_wizard_draft:new")).toBeNull()
})

it("restoreDraft is a no-op when nothing was saved", () => {
  const c = draftFixture()
  expect(() => c.connect()).not.toThrow()
  expect(c.nameTarget.value).toBe("")
})

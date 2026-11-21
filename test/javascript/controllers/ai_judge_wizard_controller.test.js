import { beforeEach, afterEach, expect, it, vi } from "vitest"
import AiJudgeWizardController from "controllers/ai_judge_wizard_controller"
import { buildControllerFixture } from "../support/controller_fixture"
import { getJson, postJson } from "api/json"
import { HttpError } from "api/http_error"

vi.mock("api/json", () => ({ getJson: vi.fn(), postJson: vi.fn() }))

function fixture(valueOverrides = {}) {
  const form = document.createElement("form")
  form.innerHTML =
    '<select name="user[connection_id]"><option value="7" selected>OpenAI</option></select><textarea name="user[system_prompt]">draft</textarea><input name="user[judge_options][llm_provider]" value="openai"><input name="user[judge_options][llm_include_images]" value="false">'
  const element = document.createElement("div")
  form.appendChild(element)
  const targets = Object.fromEntries(
    AiJudgeWizardController.targets.map((name) => [
      name,
      document.createElement(
        { runPromptButton: "button", scalePicker: "select", supportedScales: "textarea" }[name] ??
          ([
            "rating",
            "explanation",
            "status",
            "ratingInfo",
            "step2",
            "loadingSpinner",
            "scaleFrame",
            "scaleState",
            "noScaleFits",
            "unsupportedScaleNote"
          ].includes(name)
            ? "div"
            : "input")
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
      connection_id: "7",
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

function addScaleOptions(c, scales) {
  c.scalePickerTarget.innerHTML = '<option value="">Select a rating scale...</option>'
  scales.forEach((scale, i) => {
    const option = document.createElement("option")
    option.value = String(i + 1)
    option.dataset.scale = scale
    option.dataset.url = `/ai_judges/18/edit?scorer_id=${i + 1}`
    c.scalePickerTarget.appendChild(option)
  })
}

const groups = (c) =>
  Object.fromEntries(
    [...c.scalePickerTarget.querySelectorAll("optgroup")].map((g) => [
      g.label,
      [...g.children].map((o) => o.dataset.scale)
    ])
  )
const ungrouped = (c) =>
  [...c.scalePickerTarget.children]
    .filter((o) => o.tagName === "OPTION" && o.value)
    .map((o) => o.dataset.scale)

it("filterScales splits scales into supported and unsupported groups, matching in any order", () => {
  const c = fixture()
  addScaleOptions(c, ["0,1", "0,1,2", "0,1,2,3"])

  c.supportedScalesTarget.value = "3,2,1,0\n"
  c.filterScales()
  expect(groups(c)).toEqual({
    "Supported scales": ["0,1,2,3"],
    "Unsupported scales": ["0,1", "0,1,2"]
  })
  expect(ungrouped(c)).toEqual([])
  expect(c.noScaleFitsTarget.style.display).toBe("none")

  c.supportedScalesTarget.value = ""
  c.filterScales()
  expect(groups(c)).toEqual({})
  expect(ungrouped(c)).toEqual(["0,1", "0,1,2", "0,1,2,3"])
})

it("filterScales ignores a limit that isn't whole numbers yet, and says when nothing fits", () => {
  const c = fixture()
  addScaleOptions(c, ["0,1"])

  c.supportedScalesTarget.value = "0,1,x"
  c.filterScales()
  expect(ungrouped(c)).toEqual(["0,1"])

  c.supportedScalesTarget.value = "0,1,2,3,4"
  c.filterScales()
  expect(groups(c)).toEqual({ "Unsupported scales": ["0,1"] })
  expect(c.noScaleFitsTarget.style.display).toBe("")
})

it("filterScales keeps the selection while regrouping", () => {
  const c = fixture()
  addScaleOptions(c, ["0,1", "0,1,2,3"])
  c.scalePickerTarget.value = "1"

  c.supportedScalesTarget.value = "0,1,2,3"
  c.filterScales()

  expect(c.scalePickerTarget.value).toBe("1")
})

it("keeps Run Prompt off while the shown scale is outside the limit, and back on once it fits", () => {
  const c = fixture()
  c.scaleStateTarget.dataset.scale = "0,1"
  c.runPromptButtonTarget.disabled = false

  c.supportedScalesTarget.value = "0,1,2,3"
  c.filterScales()
  expect(c.runPromptButtonTarget.disabled).toBe(true)
  expect(c.runPromptButtonTarget.dataset.unsupportedScale).toBe("true")
  expect(c.unsupportedScaleNoteTarget.style.display).toBe("")

  c.supportedScalesTarget.value = "0,1,2,3\n0,1"
  c.filterScales()
  expect(c.runPromptButtonTarget.dataset.unsupportedScale).toBe("false")
  expect(c.unsupportedScaleNoteTarget.style.display).toBe("none")
})

it("pickScale loads the picked scale into the frame instead of navigating", () => {
  const c = fixture()
  addScaleOptions(c, ["0,1,2,3"])
  c.scalePickerTarget.value = "1"

  c.pickScale({ target: c.scalePickerTarget })

  expect(c.scaleFrameTarget.src).toBe("/ai_judges/18/edit?scorer_id=1")
})

it("a newly loaded scale becomes the one Run Prompt tests against", () => {
  const c = fixture({ testUrl: "/ai_judges/18/test_prompt?scorer_id=2" })
  const state = document.createElement("div")
  state.dataset.scorerId = "4"
  state.dataset.hasScale = "true"

  c.scaleStateTargetConnected(state)

  expect(c.testUrlValue).toBe("/ai_judges/18/test_prompt?scorer_id=4")
})

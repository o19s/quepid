import { buildControllerFixture } from "../support/controller_fixture"
import { loadDynamicModalTemplate } from "../support/view_template"
import { afterEach, describe, expect, it, vi } from "vitest"
import TuneRelevanceController from "controllers/tune_relevance_controller"
import MissingDocumentsController from "controllers/missing_documents_controller"
import QueryOptionsCoreController from "controllers/query_options_core_controller"
import { getCoreCapabilities } from "utils/core_capability_access"

vi.mock("utils/core_capability_access", () => ({ getCoreCapabilities: vi.fn() }))

function fixture(Controller, kind) {
  const instance = buildControllerFixture(Controller, {
    element: document.createElement("div")
  })
  document.body.append(instance.element)
  if (kind === "missing documents") {
    instance.element.append(loadDynamicModalTemplate("missing-documents-modal-template").content.cloneNode(true))
    instance.modalRootValue = true
    instance.hasQueryParamsTarget = true
    Object.defineProperty(instance, "queryParamsTarget", {
      get: () => instance.element.querySelector("textarea")
    })
    for (const target of ["spinner", "status", "searchButton", "resetButton", "next", "supported", "unsupported", "engineName"]) {
      Object.defineProperty(instance, `${target}Target`, {
        get: () => instance.element.querySelector(`[data-missing-documents-target="${target}"]`)
      })
      Object.defineProperty(instance, `has${target[0].toUpperCase()}${target.slice(1)}Target`, {
        get: () => Boolean(instance[`${target}Target`])
      })
    }
    getCoreCapabilities.mockReturnValue({ targetedSearch: () => ({
      usesQueryParamsEditor: true,
      settings: { searchEngine: "es" },
      initialQueryParams: () => '{"size":3}',
      resetToRated: () => Promise.resolve()
    }) })
    instance.render = vi.fn()
  } else {
    instance.element.innerHTML = '<form><textarea>{"size":3}</textarea></form>'
    const textarea = instance.element.querySelector("textarea")
    if (kind === "tune relevance") {
      instance.hasQueryEditorTarget = true
      instance.queryEditorTarget = textarea
      instance.settings = { selectedTry: { queryParams: textarea.value } }
      instance.loadCapabilities = () => instance.mountEditor()
      instance.refreshQueryWarning = vi.fn()
      instance.refreshCuratorVars = vi.fn()
      instance.refreshTemplateWarning = vi.fn()
    } else {
      instance.hasEditorTarget = true
      instance.editorTarget = textarea
    }
  }
  return instance
}

describe.each([
  ["tune relevance", TuneRelevanceController],
  ["missing documents", MissingDocumentsController],
  ["query options", QueryOptionsCoreController]
])("%s editor lifecycle", (kind, Controller) => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it("releases wrappers, submit listeners and pending formatting on repeated remounts", async () => {
    vi.useFakeTimers()
    const instance = fixture(Controller, kind)
    for (let cycle = 0; cycle < 3; cycle++) {
      instance.connect()
      await Promise.resolve()
      const textarea = instance.element.querySelector("textarea")
      const form = textarea.form
      const editor = instance.editor
      const format = vi.spyOn(editor, "formatJSON")
      const getValue = vi.spyOn(editor, "getValue")
      expect(textarea.editor).toBe(editor)
      expect(form.querySelectorAll(".cm-editor")).toHaveLength(1)
      expect(form.children).toHaveLength(kind === "missing documents" ? 1 : 2)

      editor.setValue('{"size":4}')
      getValue.mockClear()
      form.dispatchEvent(new Event("submit"))
      expect(getValue).toHaveBeenCalledTimes(1)

      instance.disconnect()
      expect(instance.editor).toBeNull()
      expect(textarea.editor).toBeUndefined()
      expect(textarea.style.display).toBe("")
      expect(textarea.value).toBe('{"size":4}')
      expect(form.querySelector(".cm-editor")).toBeNull()
      expect(textarea.previousElementSibling).toBeNull()
      getValue.mockClear()
      form.dispatchEvent(new Event("submit"))
      vi.runAllTimers()
      expect(getValue).not.toHaveBeenCalled()
      expect(format).not.toHaveBeenCalled()
      // A second disconnect must be harmless and cannot dispose the same editor twice.
      instance.disconnect()
    }
  })

  it("disconnects safely when no editor was mounted", () => {
    const instance = buildControllerFixture(Controller)
    instance.disconnect()
    expect(instance.editor).toBeNull()
  })
})

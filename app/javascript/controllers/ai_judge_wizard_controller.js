import { Controller } from "@hotwired/stimulus"
import { getJson, postJson } from "api/json"
import { withStatusMessages } from "controllers/status_message_behavior"
import { serverMessage } from "utils/error_message"

// Testing uses the active form values; only the Rails Save submission persists.
export default class extends withStatusMessages(Controller) {
  static targets = [
    "name",
    "step2",
    "queryText",
    "docId",
    "informationNeed",
    "documentFields",
    "options",
    "notes",
    "position",
    "status",
    "ratingInfo",
    "loadingSpinner",
    "runPromptButton",
    "rating",
    "explanation",
    "unrateable"
  ]
  static values = { sampleUrl: String, testUrl: String, existing: Boolean, draftKey: String }

  connect() {
    this.abortController = new AbortController()
    this.restoreDraft()
    if (this.existingValue) this.revealStep2()
    this.scrollToStep2IfRequested()
  }

  disconnect() {
    super.disconnect()
    this.abortController.abort()
    this.sampleGeneration = (this.sampleGeneration || 0) + 1
  }

  checkReveal() {
    if (this.nameTarget.value.trim()) this.revealStep2()
  }

  revealStep2() {
    if (this.step2Target.style.display === "block") return
    this.step2Target.style.display = "block"
    this.sampleQueryDocPair()
  }

  // The scale picker's reload lands back here with ?scorer_id= set - scroll
  // down to Test & Refine instead of leaving the user at the top of a long
  // page they've already filled out. Deliberately not a #fragment: the
  // browser's own native fragment-scroll would fire against this same
  // element and race our own (element position differs once revealStep2()
  // reflows the page), consistently winning and overriding it.
  scrollToStep2IfRequested() {
    if (!new URLSearchParams(window.location.search).has("scorer_id")) return
    if (!this.hasStep2Target) return

    this.step2Target.closest("#test-and-refine")?.scrollIntoView({ block: "start" })
  }

  // The scale picker (Test & Refine) navigates to this same page with a
  // different ?scorer_id= - a real GET, not a fetch, since the criteria
  // shown and the scale handed to test_prompt both come from server-rendered
  // state keyed off that param. Snapshot everything typed into the not-yet-
  // saved form first so that reload doesn't throw it all away.
  navigateToScale(event) {
    const url = event.target.options[event.target.selectedIndex]?.dataset.url
    if (!url) return

    this.saveDraft()
    window.location.href = url
  }

  get draftStorageKey() {
    return `ai_judge_wizard_draft:${this.draftKeyValue}`
  }

  // Every input/select/textarea's own current value, keyed by name (and by
  // value too for checkboxes/radios, since several share a name) - deliberately
  // not FormData, which omits an unchecked checkbox entirely and would leave
  // restoreDraft with no way to tell "unchecked" apart from "never asked".
  saveDraft() {
    const form = this.element.closest("form")
    if (!form) return

    const snapshot = []
    form.querySelectorAll("input[name], select[name], textarea[name]").forEach((field) => {
      if ("checkbox" === field.type || "radio" === field.type) {
        snapshot.push({
          name: field.name,
          value: field.value,
          type: field.type,
          checked: field.checked
        })
      } else {
        snapshot.push({ name: field.name, value: field.value, type: field.type })
      }
    })

    sessionStorage.setItem(this.draftStorageKey, JSON.stringify(snapshot))
  }

  restoreDraft() {
    const raw = sessionStorage.getItem(this.draftStorageKey)
    if (!raw) return

    sessionStorage.removeItem(this.draftStorageKey)
    const form = this.element.closest("form")
    if (!form) return

    JSON.parse(raw).forEach(({ name, value, type, checked }) => {
      if ("checkbox" === type || "radio" === type) {
        const field = form.querySelector(
          `[name="${CSS.escape(name)}"][value="${CSS.escape(value)}"]`
        )
        if (field) field.checked = checked
      } else {
        const field = form.querySelector(`[name="${CSS.escape(name)}"]`)
        if (field) field.value = value
      }
    })

    // A restored name should reveal step 2 just like typing it would've.
    this.checkReveal()

    // ai-judge-form already ran its own initial provider-panel sync against
    // the pre-restore field values (it connects before this controller
    // does, per data-controller's token order) - redo it now that a
    // restored draft may have changed the provider or other inputs it
    // reads, so its panels/help/criteria aren't left showing the wrong one.
    this.application
      ?.getControllerForElementAndIdentifier?.(this.element, "ai-judge-form")
      ?.updateProviderPanels()
  }

  async sampleQueryDocPair(event) {
    event?.preventDefault()
    const generation = (this.sampleGeneration = (this.sampleGeneration || 0) + 1)
    try {
      const data = await getJson(this.sampleUrlValue, { signal: this.abortController.signal })
      if (generation !== this.sampleGeneration) return
      this.applyQueryDocPair(data.query_doc_pair || {})
    } catch (error) {
      if (error.name !== "AbortError") this.showError(error)
    }
  }

  applyQueryDocPair(pair) {
    for (const [target, key] of [
      ["queryText", "query_text"],
      ["docId", "doc_id"],
      ["informationNeed", "information_need"],
      ["notes", "notes"],
      ["position", "position"]
    ]) {
      this[`${target}Target`].value = pair[key] ?? ""
    }
    for (const [target, key] of [
      ["documentFields", "document_fields"],
      ["options", "options"]
    ]) {
      const field = this[`${target}Target`]
      const value = JSON.stringify(pair[key] || {}, null, 2)
      if (field.editor) field.editor.setValue(value)
      else field.value = value
    }
  }

  judgeOptions(formData) {
    if (formData.has("user[options]")) {
      const options = JSON.parse(formData.get("user[options]"))
      return options.judge_options || {}
    }
    const options = {}
    for (const [name, value] of formData) {
      const match = name.match(/^user\[judge_options\]\[([^\]]+)\]$/)
      if (match) options[match[1]] = value
    }
    return options
  }

  async runPrompt(event) {
    event.preventDefault()
    if (this.running) return
    this.running = true
    this.runPromptButtonTarget.disabled = true
    this.ratingInfoTarget.style.display = "none"
    this.statusTarget.style.display = "none"
    this.loadingSpinnerTarget.style.display = "block"
    try {
      const formData = new FormData(this.element.closest("form"))
      const data = await postJson(
        this.testUrlValue,
        {
          system_prompt: formData.get("user[system_prompt]"),
          llm_key: formData.get("user[llm_key]"),
          judge_options: this.judgeOptions(formData),
          query_doc_pair: {
            query_text: this.queryTextTarget.value,
            doc_id: this.docIdTarget.value,
            information_need: this.informationNeedTarget.value,
            document_fields:
              this.documentFieldsTarget.editor?.getValue() ?? this.documentFieldsTarget.value,
            options: this.optionsTarget.editor?.getValue() ?? this.optionsTarget.value,
            notes: this.notesTarget.value,
            position: this.positionTarget.value
          }
        },
        { signal: this.abortController.signal }
      )
      this.ratingTarget.textContent = String(data.rating ?? "")
      if (this.hasUnrateableTarget)
        this.unrateableTarget.style.display = data.unrateable ? "" : "none"
      this.explanationTarget.textContent = data.explanation || ""
      this.ratingInfoTarget.style.display = "block"
    } catch (error) {
      if (error.name !== "AbortError") this.showError(error)
    } finally {
      this.running = false
      const scaleNotice = this.element.querySelector(
        "[data-ai-judge-form-target~=needsScaleNotice]"
      )
      this.runPromptButtonTarget.disabled = Boolean(
        scaleNotice && scaleNotice.style.display !== "none"
      )
      this.loadingSpinnerTarget.style.display = "none"
    }
  }

  showError(error) {
    this.statusTarget.style.display = "block"
    this.showStatusMessage(this.statusTarget, {
      message: `Error: ${serverMessage(error, error.message)}`,
      className: "alert alert-danger"
    })
  }
}

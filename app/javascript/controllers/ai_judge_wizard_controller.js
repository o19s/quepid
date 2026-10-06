import { Controller } from "@hotwired/stimulus"
import { getJson, postJson } from "api/json"
import { showStatusMessage } from "utils/status_message"
import { serverMessage } from "utils/error_message"

// Testing uses the active form values; only the Rails Save submission persists.
export default class extends Controller {
  static targets = ["name", "step2", "queryText", "docId", "informationNeed", "documentFields", "options", "notes", "position", "status", "ratingInfo", "loadingSpinner", "runPromptButton", "rating", "explanation", "unrateable"]
  static values = { sampleUrl: String, testUrl: String, existing: Boolean }

  connect() {
    this.abortController = new AbortController()
    if (this.existingValue) this.revealStep2()
  }

  disconnect() {
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

  async sampleQueryDocPair(event) {
    event?.preventDefault()
    const generation = this.sampleGeneration = (this.sampleGeneration || 0) + 1
    try {
      const data = await getJson(this.sampleUrlValue, { signal: this.abortController.signal })
      if (generation !== this.sampleGeneration) return
      this.applyQueryDocPair(data.query_doc_pair || {})
    } catch (error) {
      if (error.name !== "AbortError") this.showError(error)
    }
  }

  applyQueryDocPair(pair) {
    for (const [target, key] of [["queryText", "query_text"], ["docId", "doc_id"], ["informationNeed", "information_need"], ["notes", "notes"], ["position", "position"]]) {
      this[`${target}Target`].value = pair[key] ?? ""
    }
    for (const [target, key] of [["documentFields", "document_fields"], ["options", "options"]]) {
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
      const data = await postJson(this.testUrlValue, {
        system_prompt: formData.get("user[system_prompt]"),
        llm_key: formData.get("user[llm_key]"),
        judge_options: this.judgeOptions(formData),
        query_doc_pair: {
          query_text: this.queryTextTarget.value,
          doc_id: this.docIdTarget.value,
          information_need: this.informationNeedTarget.value,
          document_fields: this.documentFieldsTarget.editor?.getValue() ?? this.documentFieldsTarget.value,
          options: this.optionsTarget.editor?.getValue() ?? this.optionsTarget.value,
          notes: this.notesTarget.value,
          position: this.positionTarget.value
        }
      }, { signal: this.abortController.signal })
      this.ratingTarget.textContent = String(data.rating ?? "")
      if (this.hasUnrateableTarget) this.unrateableTarget.style.display = data.unrateable ? "" : "none"
      this.explanationTarget.textContent = data.explanation || ""
      this.ratingInfoTarget.style.display = "block"
    } catch (error) {
      if (error.name !== "AbortError") this.showError(error)
    } finally {
      this.running = false
      const scaleNotice = this.element.querySelector("[data-ai-judge-form-target~=needsScaleNotice]")
      this.runPromptButtonTarget.disabled = Boolean(scaleNotice && scaleNotice.style.display !== "none")
      this.loadingSpinnerTarget.style.display = "none"
    }
  }

  showError(error) {
    this.statusTarget.style.display = "block"
    showStatusMessage(this.statusTarget, {
      message: `Error: ${serverMessage(error, error.message)}`,
      className: "alert alert-danger"
    })
  }
}

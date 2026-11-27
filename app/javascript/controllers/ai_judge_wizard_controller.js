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
    "unrateable",
    "scaleFrame",
    "scaleState",
    "scalePicker",
    "noScaleFits",
    "supportedScales",
    "unsupportedScaleNote"
  ]
  static values = { sampleUrl: String, testUrl: String, existing: Boolean }

  connect() {
    this.abortController = new AbortController()
    if (this.existingValue) this.revealStep2()
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

  // Picking a scale reloads only the scale panel - a Turbo frame - from this
  // same page with ?scorer_id=, so the criteria redraw server-side while
  // everything typed elsewhere in the not-yet-saved form stays as it is.
  pickScale(event) {
    const url = event.target.selectedOptions[0]?.dataset.url
    if (!url || !this.hasScaleFrameTarget) return

    this.scaleFrameTarget.src = url
  }

  // Fires on page load and again each time the frame swaps in a new scale:
  // Run Prompt tests against the picked scorer, and the provider panels
  // (criteria shown, Run availability) re-sync to whether there is a scale.
  scaleStateTargetConnected(state) {
    const formController = this.formController
    if (formController) {
      formController.hasScaleValue = Boolean(state.dataset.scale)
      formController.updateProviderPanels()
    }
    if (state.dataset.testUrl) this.testUrlValue = state.dataset.testUrl
    this.filterScales()
  }

  get formController() {
    return this.application?.getControllerForElementAndIdentifier?.(this.element, "ai-judge-form")
  }

  // As the "Limit to scales" field is typed (nothing saved yet), splits the
  // picker into "Supported scales" and "Unsupported scales" groups; with no
  // limit it is one plain list. Both stay pickable - see syncScaleSupport.
  filterScales() {
    if (this.hasScalePickerTarget) this.groupScaleOptions(this.typedScaleLimits())
    this.syncScaleSupport()
  }

  groupScaleOptions(limits) {
    const picker = this.scalePickerTarget
    // Moving options re-picks the selection, so restore it afterwards.
    const selected = picker.value
    // Scorer id order, the order the server lists them in.
    const options = [...picker.querySelectorAll("option")]
      .filter((option) => option.value)
      .sort((a, b) => Number(a.value) - Number(b.value))
    picker.querySelectorAll("optgroup").forEach((group) => group.remove())

    const supported = optionGroup("Supported scales")
    const unsupported = optionGroup("Unsupported scales")
    if (!limits) {
      options.forEach((option) => picker.appendChild(option))
    } else {
      options.forEach((option) =>
        (scaleFits(limits, option.dataset.scale) ? supported : unsupported).appendChild(option)
      )
      ;[supported, unsupported].forEach((group) => {
        if (group.children.length) picker.appendChild(group)
      })
    }
    picker.value = selected
    if (this.hasNoScaleFitsTarget)
      this.noScaleFitsTarget.style.display = limits && !supported.children.length ? "" : "none"
  }

  // Run Prompt stays off while the scale the panel shows (picked, or the
  // book's) is outside the typed limit. The server refuses it anyway.
  syncScaleSupport() {
    if (!this.hasScaleStateTarget || !this.hasRunPromptButtonTarget) return

    const limits = this.typedScaleLimits()
    const scale = this.scaleStateTarget.dataset.scale
    const unsupported = Boolean(limits && scale && !scaleFits(limits, scale))
    this.runPromptButtonTarget.dataset.unsupportedScale = String(unsupported)
    if (this.hasUnsupportedScaleNoteTarget)
      this.unsupportedScaleNoteTarget.style.display = unsupported ? "" : "none"
    if (unsupported) this.runPromptButtonTarget.disabled = true
    else this.formController?.updateRunAvailability()
  }

  // The typed limits as a Set of "0,1,2,3" strings, or null when there are none:
  // blank, or not whole numbers yet (saving reports that).
  typedScaleLimits() {
    if (!this.hasSupportedScalesTarget) return null

    const scales = this.supportedScalesTarget.value
      .split("\n")
      .map((line) =>
        line
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
      .filter((values) => values.length)
    if (!scales.length || scales.flat().some((value) => !/^-?\d+$/.test(value))) return null

    return new Set(scales.map(normalizeScale))
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
          connection_id: formData.get("user[connection_id]"),
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
      // ai-judge-form owns when Run is available (scale missing or outside the limit).
      this.runPromptButtonTarget.disabled = false
      this.formController?.updateRunAvailability()
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

function optionGroup(label) {
  const group = document.createElement("optgroup")
  group.label = label
  return group
}

function scaleFits(limits, scale) {
  return limits.has(normalizeScale(scale.split(",")))
}

// Same shape AiJudge#supported_scales compares: unique, sorted, comma-joined.
function normalizeScale(values) {
  return [...new Set(values.map(Number))].sort((a, b) => a - b).join(",")
}

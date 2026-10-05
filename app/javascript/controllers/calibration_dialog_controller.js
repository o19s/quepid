import { Controller } from "@hotwired/stimulus"

/**
 * "New calibration" dialog (docs/todo/judge_calibration.md C1). Keeps the
 * sample size inside what the chosen reference judge has rated, says what is
 * wrong with the current choice and how many LLM calls it would make, and
 * enables Start only when the choice can run. "Same pairs as an earlier
 * calibration" takes the reference and size from that sample instead. Opens
 * itself when the page was reached from a judge's calibrate shortcut.
 */
export default class extends Controller {
  static targets = [
    "judge", "reference", "referenceHint", "sampleSize", "sampleHint",
    "pairsNew", "pairsSame", "sample", "problem", "summary", "submitButton"
  ]
  static values = { min: Number, max: Number, open: Boolean }

  connect() {
    this.update()
    if (this.openValue) window.bootstrap?.Modal.getOrCreateInstance(this.element).show()
  }

  // A reference change pulls an over-large sample size down to what it rated.
  update(event) {
    const reusing = this.reusing
    this.referenceTarget.disabled = reusing
    this.sampleSizeTarget.disabled = reusing
    if (this.hasSampleTarget) this.sampleTarget.disabled = !reusing

    const choice = reusing ? this.reusedChoice() : this.newChoice(event)
    const judge = this.selected(this.judgeTarget)
    const problem = this.problemFor(judge, choice)
    this.problemTarget.textContent = problem || ""
    this.problemTarget.classList.toggle("d-none", !problem)

    const ready = Boolean(judge && choice.referenceId && !problem)
    this.summaryTarget.textContent = ready
      ? `This makes ${choice.size} calls to ${judge.dataset.name}, compared against ${choice.referenceName}.`
      : ""
    this.submitButtonTarget.disabled = !ready
  }

  newChoice(event) {
    const reference = this.selected(this.referenceTarget)
    const eligible = reference ? Number(reference.dataset.eligiblePairs) : null
    const upper = eligible === null ? this.maxValue : Math.min(this.maxValue, eligible)

    if (event?.target === this.referenceTarget && eligible >= this.minValue && this.size > upper) {
      this.sampleSizeTarget.value = upper
    }
    this.sampleSizeTarget.max = upper

    if (reference) {
      this.referenceHintTarget.textContent =
        `${eligible} ${eligible === 1 ? "pair" : "pairs"} rated by ${reference.dataset.name} on the book's scale.`
    }
    this.sampleHintTarget.textContent = this.sampleHint(upper)

    return {
      referenceId: reference?.value,
      referenceName: reference?.dataset.name,
      eligible,
      upper,
      size: this.size
    }
  }

  // Reused pairs come with their own reference: show it in "Compare against",
  // so the dialog never shows one reference while the run uses another.
  reusedChoice() {
    const sample = this.hasSampleTarget ? this.selected(this.sampleTarget) : null
    if (sample) {
      this.referenceTarget.value = sample.dataset.referenceId
      this.referenceHintTarget.textContent =
        `These pairs were drawn from ${sample.dataset.referenceName}'s ratings, so ${sample.dataset.referenceName} is the reference.`
      this.sampleSizeTarget.value = sample.dataset.size
      this.sampleHintTarget.textContent = `All ${sample.dataset.size} pairs of that calibration.`
    }
    return {
      reused: true,
      referenceId: sample?.dataset.referenceId,
      referenceName: sample?.dataset.referenceName,
      size: sample ? Number(sample.dataset.size) : null
    }
  }

  problemFor(judge, choice) {
    if (judge && choice.referenceId && judge.value === choice.referenceId) {
      return "A judge can't be calibrated against itself. Pick a different judge to compare against."
    }
    if (choice.reused) return null
    if (choice.referenceId && choice.eligible < this.minValue) {
      return `${choice.referenceName} has rated only ${choice.eligible} pairs on this book's scale; ` +
        `a calibration needs at least ${this.minValue}.`
    }
    if (!Number.isInteger(choice.size) || choice.size < this.minValue || choice.size > choice.upper) {
      return `Pick a sample size between ${this.minValue} and ${choice.upper}.`
    }
    return null
  }

  sampleHint(upper) {
    if (upper < this.minValue) return `A calibration needs at least ${this.minValue} pairs.`
    if (upper === this.minValue) return `Exactly ${this.minValue} pairs.`
    return `Between ${this.minValue} and ${upper} pairs.`
  }

  get reusing() {
    return this.hasPairsSameTarget && this.pairsSameTarget.checked
  }

  get size() {
    return Number(this.sampleSizeTarget.value)
  }

  selected(select) {
    return select.value ? select.selectedOptions[0] : null
  }
}

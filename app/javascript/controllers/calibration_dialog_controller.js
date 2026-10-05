import { Controller } from "@hotwired/stimulus"

/**
 * "New calibration" dialog (docs/todo/judge_calibration.md C1, C2). A sample
 * is drawn by queries (each query's whole top list, which also shows how
 * scores would move) or by pairs; reusing an earlier calibration's sample
 * takes its reference and size instead. Keeps the size inside what the
 * reference has rated, says what is wrong with the current choice and how
 * many LLM calls it would make, and enables Start only when it can run.
 * Opens itself when the page was reached from a judge's calibrate shortcut.
 */
export default class extends Controller {
  static targets = [
    "judge", "reference", "referenceHint",
    "unitQueries", "unitPairs", "unitHint",
    "queryRow", "queryCount", "queryHint",
    "sizeRow", "sampleSize", "sampleHint",
    "pairsNew", "pairsSame", "sample", "problem", "summary", "submitButton"
  ]
  static values = { min: Number, max: Number, minQueries: Number, maxQueries: Number, open: Boolean }

  connect() {
    this.update()
    if (this.openValue) window.bootstrap?.Modal.getOrCreateInstance(this.element).show()
  }

  // A reference change pulls an over-large size down to what it rated.
  update(event) {
    const reusing = this.reusing
    const newSampleFields = [
      this.referenceTarget, this.sampleSizeTarget, this.queryCountTarget, this.unitQueriesTarget, this.unitPairsTarget
    ]
    newSampleFields.forEach(field => { field.disabled = reusing })
    if (this.hasSampleTarget) this.sampleTarget.disabled = !reusing
    if (!reusing) this.offerUnits()

    const byQueries = !reusing && this.unitQueriesTarget.checked
    this.queryRowTarget.classList.toggle("d-none", reusing || !byQueries)
    this.sizeRowTarget.classList.toggle("d-none", reusing || byQueries)

    let choice
    if (reusing) choice = this.reusedChoice()
    else if (byQueries) choice = this.queryChoice(event)
    else choice = this.pairChoice(event)

    const judge = this.selected(this.judgeTarget)
    const problem = this.problemFor(judge, choice)
    this.problemTarget.textContent = problem || ""
    this.problemTarget.classList.toggle("d-none", !problem)

    const ready = Boolean(judge && choice.referenceId && !problem)
    this.summaryTarget.textContent = ready
      ? `This makes ${choice.calls} calls to ${judge.dataset.name}, compared against ${choice.referenceName}.`
      : ""
    this.submitButtonTarget.disabled = !ready
  }

  // Sampling by queries needs a reference that rated enough whole top lists;
  // otherwise only pairs are on offer.
  offerUnits() {
    const reference = this.selected(this.referenceTarget)
    const complete = reference ? Number(reference.dataset.completeQueries) : null
    const tooFew = complete !== null && complete < this.minQueriesValue
    this.unitQueriesTarget.disabled = tooFew
    if (tooFew) this.unitPairsTarget.checked = true
    this.unitHintTarget.textContent = tooFew
      ? `${reference.dataset.name} rated the whole top list of only ${complete} ` +
        `${complete === 1 ? "query" : "queries"}, so this samples pairs.`
      : ""
    this.unitHintTarget.classList.toggle("d-none", !tooFew)
  }

  queryChoice(event) {
    const reference = this.selected(this.referenceTarget)
    const complete = reference ? Number(reference.dataset.completeQueries) : null
    const upper = complete === null ? this.maxQueriesValue : Math.min(this.maxQueriesValue, complete)

    if (event?.target === this.referenceTarget && this.queryCount > upper) this.queryCountTarget.value = upper
    this.queryCountTarget.max = upper

    if (reference) {
      this.referenceHintTarget.textContent =
        `${reference.dataset.name} rated the whole top list of ${complete} ${complete === 1 ? "query" : "queries"}.`
    }
    this.queryHintTarget.textContent = this.rangeHint(this.minQueriesValue, upper, "queries")

    return {
      kind: "queries",
      referenceId: reference?.value,
      referenceName: reference?.dataset.name,
      upper,
      count: this.queryCount,
      calls: `up to ${this.queryCount * 10}`
    }
  }

  pairChoice(event) {
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
    this.sampleHintTarget.textContent = this.rangeHint(this.minValue, upper, "pairs")

    return {
      kind: "pairs",
      referenceId: reference?.value,
      referenceName: reference?.dataset.name,
      eligible,
      upper,
      size: this.size,
      calls: this.size
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
    }
    return {
      kind: "reused",
      referenceId: sample?.dataset.referenceId,
      referenceName: sample?.dataset.referenceName,
      calls: sample ? Number(sample.dataset.size) : null
    }
  }

  problemFor(judge, choice) {
    if (judge && choice.referenceId && judge.value === choice.referenceId) {
      return "A judge can't be calibrated against itself. Pick a different judge to compare against."
    }
    if (choice.kind === "reused") return null
    if (choice.kind === "queries") return this.queryProblem(choice)
    return this.pairProblem(choice)
  }

  queryProblem(choice) {
    if (!Number.isInteger(choice.count) || choice.count < this.minQueriesValue || choice.count > choice.upper) {
      return `Pick between ${this.minQueriesValue} and ${choice.upper} queries.`
    }
    return null
  }

  pairProblem(choice) {
    if (choice.referenceId && choice.eligible < this.minValue) {
      return `${choice.referenceName} has rated only ${choice.eligible} pairs on this book's scale; ` +
        `a calibration needs at least ${this.minValue}.`
    }
    if (!Number.isInteger(choice.size) || choice.size < this.minValue || choice.size > choice.upper) {
      return `Pick a sample size between ${this.minValue} and ${choice.upper}.`
    }
    return null
  }

  rangeHint(min, upper, unit) {
    if (upper < min) return `A calibration needs at least ${min} ${unit}.`
    if (upper === min) return `Exactly ${min} ${unit}.`
    return `Between ${min} and ${upper} ${unit}.`
  }

  get reusing() {
    return this.hasPairsSameTarget && this.pairsSameTarget.checked
  }

  get size() {
    return Number(this.sampleSizeTarget.value)
  }

  get queryCount() {
    return Number(this.queryCountTarget.value)
  }

  selected(select) {
    return select.value ? select.selectedOptions[0] : null
  }
}

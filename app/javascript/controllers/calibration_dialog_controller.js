import { Controller } from "@hotwired/stimulus"

/**
 * The range a size field accepts, in words.
 * @param {number} min the smallest size a calibration takes
 * @param {number} upper the largest the chosen reference allows
 * @param {string} unit "pairs" or "queries"
 * @returns {string}
 */
function rangeHint(min, upper, unit) {
  if (upper < min) return `A calibration needs at least ${min} ${unit}.`
  if (upper === min) return `Exactly ${min} ${unit}.`
  return `Between ${min} and ${upper} ${unit}.`
}

/**
 * The chosen option of a select, or null while the blank prompt is chosen.
 * @param {HTMLSelectElement} select
 * @returns {HTMLOptionElement|null}
 */
function selectedOption(select) {
  return select.value ? select.selectedOptions[0] : null
}

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

  /** Fills in the dialog, and opens it when reached from a calibrate shortcut. */
  connect() {
    this.update()
    if (this.openValue) window.bootstrap?.Modal.getOrCreateInstance(this.element).show()
  }

  /**
   * Brings every hint, problem, the call count and Start in line with the
   * current choices. A reference change pulls an over-large size down to
   * what it rated.
   * @param {Event} [event] the change that triggered it
   */
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

    const choice = this.choiceFor(reusing, byQueries, event)

    const judge = selectedOption(this.judgeTarget)
    const problem = this.problemFor(judge, choice)
    this.problemTarget.textContent = problem || ""
    this.problemTarget.classList.toggle("d-none", !problem)

    const ready = Boolean(judge && choice.referenceId && !problem)
    this.summaryTarget.textContent = ready
      ? `This makes ${choice.calls} calls to ${judge.dataset.name}, compared against ${choice.referenceName}.`
      : ""
    this.submitButtonTarget.disabled = !ready
  }

  /**
   * The sample the dialog describes now: reused, by queries, or by pairs.
   * @param {boolean} reusing an earlier calibration's sample is chosen
   * @param {boolean} byQueries sampling by queries rather than pairs
   * @param {Event} [event] the change that triggered the update
   * @returns {object} reference, size limits and the calls it would make
   */
  choiceFor(reusing, byQueries, event) {
    if (reusing) return this.reusedChoice()
    if (byQueries) return this.queryChoice(event)
    return this.pairChoice(event)
  }

  /**
   * Sampling by queries needs a reference that rated enough whole top lists;
   * otherwise only pairs are on offer.
   */
  offerUnits() {
    const reference = selectedOption(this.referenceTarget)
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

  /**
   * A new sample of whole top lists: how many queries, up to what the reference rated in full.
   * @param {Event} [event]
   * @returns {object}
   */
  queryChoice(event) {
    const reference = selectedOption(this.referenceTarget)
    const complete = reference ? Number(reference.dataset.completeQueries) : null
    const upper = complete === null ? this.maxQueriesValue : Math.min(this.maxQueriesValue, complete)

    if (event?.target === this.referenceTarget && this.queryCount > upper) this.queryCountTarget.value = upper
    this.queryCountTarget.max = upper

    if (reference) {
      this.referenceHintTarget.textContent =
        `${reference.dataset.name} rated the whole top list of ${complete} ${complete === 1 ? "query" : "queries"}.`
    }
    this.queryHintTarget.textContent = rangeHint(this.minQueriesValue, upper, "queries")

    return {
      kind: "queries",
      referenceId: reference?.value,
      referenceName: reference?.dataset.name,
      upper,
      count: this.queryCount,
      calls: `up to ${this.queryCount * 10}`
    }
  }

  /**
   * A new sample of pairs: how many, up to what the reference rated.
   * @param {Event} [event]
   * @returns {object}
   */
  pairChoice(event) {
    const reference = selectedOption(this.referenceTarget)
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
    this.sampleHintTarget.textContent = rangeHint(this.minValue, upper, "pairs")

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

  /**
   * An earlier calibration's sample. It comes with its own reference: show
   * it in "Compare against", so the dialog never shows one reference while
   * the run uses another.
   * @returns {object}
   */
  reusedChoice() {
    const sample = this.hasSampleTarget ? selectedOption(this.sampleTarget) : null
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

  /**
   * What is wrong with the current choice, in words, or null.
   * @param {HTMLOptionElement|null} judge
   * @param {object} choice
   * @returns {string|null}
   */
  problemFor(judge, choice) {
    if (judge && choice.referenceId && judge.value === choice.referenceId) {
      return "A judge can't be calibrated against itself. Pick a different judge to compare against."
    }
    if (choice.kind === "reused") return null
    if (choice.kind === "queries") return this.queryProblem(choice)
    return this.pairProblem(choice)
  }

  /**
   * @param {object} choice a query sample
   * @returns {string|null}
   */
  queryProblem(choice) {
    if (!Number.isInteger(choice.count) || choice.count < this.minQueriesValue || choice.count > choice.upper) {
      return `Pick between ${this.minQueriesValue} and ${choice.upper} queries.`
    }
    return null
  }

  /**
   * @param {object} choice a pair sample
   * @returns {string|null}
   */
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

  /** @returns {boolean} an earlier calibration's sample is chosen */
  get reusing() {
    return this.hasPairsSameTarget && this.pairsSameTarget.checked
  }

  /** @returns {number} the pair sample size entered */
  get size() {
    return Number(this.sampleSizeTarget.value)
  }

  /** @returns {number} the number of queries entered */
  get queryCount() {
    return Number(this.queryCountTarget.value)
  }
}

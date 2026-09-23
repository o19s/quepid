import { Controller } from "@hotwired/stimulus"
import { formatScore, scoreToColor } from "utils/scoring"

/**
 * Renders the case-level snapshot comparison scores.
 *
 * Angular still calculates these scores while live query scoring is being
 * migrated, but the header no longer depends on the Angular qscore-case
 * component or its scope bindings.
 */
export default class extends Controller {
  connect() {
    this.store = window.quepidStore?.documents
    this.onStoreChange = () => this.render()
    this.store?.addEventListener("change", this.onStoreChange)
    this.store?.addEventListener("reset", this.onStoreChange)
    this.render()
  }

  disconnect() {
    this.store?.removeEventListener("change", this.onStoreChange)
    this.store?.removeEventListener("reset", this.onStoreChange)
  }

  render() {
    this.element.querySelectorAll("[data-diff-case-scores-generated]").forEach((badge) => badge.remove())
    const searchers = this.store?.snapshot()?.caseDiffs || []

    searchers.forEach((searcher) => {
      const badge = document.createElement("div")
      badge.className = "case-score diff-score"
      badge.dataset.diffCaseScoresGenerated = "true"

      const rating = document.createElement("div")
      rating.className = "header-rating"
      const score = searcher.score?.score ?? "?"
      rating.style.backgroundColor = scoreToColor(score, searcher.score?.maxScore || 1)

      const value = document.createElement("span")
      value.className = "scorable-score"
      value.textContent = formatScore(score)

      const label = document.createElement("span")
      label.className = "query-score-label low-profile"
      label.textContent = searcher.name || "Snapshot"

      rating.append(value, label)
      badge.append(rating)
      this.element.append(badge)
    })
  }
}

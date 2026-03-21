import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { scoreToColor } from "modules/scorer"

export default class extends Controller {
  static targets = ["badge"]
  static values = {
    caseId: { type: Number },
    tryNumber: { type: Number },
    maxScore: { type: Number, default: 0 },
  }

  connect() {
    this._updateDisplay(null)
  }

  /**
   * Called by query-list controller when query scores change.
   * @param {{ score: number|null, allRated: boolean, queryScores: Object }} data
   */
  updateScore(data) {
    const { score, allRated, queryScores } = data

    this._updateDisplay(score)

    // Persist to backend
    if (score !== null) {
      this._persistScore(score, allRated, queryScores)
    }
  }

  // Private

  _updateDisplay(score) {
    if (!this.hasBadgeTarget) return

    if (score === null || score === undefined) {
      this.badgeTarget.textContent = "--"
      this.badgeTarget.style.backgroundColor = "#999"
    } else {
      const rounded = Math.round(score * 100) / 100
      this.badgeTarget.textContent = rounded.toFixed(2)
      this.badgeTarget.style.backgroundColor = scoreToColor(score, this.maxScoreValue)
    }
  }

  async _persistScore(score, allRated, queryScores) {
    const payload = {
      case_score: {
        score: score,
        all_rated: allRated,
        try_number: this.tryNumberValue,
        queries: queryScores,
      },
    }

    try {
      const response = await fetch(apiUrl(`api/cases/${this.caseIdValue}/scores`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken(),
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok && response.status !== 204) {
        console.error("Failed to persist case score:", response.status)
      }
    } catch (e) {
      console.error("Failed to persist case score:", e)
    }
  }
}

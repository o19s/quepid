import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { scoreToColor } from "modules/scorer"

export default class extends Controller {
  static targets = ["badge", "snapshotScores"]
  static outlets = ["sparkline"]
  static values = {
    caseId: { type: Number },
    tryNumber: { type: Number },
    maxScore: { type: Number, default: 0 },
  }

  connect() {
    this.abortController = null
    this.historyAbort = new AbortController()
    this.scoreHistory = []
    this.annotationsList = []
    this._updateDisplay(null)
    this._fetchScoreHistory()

    // Listen for snapshot comparison events
    this._onComparisonActivate = (e) => this._showSnapshotScores(e.detail.snapshots)
    this._onComparisonDeactivate = () => this._clearSnapshotScores()
    document.addEventListener("snapshot-comparison:activate", this._onComparisonActivate)
    document.addEventListener("snapshot-comparison:deactivate", this._onComparisonDeactivate)
  }

  disconnect() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    if (this.historyAbort) {
      this.historyAbort.abort()
      this.historyAbort = null
    }
    document.removeEventListener("snapshot-comparison:activate", this._onComparisonActivate)
    document.removeEventListener("snapshot-comparison:deactivate", this._onComparisonDeactivate)
  }

  /**
   * Called by query-list controller when query scores change.
   * @param {{ score: number|null, allRated: boolean, queryScores: Object }} data
   */
  updateScore(data) {
    const { score, allRated, queryScores } = data

    this._updateDisplay(score)

    // Store full score payload as data attributes so sibling controllers
    // (e.g. settings_panel_controller) can read the latest score state
    this.element.dataset.lastScore = score !== null ? String(score) : ""
    this.element.dataset.lastAllRated = allRated ? "true" : "false"
    this.element.dataset.lastQueryScores = JSON.stringify(queryScores || {})

    // Persist to backend, then refresh sparkline with the new score point
    if (score !== null) {
      this._persistScore(score, allRated, queryScores)
    }
  }

  // Private

  _showSnapshotScores(snapshots) {
    if (!this.hasSnapshotScoresTarget) return

    const container = this.snapshotScoresTarget
    container.innerHTML = ""
    container.classList.remove("d-none")

    for (const snap of snapshots) {
      // Compute an average score from the snapshot's scores array
      const scores = snap.scores || []
      const validScores = scores.filter((s) => s.score !== null && s.score !== undefined)
      const avgScore =
        validScores.length > 0
          ? validScores.reduce((sum, s) => sum + s.score, 0) / validScores.length
          : null

      const badge = document.createElement("span")
      badge.className = "diff-score-display snapshot-score ms-2"

      const inner = document.createElement("span")
      inner.className = "overall-rating case-score-badge"

      if (avgScore !== null) {
        const rounded = Math.round(avgScore * 100) / 100
        inner.textContent = rounded.toFixed(2)
        inner.style.backgroundColor = scoreToColor(avgScore, this.maxScoreValue)
      } else {
        inner.textContent = "--"
        inner.classList.add("score-badge-unscored")
      }

      const label = document.createElement("small")
      label.className = "text-muted ms-1"
      label.textContent = snap.name

      badge.appendChild(inner)
      badge.appendChild(label)
      container.appendChild(badge)
    }
  }

  _clearSnapshotScores() {
    if (!this.hasSnapshotScoresTarget) return
    this.snapshotScoresTarget.innerHTML = ""
    this.snapshotScoresTarget.classList.add("d-none")
  }

  _updateDisplay(score) {
    if (!this.hasBadgeTarget) return

    if (score === null || score === undefined) {
      this.badgeTarget.textContent = "--"
      this.badgeTarget.style.backgroundColor = ""
      this.badgeTarget.classList.add("score-badge-unscored")
    } else {
      const rounded = Math.round(score * 100) / 100
      this.badgeTarget.textContent = rounded.toFixed(2)
      this.badgeTarget.classList.remove("score-badge-unscored")
      this.badgeTarget.style.backgroundColor = scoreToColor(score, this.maxScoreValue)
    }
  }

  async _fetchScoreHistory() {
    if (!this.caseIdValue) return

    try {
      const signal = this.historyAbort?.signal
      const [scoresRes, annotationsRes] = await Promise.all([
        fetch(apiUrl(`api/cases/${this.caseIdValue}/scores/all`), {
          headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
          signal,
        }),
        fetch(apiUrl(`api/cases/${this.caseIdValue}/annotations`), {
          headers: { "X-CSRF-Token": csrfToken(), Accept: "application/json" },
          signal,
        }),
      ])

      if (scoresRes.ok) {
        const scoresData = await scoresRes.json()
        this.scoreHistory = (scoresData.scores || []).map((s) => ({
          score: s.score,
          updated_at: s.updated_at,
        }))
      }

      let annotationsList = []
      if (annotationsRes.ok) {
        const annotationsData = await annotationsRes.json()
        annotationsList = (annotationsData.annotations || []).map((a) => ({
          message: a.message,
          updated_at: a.updated_at,
        }))
      }

      this.annotationsList = annotationsList
      this._pushToSparkline()
    } catch (e) {
      if (e.name !== "AbortError") {
        console.warn("Failed to load score history:", e)
      }
    }
  }

  _pushToSparkline() {
    if (!this.hasSparklineOutlet) return
    if (this.scoreHistory.length <= 1) return

    const sparkline = this.sparklineOutlet
    sparkline.maxValue = this.maxScoreValue
    sparkline.scoresValue = this.scoreHistory
    sparkline.annotationsValue = this.annotationsList
  }

  async _persistScore(score, allRated, queryScores) {
    // Cancel any in-flight persist request
    if (this.abortController) this.abortController.abort()
    this.abortController = new AbortController()

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
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        console.error("Failed to persist case score:", response.status)
        return
      }

      // After persisting, add the new score to history and refresh sparkline
      const saved = await response.json()
      if (saved && saved.score !== undefined) {
        this.scoreHistory.push({
          score: saved.score,
          updated_at: saved.updated_at || new Date().toISOString(),
        })
        // Keep only the last 20 entries (sparkline displays 10; extra headroom
        // avoids thrashing if annotations interleave)
        if (this.scoreHistory.length > 20) {
          this.scoreHistory = this.scoreHistory.slice(-20)
        }
        this._pushToSparkline()
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Failed to persist case score:", e)
      }
    }
  }
}

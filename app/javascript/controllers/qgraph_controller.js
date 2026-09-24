import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "api/fetch"
import { graphData, graphSpec } from "utils/qgraph"

export default class extends Controller {
  static targets = ["container"]
  static values = {
    scoresUrl: String,
    annotationsUrl: String,
    maxScore: Number
  }

  connect() {
    this.scores = []
    this.annotations = []
    this.margin = { top: 4, right: 6, bottom: 4, left: 4 }
    this.scoringStore = window.quepidStore?.scoring
    this.onScoringComplete = () => {
      this.maxScore = this.scoringStore?.caseScore?.maxScore || this.maxScoreValue || 1
      this.render()
    }
    this.onScorePersisted = (event) => {
      if (String(event.detail?.caseId) === this.element.dataset.qgraphCaseId) this.loadScores()
    }
    this.onAnnotationsChanged = (event) => {
      if (String(event.detail?.caseId) === this.element.dataset.qgraphCaseId) this.loadAnnotations()
    }
    this.scoringStore?.addEventListener("scoring-complete", this.onScoringComplete)
    document.addEventListener("case-score:persisted", this.onScorePersisted)
    document.addEventListener("annotations:changed", this.onAnnotationsChanged)
    this.resizeObserver = new ResizeObserver(() => this.render())
    this.resizeObserver.observe(this.element)
    this.load()
  }

  disconnect() {
    this.scoringStore?.removeEventListener("scoring-complete", this.onScoringComplete)
    document.removeEventListener("case-score:persisted", this.onScorePersisted)
    document.removeEventListener("annotations:changed", this.onAnnotationsChanged)
    this.resizeObserver?.disconnect()
    this.vegaResult?.finalize()
  }

  async load() {
    await Promise.all([this.loadScores(), this.loadAnnotations()])
  }

  async loadScores() {
    try {
      const response = await apiFetch(this.scoresUrlValue)
      if (!response.ok) throw new Error(`Unable to load case scores (${response.status})`)
      this.scores = (await response.json()).scores || []
      this.render()
    } catch {
      this.scores = []
      this.render()
    }
  }

  async loadAnnotations() {
    try {
      const response = await apiFetch(this.annotationsUrlValue)
      if (!response.ok) throw new Error(`Unable to load annotations (${response.status})`)
      const data = await response.json()
      this.annotations = (data.annotations || []).map((annotation) => ({
        ...annotation,
        updatedAt: annotation.updated_at
      }))
      this.render()
    } catch {
      this.annotations = []
      this.render()
    }
  }

  render() {
    const hasGraph = this.scores.length >= 2
    this.element.hidden = !hasGraph
    if (!this.hasContainerTarget || !hasGraph) {
      this.vegaResult?.finalize()
      this.vegaResult = null
      if (this.hasContainerTarget) this.containerTarget.replaceChildren()
      return
    }

    const width = this.element.clientWidth - this.margin.left - this.margin.right
    const height = this.element.clientHeight - this.margin.top - this.margin.bottom
    if (width <= 0 || height <= 0) return

    const { scoreData, annotationData } = graphData(this.scores, this.annotations)
    if (!scoreData.length) return

    this.vegaResult?.finalize()
    this.containerTarget.replaceChildren()
    window.vegaEmbed(this.containerTarget, graphSpec(
      scoreData,
      annotationData,
      this.maxScore || this.maxScoreValue || 1,
      width,
      height,
      this.margin
    ), {
      actions: false,
      renderer: "svg",
      tooltip: { theme: "dark" }
    }).then((result) => {
      this.vegaResult = result
    }).catch((error) => {
      console.error("Error rendering qgraph:", error)
    })
  }
}

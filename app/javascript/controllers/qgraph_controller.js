import { Controller } from "@hotwired/stimulus"
import { getJson } from "api/json"
import { graphData, graphSpec } from "utils/qgraph"
import { getCoreStores } from "utils/core_store_access"

export default class extends Controller {
  static targets = ["container"]
  static values = {
    caseId: Number,
    scoresUrl: String,
    annotationsUrl: String,
    maxScore: Number
  }

  connect() {
    this.scores = []
    this.annotations = []
    this.margin = { top: 4, right: 6, bottom: 4, left: 4 }
    this.scoringStore = getCoreStores().scoring
    this.onScoringComplete = () => {
      this.maxScore = this.scoringStore?.caseScore?.maxScore || this.maxScoreValue || 1
      this.render()
    }
    this.scoringStore?.addEventListener("scoring-complete", this.onScoringComplete)
    this.resizeObserver = new ResizeObserver(() => this.render())
    this.resizeObserver.observe(this.element)
    this.load()
  }

  disconnect() {
    this.scoringStore?.removeEventListener("scoring-complete", this.onScoringComplete)
    this.resizeObserver?.disconnect()
    this.vegaResult?.finalize()
  }

  handleScorePersisted(event) {
    if (String(event.detail?.caseId) === String(this.caseIdValue)) this.loadScores()
  }

  handleAnnotationsChanged(event) {
    if (String(event.detail?.caseId) === String(this.caseIdValue)) this.loadAnnotations()
  }

  async load() {
    await Promise.all([this.loadScores(), this.loadAnnotations()])
  }

  async loadScores() {
    try {
      const data = await getJson(this.scoresUrlValue)

      this.scores = data.scores || []
      this.render()
    } catch {
      this.scores = []
      this.render()
    }
  }

  async loadAnnotations() {
    try {
      const data = await getJson(this.annotationsUrlValue)
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

import { Controller } from "@hotwired/stimulus"
import { formatScore, scoreToColor } from "utils/scoring"

export default class extends Controller {
  static targets = ["value"]
  static values = {
    queryId: String,
    index: Number
  }

  connect() {
    this.store = window.quepidStore?.documents
    this.onStoreChange = () => this.render()
    this.store?.addEventListener("change", this.onStoreChange)
    this.render()
  }

  disconnect() {
    this.store?.removeEventListener("change", this.onStoreChange)
  }

  render() {
    const searcher = this.store?.query(this.queryIdValue)?.diffs?.searchers?.[this.indexValue]
    const score = searcher?.score?.score ?? "?"
    const maxScore = searcher?.score?.maxScore || 1
    this.element.style.backgroundColor = scoreToColor(score, maxScore)
    if (this.hasValueTarget) this.valueTarget.textContent = formatScore(score)
  }
}

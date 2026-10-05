import { Controller } from "@hotwired/stimulus"
import { subscribeToStore } from "utils/store_subscription"
import { formatScore, scoreToColor } from "utils/scoring"
import { getCoreStores } from "utils/core_store_access"

export default class extends Controller {
  static targets = ["value"]
  static values = {
    queryId: String,
    index: Number
  }

  connect() {
    this.store = getCoreStores().documents
    this.onStoreChange = () => this.render()
    this.unsubscribeStore = this.store && subscribeToStore(this.store, { change: this.onStoreChange })
    this.render()
  }

  disconnect() {
    this.unsubscribeStore?.()
  }

  render() {
    const searcher = this.store?.query(this.queryIdValue)?.diffs?.searchers?.[this.indexValue]
    const score = searcher?.score?.score ?? "?"
    const maxScore = searcher?.score?.maxScore || 1
    this.element.style.backgroundColor = scoreToColor(score, maxScore)
    if (this.hasValueTarget) this.valueTarget.textContent = formatScore(score)
  }
}

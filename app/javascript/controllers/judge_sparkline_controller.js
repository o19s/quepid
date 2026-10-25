// vegaEmbed is available globally via the vega_globals importmap pin.
import { Controller } from "@hotwired/stimulus"

// Mounts the chart once and keeps the live Vega view around so later
// updates (see updateValues) can push new data into the existing chart
// instead of tearing it down and re-embedding a fresh one - a full
// re-embed is what used to make this chart visibly flicker on every
// judgement while a judge was actively running. This element is
// deliberately never re-rendered by a Turbo Stream replace - see
// broadcast_judge_activity_job.rb and judge_activity_stats_controller.js
// for how fresh values actually reach an already-mounted instance.
export default class extends Controller {
  static values = { color: String, values: Array }

  connect() {
    this.disconnected = false
    this.embed()
  }

  disconnect() {
    this.disconnected = true
    this.view?.finalize()
  }

  async embed() {
    const result = await vegaEmbed(this.element, this.buildSpec(this.valuesValue), {
      actions: false,
      renderer: "svg"
    })
    if (this.disconnected) {
      result.view.finalize()
      return
    }
    this.view = result.view
    if (this.pendingValues) this.updateValues(this.pendingValues)
  }

  updateValues(values) {
    this.pendingValues = values
    if (!this.view) return

    this.view.data("source", values)
    this.view.resize().run()
  }

  // Named ("source") rather than left as an inline array so updateValues
  // can target it by name - Vega-Lite otherwise assigns inline data an
  // internal name that isn't guaranteed across spec changes.
  buildSpec(values) {
    return {
      $schema: "https://vega.github.io/schema/vega-lite/v6.json",
      data: { name: "source", values },
      width: "container",
      height: 32,
      autosize: { type: "fit", contains: "padding" },
      mark: { type: "line", point: true, color: this.colorValue },
      encoding: {
        x: { field: "date", type: "ordinal", axis: null, sort: null },
        y: { field: "count", type: "quantitative", axis: null, scale: { domainMin: 0 } },
        tooltip: [
          { field: "date", type: "ordinal", title: "Date" },
          { field: "count", type: "quantitative", title: "Judgements" }
        ]
      },
      config: { view: { stroke: null }, background: "transparent" }
    }
  }
}

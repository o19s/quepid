import { Controller } from "@hotwired/stimulus"

// This cell is freshly replaced on every judgement, which is exactly what
// lets it carry fresh sparkline values to the judge-sparkline outlet -
// that chart is never itself replaced (see broadcast_judge_activity_job.rb),
// so this is the only way new data actually reaches its already-mounted view.
export default class extends Controller {
  static values = { sparkline: Array }
  static outlets = ["judge-sparkline"]

  // Stimulus reads values before it connects outlets, so a freshly rendered
  // cell delivers its values from judgeSparklineOutletConnected - which also
  // covers a chart whose controller mounts after this cell.
  sparklineValueChanged(values) {
    this.chart?.updateValues(values)
  }

  judgeSparklineOutletConnected(chart) {
    this.chart = chart
    chart.updateValues(this.sparklineValue)
  }

  judgeSparklineOutletDisconnected() {
    this.chart = null
  }
}

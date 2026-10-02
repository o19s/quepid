import { Controller } from "@hotwired/stimulus"

// This cell is freshly replaced on every judgement, which is exactly what
// lets it carry fresh sparkline values to the judge-sparkline controller -
// that chart is never itself replaced (see broadcast_judge_activity_job.rb),
// so this is the only way new data actually reaches its already-mounted view.
export default class extends Controller {
  static values = { judgeId: Number, sparkline: Array }

  sparklineValueChanged(values) {
    const chart = document.getElementById(`judge-sparkline-${this.judgeIdValue}`)
    if (!chart) return

    const controller = this.application.getControllerForElementAndIdentifier(chart, "judge-sparkline")
    controller?.updateValues(values)
  }
}

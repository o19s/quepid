import { Controller } from "@hotwired/stimulus"
import * as d3 from "d3"

// Fixed chart dimensions matching the .sparkline-chart CSS (150×80)
const CHART_WIDTH = 150
const CHART_HEIGHT = 80
const MARGIN = { top: 2, right: 13, bottom: 6, left: 2 }

/**
 * Renders a D3 sparkline (line graph) of recent case scores with annotation
 * markers. Port of the Angular qgraph component.
 *
 * Usage:
 *   <div data-controller="sparkline" class="sparkline-chart"
 *        data-sparkline-max-value="10"
 *        data-sparkline-scores-value='[{"score":3.2,"updated_at":"2024-01-01"}]'
 *        data-sparkline-annotations-value='[{"message":"note","updated_at":"2024-01-01"}]'>
 *     <svg data-sparkline-target="svg"></svg>
 *   </div>
 */
export default class extends Controller {
  static targets = ["svg"]
  static values = {
    max: { type: Number, default: 0 },
    scores: { type: Array, default: [] },
    annotations: { type: Array, default: [] },
  }

  connect() {
    this.tooltip = null
    this.graph = null
    this.innerWidth = CHART_WIDTH - MARGIN.left - MARGIN.right
    this.innerHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
  }

  disconnect() {
    if (this.tooltip) {
      this.tooltip.remove()
      this.tooltip = null
    }
    this.graph = null
  }

  // Stimulus auto-calls these when values change.
  // Batch via microtask so that setting max + scores + annotations in
  // quick succession only triggers a single render pass.
  maxValueChanged() {
    this._scheduleRender()
  }
  scoresValueChanged() {
    this._scheduleRender()
  }
  annotationsValueChanged() {
    this._scheduleRender()
  }

  // Private

  _scheduleRender() {
    if (this._renderScheduled) return
    this._renderScheduled = true
    queueMicrotask(() => {
      this._renderScheduled = false
      this._render()
    })
  }

  _ensureSvg() {
    if (this.graph) return

    const svg = this.svgTarget

    d3.select(svg).attr("width", CHART_WIDTH).attr("height", CHART_HEIGHT)

    this.graph = d3
      .select(svg)
      .append("g")
      .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`)

    this.tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "d3-tip")
      .style("opacity", 0)
      .style("position", "absolute")
      .style("pointer-events", "none")
  }

  _render() {
    if (!this.maxValue) return

    const scores = this.scoresValue
    if (!scores || scores.length <= 1) {
      this.element.classList.remove("has-data")
      return
    }

    // Sort by date, take last 10
    const sorted = scores.slice().sort((a, b) => d3.ascending(a.updated_at, b.updated_at))
    const lastTen = sorted.slice(-10)

    if (lastTen.length <= 1) {
      this.element.classList.remove("has-data")
      return
    }

    const minDate = new Date(lastTen[0].updated_at)

    // Build combined data array: scores + annotations within the time range
    const data = []
    lastTen.forEach((s) => {
      data.push({
        type: "score",
        score: s.score,
        updated_at: s.updated_at,
        message: null,
      })
    })

    const annotations = this.annotationsValue || []
    annotations.forEach((a) => {
      const dateStr = a.updated_at
      if (dateStr && new Date(dateStr) >= minDate) {
        data.push({
          type: "annotation",
          score: null,
          updated_at: dateStr,
          message: a.message,
        })
      }
    })

    data.sort((a, b) => d3.ascending(a.updated_at, b.updated_at))

    const scoreData = data.filter((d) => d.type === "score" && d.score !== null)
    if (scoreData.length === 0) return

    // Show the chart and initialize SVG — deferred until first real render
    // so D3 can attach to a visible element
    this.element.classList.add("has-data")
    this._ensureSvg()
    if (!this.graph) return

    // Clear previous render
    this.graph.selectAll("path").remove()
    this.graph.selectAll(".marker").remove()

    const w = this.innerWidth
    const h = this.innerHeight

    const x = d3
      .scaleLinear()
      .domain([0, scoreData.length - 1])
      .range([0, w])
    const y = d3.scaleLinear().domain([0, this.maxValue]).range([h, 0])

    const line = d3
      .line()
      .x((_d, i) => x(i))
      .y((d) => y(d.score))

    // Draw score line
    this.graph.append("path").attr("d", line(scoreData))

    // Draw annotation markers — position by timestamp relative to score time range
    const tooltip = this.tooltip
    const t0 = new Date(scoreData[0].updated_at)
    const t1 = new Date(scoreData[scoreData.length - 1].updated_at)
    // If all scores share the same timestamp, fall back to centering annotations
    const xTime =
      t0.getTime() === t1.getTime()
        ? () => w / 2
        : d3.scaleTime().domain([t0, t1]).range([x(0), x(scoreData.length - 1)])
    data.forEach((d) => {
      if (d.type === "annotation" && d.message) {
        const xpos = xTime(new Date(d.updated_at))

        this.graph
          .append("line")
          .attr("class", "marker")
          .attr("x1", xpos)
          .attr("x2", xpos)
          .attr("y1", 0)
          .attr("y2", h)
          .style("pointer-events", "all")
          .on("mouseover", function (event) {
            if (!tooltip) return
            const coords = d3.pointer(event, document.body)
            tooltip.transition().duration(200).style("opacity", 0.9)
            tooltip
              .text(d.message)
              .style("left", `${coords[0] + 10}px`)
              .style("top", `${coords[1] - 28}px`)
          })
          .on("mouseout", function () {
            if (!tooltip) return
            tooltip.transition().duration(500).style("opacity", 0)
          })
          .append("title")
          .text(d.message)
      }
    })
  }
}

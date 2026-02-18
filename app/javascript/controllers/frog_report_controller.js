import { Controller } from "@hotwired/stimulus"
import * as d3 from "d3"
import { apiFetch } from "api/fetch"
import { buildApiUrl, buildPageUrl, getQuepidRootUrl } from "utils/quepid_root"

// Handles the Frog Pond Report modal: opens modal, renders D3 bar chart,
// and optionally refreshes ratings from a linked book.
// Replaces the Angular frog_report directive + FrogReportModalInstanceCtrl.
export default class extends Controller {
  static values = {
    caseId: Number,
    bookId: Number,
    queriesCount: Number,
    chartData: Array
  }

  static targets = ["modal", "chart", "refreshBtn", "errorEl"]

  connect() {
    this._modal = null
    this._chartRendered = false
  }

  get rootUrl() {
    return getQuepidRootUrl()
  }

  open(event) {
    event.preventDefault()
    if (!this._modal) {
      const el = this.modalTarget
      this._modal = window.bootstrap?.Modal?.getOrCreateInstance(el) ?? new window.bootstrap.Modal(el)
    }
    this._hideError()
    this._modal.show()

    if (!this._chartRendered) {
      // Small delay so the modal is visible and the chart container has dimensions
      requestAnimationFrame(() => this._renderChart())
      this._chartRendered = true
    }
  }

  async refreshFromBook(event) {
    event.preventDefault()
    const bookId = this.bookIdValue
    if (!bookId) return

    this._hideError()
    const inBackground = this.queriesCountValue >= 50

    let query = "create_missing_queries=false"
    if (inBackground) query += "&process_in_background=true"
    const url = buildApiUrl(this.rootUrl, "books", bookId, "cases", this.caseIdValue, "refresh") + "?" + query

    this.refreshBtnTarget.disabled = true
    try {
      const res = await apiFetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({})
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || data.error || res.statusText)
      }
      if (window.flash) window.flash.success = inBackground ? "Ratings are being refreshed in the background." : "Ratings have been refreshed."
      this._modal?.hide()
      if (inBackground) {
        setTimeout(() => { window.location.href = buildPageUrl(this.rootUrl, "") }, 500)
      } else {
        window.location.reload()
      }
    } catch (err) {
      this._showError(err.message || "Failed to refresh ratings.")
    } finally {
      this.refreshBtnTarget.disabled = false
    }
  }

  _renderChart() {
    const data = this.chartDataValue
    if (!data || data.length === 0) return

    const container = this.chartTarget
    const margin = { top: 10, right: 20, bottom: 60, left: 50 }
    const width = 800 - margin.left - margin.right
    const height = 200 - margin.top - margin.bottom

    const svg = d3.select(container)
      .append("svg")
      .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("style", "max-width: 800px; width: 100%; height: auto;")
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`)

    const x = d3.scaleBand()
      .domain(data.map(d => d.category))
      .range([0, width])
      .padding(0.05)

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.amount)])
      .nice()
      .range([height, 0])

    // X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "rotate(-25)")
      .style("text-anchor", "end")

    // Y axis
    svg.append("g")
      .call(d3.axisLeft(y))

    // Axis labels
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom - 5)
      .attr("text-anchor", "middle")
      .attr("class", "axis-label")
      .text("Rating Status")

    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -margin.left + 15)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .attr("class", "axis-label")
      .text("Number Queries")

    // Tooltip
    const tooltip = d3.select(container)
      .append("div")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.7)")
      .style("color", "#fff")
      .style("padding", "4px 8px")
      .style("border-radius", "4px")
      .style("font-size", "12px")
      .style("pointer-events", "none")
      .style("opacity", 0)

    // Bars
    svg.selectAll(".bar")
      .data(data)
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.category))
      .attr("y", d => y(d.amount))
      .attr("width", x.bandwidth())
      .attr("height", d => height - y(d.amount))
      .attr("fill", "steelblue")
      .on("mouseover", function(event, d) {
        d3.select(this).attr("fill", "red")
        tooltip
          .style("opacity", 1)
          .html(`${d.category}: ${d.amount}`)
      })
      .on("mousemove", function(event) {
        tooltip
          .style("left", (event.offsetX + 10) + "px")
          .style("top", (event.offsetY - 28) + "px")
      })
      .on("mouseout", function() {
        d3.select(this).attr("fill", "steelblue")
        tooltip.style("opacity", 0)
      })

    // Value labels on top of bars
    svg.selectAll(".label")
      .data(data)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("x", d => x(d.category) + x.bandwidth() / 2)
      .attr("y", d => y(d.amount) - 2)
      .attr("text-anchor", "middle")
      .attr("fill", "#333")
      .attr("font-size", "11px")
      .text(d => d.amount)
  }

  _hideError() {
    if (this.hasErrorElTarget) {
      this.errorElTarget.classList.add("d-none")
      this.errorElTarget.textContent = ""
    }
  }

  _showError(msg) {
    if (this.hasErrorElTarget) {
      this.errorElTarget.textContent = msg
      this.errorElTarget.classList.remove("d-none")
    }
  }
}

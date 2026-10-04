import { Controller } from "@hotwired/stimulus"
import { putJson } from "api/json"
import { HttpError } from "api/http_error"
import { openDynamicModal } from "utils/dynamic_modal"
import { getCoreStores } from "utils/core_store_access"
import { getCoreCapabilities } from "utils/core_capability_access"
import { getQuepidRootUrl } from "utils/quepid_root"
import coreFlash from "utils/core_flash"

export function buildFrogReportStats(queries) {
  const withResults = queries.filter(query => (query.docs || []).length > 0).length
  const withoutResults = queries.length - withResults
  const ratingsNeeded = queries.reduce((total, query) => total + (query.docs || []).length, 0)
  const missingRatings = queries.reduce((total, query) => {
    const missing = query.missingRatings == null
      ? Math.min(query.depthOfRating || 0, (query.docs || []).length)
      : query.missingRatings
    return total + missing
  }, 0)
  const missingRate = ratingsNeeded === 0 ? 0 : Math.round((missingRatings / ratingsNeeded) * 1000) / 10
  const allRated = queries.length > 0 && queries.every(query => query.allRated === true || query.missingRatings === 0)
  return { withResults, withoutResults, ratingsNeeded, missingRatings, missingRate, allRated }
}

export default class extends Controller {
  static targets = [
    "caseName", "queryCount", "withResults", "withoutResults", "ratingsNeeded",
    "allRated", "notAllRated", "missingRatings", "missingRate", "hopMessage",
    "chart", "refreshButton", "refreshIcon", "bookName", "error"
  ]

  static values = { modalRoot: Boolean, refreshUrlTemplate: String }

  open(event) {
    event.preventDefault()
    const modal = openDynamicModal({
      size: "lg",
      ariaLabelledBy: "frog-report-modal-title",
      templateId: "frog-report-modal-template"
    })
    if (!modal) return

    const content = modal.element.querySelector(".modal-content")
    content.dataset.controller = "frog-report"
    content.dataset.frogReportModalRootValue = "true"
    content.dataset.frogReportRefreshUrlTemplateValue = this.refreshUrlTemplateValue
    content.frogReportModal = modal
  }

  connect() {
    if (!this.modalRootValue) return
    this.store = getCoreStores().documents
    this.render()
    this.storeChange = () => this.render()
    this.store.addEventListener("change", this.storeChange)
    this.store.addEventListener("reset", this.storeChange)
  }

  disconnect() {
    this.store?.removeEventListener("change", this.storeChange)
    this.store?.removeEventListener("reset", this.storeChange)
    this.chartResult?.finalize()
  }

  render() {
    const queries = Object.values(this.store?.snapshot()?.queries || {})
    const capabilities = getCoreCapabilities()
    const { withResults, withoutResults, ratingsNeeded, missingRatings, missingRate, allRated } = buildFrogReportStats(queries)

    this.setText("caseName", capabilities.caseState?.caseName || "")
    this.setText("queryCount", queries.length)
    this.setText("withResults", withResults)
    this.setText("withoutResults", withoutResults)
    this.setText("ratingsNeeded", ratingsNeeded)
    this.setText("missingRatings", missingRatings)
    this.setText("missingRate", missingRate)
    this.setText("bookName", capabilities.caseState?.bookName || "")

    this.allRatedTarget.classList.toggle("d-none", !allRated)
    this.notAllRatedTarget.classList.toggle("d-none", allRated)
    this.hopMessageTarget.classList.toggle("d-none", allRated || missingRate <= 5)
    this.refreshButtonTarget.classList.toggle("d-none", !capabilities.caseState?.bookId)
    this.renderChart(this.distribution(queries))
  }

  setText(target, value) {
    if (this[`has${target[0].toUpperCase()}${target.slice(1)}Target`]) {
      this[`${target}Target`].textContent = String(value)
    }
  }

  distribution(queries) {
    const depth = queries.reduce((max, query) => Math.max(max, query.depthOfRating || 0), 0)
    const buckets = new Map()
    queries.forEach(query => {
      const missing = query.missingRatings == null
        ? Math.min(depth, (query.docs || []).length)
        : query.missingRatings
      buckets.set(missing, (buckets.get(missing) || 0) + 1)
    })
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([missing, count]) => ({
      category: missing === 0 ? "Fully Rated" : missing === depth ? "No Ratings" : `Missing ${missing}`,
      amount: count
    }))
  }

  renderChart(values) {
    if (!this.hasChartTarget || !window.vegaEmbed) return
    this.chartResult?.finalize()
    const spec = {
      $schema: "https://vega.github.io/schema/vega/v5.json",
      width: 800,
      height: 200,
      padding: 5,
      background: "#fff",
      autosize: { type: "fit-x", contains: "padding" },
      title: { text: "", subtitle: "Number of queries grouped by count of missing ratings", subtitleFontStyle: "italic", frame: "group", anchor: "start", offset: 10 },
      data: [{ name: "table", values }],
      scales: [
        { name: "xscale", type: "band", domain: { data: "table", field: "category" }, range: "width", padding: 0.05, round: true },
        { name: "yscale", type: "linear", domain: { data: "table", field: "amount" }, nice: true, range: "height" }
      ],
      axes: [
        { orient: "bottom", scale: "xscale", title: "Rating Status" },
        { orient: "left", scale: "yscale", title: "Number Queries" }
      ],
      marks: [{
        type: "rect",
        from: { data: "table" },
        encode: {
          enter: { x: { scale: "xscale", field: "category" }, width: { scale: "xscale", band: 1 }, y: { scale: "yscale", field: "amount" }, y2: { scale: "yscale", value: 0 }, fill: { value: "steelblue" } },
          hover: { fill: { value: "red" } }
        }
      }, {
        type: "text",
        from: { data: "table" },
        encode: { enter: { align: { value: "center" }, baseline: { value: "bottom" }, fill: { value: "#333" }, x: { scale: "xscale", field: "category", band: 0.5 }, y: { scale: "yscale", field: "amount", offset: -2 }, text: { field: "amount" } } }
      }]
    }
    window.vegaEmbed(this.chartTarget, spec, { actions: false, renderer: "svg" }).then(result => { this.chartResult = result })
  }

  async refresh() {
    const state = getCoreCapabilities().caseState || {}
    if (!state.bookId || !state.caseNo) return
    this.refreshButtonTarget.disabled = true
    this.refreshIconTarget.classList.add("spintime")
    this.errorTarget.classList.add("d-none")
    const background = Object.keys(this.store.snapshot().queries || {}).length >= 50
    const url = this.refreshUrlTemplateValue
      .replaceAll("__BOOK_ID__", state.bookId)
      .replaceAll("__BACKGROUND__", background ? "true" : "false")
    try {
      await putJson(url, {})
      if (!background) {
        const refreshQueries = getCoreCapabilities().queryLifecycle?.refreshQueries
        if (typeof refreshQueries !== "function") {
          throw new Error("Query refresh is unavailable")
        }
        await refreshQueries(state.caseNo)
      }
    coreFlash.show("success", background ? "Ratings are being refreshed in the background." : "Ratings have been refreshed.")
      if (background) window.location.assign(getQuepidRootUrl())
    } catch (error) {
      if (error instanceof HttpError) error.message = `${error.status} ${error.statusText}`
      this.errorTarget.textContent = `An error (${error.message}) occurred, please try again.`
      this.errorTarget.classList.remove("d-none")
    } finally {
      this.refreshButtonTarget.disabled = false
      this.refreshIconTarget.classList.remove("spintime")
    }
  }
}

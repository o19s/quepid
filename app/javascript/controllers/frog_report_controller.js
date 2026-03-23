import { Controller } from "@hotwired/stimulus"
import { apiUrl, csrfToken } from "modules/api_url"
import { showFlash } from "modules/flash_helper"

// Frog Pond Report — shows missing-ratings statistics and a Vega bar chart.
// Aggregates data from all query-row outlets to compute how many ratings
// are missing across the case.
export default class extends Controller {
  static targets = [
    "modal",
    "chartContainer",
    "queriesCount",
    "queriesWithResults",
    "queriesWithoutResults",
    "totalRatingsNeeded",
    "numberOfMissingRatings",
    "missingRatingsRate",
    "allRatedMessage",
    "missingRatingsMessage",
    "hopToItMessage",
    "refreshButton",
    "refreshSpinner",
    "refreshError",
  ]

  static outlets = ["query-row"]

  static values = {
    caseId: Number,
    caseName: { type: String, default: "" },
    bookId: { type: Number, default: 0 },
    bookName: { type: String, default: "" },
    queriesCount: { type: Number, default: 0 },
  }

  disconnect() {
    this._finalizeVegaView()
  }

  open(event) {
    if (event) event.preventDefault()

    const queryData = this._collectQueryData()
    const stats = computeFrogStatistics(queryData)
    this._renderSummary(stats)
    this._renderChart(stats)

    const modal = window.bootstrap.Modal.getOrCreateInstance(this.modalTarget)
    modal.show()
  }

  async refreshRatingsFromBook() {
    if (!this.bookIdValue) return

    this.refreshButtonTarget.disabled = true
    this.refreshSpinnerTarget.classList.remove("d-none")
    if (this.hasRefreshErrorTarget) {
      this.refreshErrorTarget.classList.add("d-none")
    }

    const processInBackground = this.queriesCountValue >= 50

    try {
      const response = await fetch(
        apiUrl(
          `api/books/${this.bookIdValue}/cases/${this.caseIdValue}/refresh?create_missing_queries=false&process_in_background=${processInBackground}`
        ),
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken(),
            Accept: "application/json",
          },
          body: JSON.stringify({}),
        }
      )

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.statusText || `Request failed (${response.status})`)
      }

      const modal = window.bootstrap.Modal.getInstance(this.modalTarget)
      if (modal) modal.hide()

      if (processInBackground) {
        showFlash("Ratings are being refreshed in the background.", "success")
        setTimeout(() => {
          window.location.href =
            document.body.dataset.quepidRootUrl || "/"
        }, 500)
      } else {
        showFlash("Ratings have been refreshed.", "success")
        window.location.reload()
      }
    } catch (error) {
      if (this.hasRefreshErrorTarget) {
        this.refreshErrorTarget.textContent = `An error (${error.message}) occurred, please try again.`
        this.refreshErrorTarget.classList.remove("d-none")
      }
      this.refreshButtonTarget.disabled = false
      this.refreshSpinnerTarget.classList.add("d-none")
    }
  }

  // --- Data collection from outlets ---

  _collectQueryData() {
    const queryData = []
    for (const qr of this.queryRowOutlets) {
      const docs = qr.lastSearchDocs || []
      const docsCount = docs.length
      let ratedCount = 0
      for (const doc of docs) {
        if (qr.ratingsStore && qr.ratingsStore.getRating(String(doc.id)) !== null) {
          ratedCount++
        }
      }
      queryData.push({ docsCount, ratedCount })
    }
    return queryData
  }

  _renderSummary(stats) {
    if (this.hasQueriesCountTarget) {
      this.queriesCountTarget.textContent = this.queriesCountValue
    }
    if (this.hasQueriesWithResultsTarget) {
      this.queriesWithResultsTarget.textContent = stats.queriesWithResults
    }
    if (this.hasQueriesWithoutResultsTarget) {
      this.queriesWithoutResultsTarget.textContent = this._pluralizeReturns(
        stats.queriesWithoutResults
      )
    }
    if (this.hasTotalRatingsNeededTarget) {
      this.totalRatingsNeededTarget.textContent = stats.totalRatingsNeeded
    }
    if (this.hasNumberOfMissingRatingsTarget) {
      this.numberOfMissingRatingsTarget.textContent = stats.numberOfMissingRatings
    }
    if (this.hasMissingRatingsRateTarget) {
      this.missingRatingsRateTarget.textContent = stats.missingRatingsRate
    }

    if (this.hasAllRatedMessageTarget) {
      this.allRatedMessageTarget.classList.toggle("d-none", !stats.allRated)
    }
    if (this.hasMissingRatingsMessageTarget) {
      this.missingRatingsMessageTarget.classList.toggle("d-none", stats.allRated)
    }
    if (this.hasHopToItMessageTarget) {
      this.hopToItMessageTarget.classList.toggle(
        "d-none",
        stats.allRated || stats.missingRatingsRate <= 5
      )
    }
  }

  _renderChart(stats) {
    if (!this.hasChartContainerTarget) return
    if (stats.tableRows.length === 0) {
      this.chartContainerTarget.innerHTML =
        '<p class="text-muted">No search results loaded yet. Expand some queries first.</p>'
      return
    }

    const spec = {
      $schema: "https://vega.github.io/schema/vega/v5.json",
      description: "Missing ratings distribution",
      width: 700,
      height: 200,
      padding: 5,
      title: {
        text: "",
        subtitle: "Number of queries grouped by count of missing ratings",
        subtitleFontStyle: "italic",
        frame: "group",
        anchor: "start",
        offset: 10,
      },
      data: [{ name: "table", values: stats.tableRows }],
      signals: [
        {
          name: "tooltip",
          value: {},
          on: [
            { events: "rect:mouseover", update: "datum" },
            { events: "rect:mouseout", update: "{}" },
          ],
        },
      ],
      scales: [
        {
          name: "xscale",
          type: "band",
          domain: { data: "table", field: "category" },
          range: "width",
          padding: 0.05,
          round: true,
        },
        {
          name: "yscale",
          domain: { data: "table", field: "amount" },
          nice: true,
          range: "height",
        },
      ],
      axes: [
        { orient: "bottom", scale: "xscale", title: "Rating Status" },
        { orient: "left", scale: "yscale", title: "Number Queries" },
      ],
      marks: [
        {
          type: "rect",
          from: { data: "table" },
          encode: {
            enter: {
              x: { scale: "xscale", field: "category" },
              width: { scale: "xscale", band: 1 },
              y: { scale: "yscale", field: "amount" },
              y2: { scale: "yscale", value: 0 },
            },
            update: { fill: { value: "steelblue" } },
            hover: { fill: { value: "red" } },
          },
        },
        {
          type: "text",
          encode: {
            enter: {
              align: { value: "center" },
              baseline: { value: "bottom" },
              fill: { value: "#333" },
            },
            update: {
              x: {
                scale: "xscale",
                signal: "tooltip.category",
                band: 0.5,
              },
              y: { scale: "yscale", signal: "tooltip.amount", offset: -2 },
              text: { signal: "tooltip.amount" },
              fillOpacity: [
                { test: "datum === tooltip", value: 0 },
                { value: 1 },
              ],
            },
          },
        },
      ],
    }

    // vegaEmbed is loaded globally by the vega gem + importmap
    if (typeof vegaEmbed === "function") {
      this._finalizeVegaView()
      this.chartContainerTarget.innerHTML = ""
      vegaEmbed(this.chartContainerTarget, spec, { actions: false })
        .then((result) => {
          this._vegaView = result.view
        })
        .catch((err) => {
          console.error("Vega render failed:", err)
          this.chartContainerTarget.innerHTML =
            '<p class="text-danger">Chart rendering failed.</p>'
        })
    } else {
      this.chartContainerTarget.innerHTML =
        '<p class="text-muted">Vega library not loaded. Chart unavailable.</p>'
    }
  }

  _finalizeVegaView() {
    if (this._vegaView) {
      this._vegaView.finalize()
      this._vegaView = null
    }
  }

  _pluralizeReturns(count) {
    if (count === 0) return "none return"
    if (count === 1) return "only one returns"
    return `${count} return`
  }
}

// Export statistics computation for testing.
// queryData: array of { docsCount, ratedCount }
export function computeFrogStatistics(queryData) {
  let totalRatingsNeeded = 0
  let numberOfRatings = 0
  let queriesWithResults = 0
  let queriesWithoutResults = 0

  // Per bucket, track total queries and how many are fully unrated
  // so we can label "No Ratings" only when every query in the bucket
  // has zero ratings.
  const missingBuckets = {}
  const fullyUnratedCounts = {}

  for (const q of queryData) {
    if (q.docsCount === 0) {
      queriesWithoutResults++
      continue
    }
    queriesWithResults++
    totalRatingsNeeded += q.docsCount
    numberOfRatings += q.ratedCount
    const missingCount = q.docsCount - q.ratedCount
    if (!missingBuckets[missingCount]) {
      missingBuckets[missingCount] = 0
      fullyUnratedCounts[missingCount] = 0
    }
    missingBuckets[missingCount]++

    if (q.ratedCount === 0) {
      fullyUnratedCounts[missingCount]++
    }
  }

  const numberOfMissingRatings = totalRatingsNeeded - numberOfRatings
  const missingRatingsRate =
    totalRatingsNeeded > 0
      ? Math.round((numberOfMissingRatings / totalRatingsNeeded) * 1000) / 10
      : 0

  const tableRows = []
  const sortedKeys = Object.keys(missingBuckets)
    .map(Number)
    .sort((a, b) => a - b)
  for (const key of sortedKeys) {
    let label
    if (key === 0) label = "Fully Rated"
    else if (fullyUnratedCounts[key] === missingBuckets[key]) label = "No Ratings"
    else label = `Missing ${key}`
    tableRows.push({ category: label, amount: missingBuckets[key] })
  }

  return {
    totalRatingsNeeded,
    numberOfRatings,
    numberOfMissingRatings,
    missingRatingsRate,
    queriesWithResults,
    queriesWithoutResults,
    allRated: numberOfMissingRatings === 0 && totalRatingsNeeded > 0,
    tableRows,
  }
}

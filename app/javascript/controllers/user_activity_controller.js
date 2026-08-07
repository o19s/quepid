// This controller uses global variables loaded via admin_users.js bundle
// vegaEmbed is available globally
import { Controller } from "@hotwired/stimulus"

export default class UserActivityController extends Controller {
  static values = {
    url: String,
    label: String
  }

  connect() {
    this.initializeHeatmap()
  }

  async initializeHeatmap() {
    // Calculate date range (last 12 months)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(now.getDate() + 1)
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    const data = await this.fetchData(startDate, tomorrow)
    const filledData = this.fillDateRange(startDate, tomorrow, data)

    try {
      await vegaEmbed(this.element, this.buildSpec(filledData), { actions: false, renderer: 'svg' })
    } catch (error) {
      console.error('Error rendering activity heatmap:', error)
    }
  }

  // Vega-Lite's ordinal week/day bands are driven entirely by what's present
  // in the data, so days with no activity need an explicit value:0 row —
  // otherwise weeks/days without any recorded activity would be skipped
  // instead of rendering as an empty cell in the calendar grid.
  fillDateRange(startDate, endDate, values) {
    const valueByDate = new Map(values.map(entry => [entry.date, entry.value]))
    const filled = []
    const current = new Date(startDate)

    while (current < endDate) {
      const dateStr = this.formatDate(current)
      filled.push({ date: dateStr, value: valueByDate.get(dateStr) || 0 })
      current.setDate(current.getDate() + 1)
    }

    return filled
  }

  buildSpec(data) {
    // A degenerate [0, 0] domain (i.e. no activity at all in range) would
    // otherwise map every cell to the top of the color range instead of
    // the empty/gray end, so the max is floored at 1.
    const maxValue = Math.max(1, ...data.map(entry => entry.value))

    return {
      $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
      data: { values: data },
      width: { step: 15 },
      height: { step: 15 },
      mark: { type: 'rect', cornerRadius: 2 },
      encoding: {
        x: {
          timeUnit: 'yearweek',
          field: 'date',
          type: 'ordinal',
          title: null,
          scale: { paddingInner: 0.2 },
          axis: {
            format: '%b',
            labelAngle: 0,
            labelOverlap: 'greedy',
            ticks: false,
            domain: false,
            grid: false
          }
        },
        y: {
          timeUnit: 'day',
          field: 'date',
          type: 'ordinal',
          scale: { paddingInner: 0.2 },
          axis: null
        },
        color: {
          field: 'value',
          type: 'quantitative',
          legend: null,
          scale: { domain: [0, maxValue], range: ['#ebedf0', '#2872bc'] }
        },
        tooltip: [
          { field: 'date', type: 'temporal', title: 'Date', format: '%b %d, %Y' },
          { field: 'value', type: 'quantitative', title: this.labelValue }
        ]
      },
      config: { view: { stroke: 'transparent' } }
    }
  }

  async fetchData(startDate, endDate) {
    const start = this.formatDate(startDate)
    const end = this.formatDate(endDate)
    const url = `${this.urlValue}&start=${start}&end=${end}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const rawData = await response.json()

      // Transform the data from timestamp: count to array of {date, value}
      // The backend returns Unix timestamps in seconds
      return Object.entries(rawData).map(([timestamp, count]) => {
        // The timestamp from backend is already in seconds, but may be a string
        const timestampNum = parseInt(timestamp)
        // Convert to milliseconds for JavaScript Date
        const date = new Date(timestampNum * 1000)
        return {
          date: date.toISOString().split('T')[0],
          value: count
        }
      })
    } catch (error) {
      console.error('Error fetching activity data:', error)
      return []
    }
  }

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
}

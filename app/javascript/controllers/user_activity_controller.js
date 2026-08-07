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
    let current = new Date(startDate)

    while (current < endDate) {
      const dateStr = this.formatDate(current)
      const value = valueByDate.get(dateStr) || 0

      // tooltipDate is a precomputed display string used by the tooltip
      // signal in buildSpec(), which suppresses the tooltip entirely for
      // zero-activity days (matching the old cal-heatmap behavior of only
      // showing a tooltip where there was actual activity).
      filled.push({
        date: dateStr,
        value,
        tooltipDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      })

      const next = new Date(current)
      next.setDate(next.getDate() + 1)
      current = next
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
      width: { step: 17 },
      height: { step: 17 },
      mark: { type: 'rect', cornerRadius: 2 },
      encoding: {
        x: {
          // "date" is a date-only string (e.g. "2026-08-03"), which Vega
          // always parses as UTC midnight — pairing that with a local
          // ("yearweek") timeUnit would re-bucket it using the viewer's
          // own timezone offset, shifting cells by a day for anyone west
          // of UTC. The utc* timeUnit keeps parsing and bucketing in the
          // same (UTC) timezone so it's consistent for every viewer.
          timeUnit: 'utcyearweek',
          field: 'date',
          type: 'ordinal',
          title: null,
          scale: { paddingInner: 0.2 },
          axis: {
            // One ordinal band per week means "greedy" overlap-avoidance
            // still leaves multiple non-adjacent bands labeled with the
            // same month (e.g. "Oct" repeated across every October week).
            // Only label the band that starts a new month, so each month
            // name is printed once. utcdate/utcFormat match the utc*
            // timeUnit above so the label lines up with the actual bucket.
            labelExpr: "utcdate(datum.value) <= 7 ? utcFormat(datum.value, '%b') : ''",
            labelAngle: 0,
            labelOverlap: false,
            ticks: false,
            domain: false,
            grid: false
          }
        },
        y: {
          timeUnit: 'utcday',
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
        // A field-array tooltip always renders every listed field, even
        // when its value is null (as the literal text "null") — there's no
        // per-field way to omit a row. Returning null for the *whole*
        // tooltip object via a signal is what actually makes vega-tooltip
        // hide the tooltip, so zero-activity days show nothing at all. The
        // signal must be wrapped in `value` — encoding.tooltip's signal form
        // is a ValueDef (`{value: {signal: ...}}`), not a bare SignalRef.
        tooltip: {
          value: {
            signal: `datum.value > 0 ? {'Date': datum.tooltipDate, ${JSON.stringify(this.labelValue)}: datum.value} : null`
          }
        }
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

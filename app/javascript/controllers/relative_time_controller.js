import { Controller } from "@hotwired/stimulus"

const UNITS = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["week", 60 * 60 * 24 * 7],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
  ["second", 1]
]

// Formats a server-rendered <time datetime> as "3 weeks ago" when it connects.
export default class extends Controller {
  connect() {
    this.element.textContent = relativeTime(this.element.getAttribute("datetime"))
  }
}

export function relativeTime(value, now = Date.now()) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const deltaSeconds = Math.round((date.getTime() - now) / 1000)
  const [unit, seconds] = UNITS.find(([, size]) => Math.abs(deltaSeconds) >= size) || ["second", 1]
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.round(deltaSeconds / seconds),
    unit
  )
}

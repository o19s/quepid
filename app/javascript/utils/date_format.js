// Snapshot short dates use the viewer's local timezone and a two-digit year.
export function formatShortDate(value) {
  if (value == null || value === "") return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit"
  })
}

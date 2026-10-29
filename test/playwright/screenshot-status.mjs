#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"
import { linkedScreenshotStatus } from "./screenshot-tracker.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
let scenario = null
let json = false
let dueOnly = false
let sourceChanged = false
let includeAlternates = false
while (args.length) {
  const flag = args.shift()
  if (flag === "--scenario") scenario = args.shift()
  else if (flag === "--json") json = true
  else if (flag === "--due-only") dueOnly = true
  else if (flag === "--source-changed") sourceChanged = true
  else if (flag === "--include-alternates") includeAlternates = true
  else throw new Error(`Unknown option: ${flag}`)
}
const rows = linkedScreenshotStatus(root).filter(
  (row) =>
    (!scenario || row.scenario === scenario) &&
    // Alternates are captured on request, so a source change only counts when asked for.
    // Missing and corrupt images (--due-only) are integrity problems and always reported.
    (includeAlternates || !sourceChanged || !row.variantOf) &&
    (!dueOnly || ["missing", "corrupt"].includes(row.current.status)) &&
    (!sourceChanged || row.current.status === "stale")
)
if (json) console.log(JSON.stringify(rows, null, 2))
else {
  for (const row of rows) {
    const describe = (status) => (status === "stale" ? "source_changed (advisory)" : status)
    const variant = row.variantOf ? ` (alternate of ${row.variantOf})` : ""
    console.log(
      `${row.scenario} / ${row.state}${variant} → ${row.id}: ${describe(row.current.status)}`
    )
    for (const side of ["current", "previous", "legacy"]) {
      console.log(
        `  ${side}: ${describe(row[side].status)}${row[side].image ? ` — ${row[side].image}` : ""}`
      )
    }
  }
  if (!rows.length) console.log("No linked screenshots match this filter.")
}

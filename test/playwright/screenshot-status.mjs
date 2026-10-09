#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"
import { linkedScreenshotStatus } from "./screenshot-tracker.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const args = process.argv.slice(2)
let scenario = null
let json = false
let dueOnly = false
while (args.length) {
  const flag = args.shift()
  if (flag === "--scenario") scenario = args.shift()
  else if (flag === "--json") json = true
  else if (flag === "--due-only") dueOnly = true
  else throw new Error(`Unknown option: ${flag}`)
}
const rows = linkedScreenshotStatus(root).filter((row) =>
  (!scenario || row.scenario === scenario) && (!dueOnly || row.current.status !== "current")
)
if (json) console.log(JSON.stringify(rows, null, 2))
else {
  for (const row of rows) {
    console.log(`${row.scenario} / ${row.state} → ${row.id}: ${row.current.status}`)
    for (const side of ["current", "previous", "legacy"]) {
      console.log(`  ${side}: ${row[side].status}${row[side].image ? ` — ${row[side].image}` : ""}`)
    }
  }
  if (!rows.length) console.log("No linked screenshots match this filter.")
}

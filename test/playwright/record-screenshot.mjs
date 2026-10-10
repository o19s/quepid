#!/usr/bin/env node
import path from "node:path"
import { fileURLToPath } from "node:url"
import { readHistory, recordScreen, sourceFingerprint, storedImageStatus } from "./screen-history.mjs"
import { scenarioCaptureOptions } from "./screenshot-tracker.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const options = { paths: [] }
const args = process.argv.slice(2)
while (args.length) {
  const flag = args.shift()
  if (flag === "--check") options.check = true
  else if (flag === "--legacy-absent") options.legacyAbsent = true
  else if (flag === "--legacy-image") options.legacyImage = args.shift()
  else if (flag === "--legacy-ref") options.legacyRef = args.shift()
  else if (flag === "--path") options.paths.push(args.shift())
  else if (flag === "--captured-at") options.capturedAt = args.shift()
  else if (flag === "--legacy-captured-at") options.legacyCapturedAt = args.shift()
  else if (["--id", "--title", "--area", "--image", "--source", "--scenario", "--state"].includes(flag)) {
    options[flag.slice(2)] = args.shift()
  } else throw new Error(`Unknown option: ${flag}`)
}

if (options.scenario) {
  if (!options.state) throw new Error("--state is required with --scenario")
  const capture = scenarioCaptureOptions(root, options.scenario, options.state, options.paths)
  if (options.id && options.id !== capture.id) throw new Error("--id must match the screenshot ID linked in tracking.yml")
  options.id = capture.id
  options.title ||= capture.title
  options.area ||= capture.area
  options.paths = capture.paths
}
if (!options.id || !options.title || !options.area) throw new Error("Use --scenario ID --state NAME, or supply --id, --title, --area and --path")
const source = sourceFingerprint(root, options.paths)
if (options.check) {
  const previous = readHistory(root).screens[options.id]?.versions.at(-1)
  const missing = storedImageStatus(root, previous).status !== "available"
  console.log(JSON.stringify({ id: options.id, source, needsCapture: missing || previous.source !== source }))
} else {
  if (!options.source) throw new Error("Use --check before capture, then pass its --source fingerprint when recording")
  console.log(JSON.stringify(recordScreen(root, options)))
}

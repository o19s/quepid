import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { captureImplementations } from "./capture-recipes.mjs"
import { captureRecipes } from "./capture-registry.mjs"
import { historyLocation, recordScreen, sourceFingerprint } from "./screen-history.mjs"
import { scenarioCaptureOptions } from "./screenshot-tracker.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
let input = ""
for await (const chunk of process.stdin) input += chunk
const request = JSON.parse(input)
const recipe = captureRecipes[request.id]
const progress = (message) => console.log(JSON.stringify({ message }))
let directory
try {
  if (!recipe || !/^[a-f0-9-]{36}$/.test(request.jobId)) throw new Error("Unknown capture recipe or invalid job")
  if (historyLocation(root).branch !== request.branch) throw new Error("Branch changed before capture")
  const options = scenarioCaptureOptions(root, recipe.scenario, recipe.state, recipe.paths)
  if (options.id !== request.id || sourceFingerprint(root, options.paths) !== request.source) throw new Error("Source changed before capture; retry")
  directory = path.join(root, ".playwright-mcp", ".capture-jobs", request.jobId)
  fs.mkdirSync(directory, { recursive: true })
  const image = path.join(directory, "capture.png")
  const implementation = captureImplementations[recipe.id]
  if (!implementation) throw new Error("Capture recipe implementation is missing")
  const capture = await implementation(image, progress)
  const latest = scenarioCaptureOptions(root, recipe.scenario, recipe.state, recipe.paths)
  if (sourceFingerprint(root, latest.paths) !== request.source) throw new Error("Source dependencies changed during capture; retry")
  if (fs.readFileSync(path.join(root, ".playwright-mcp", ".capture-jobs", "active"), "utf8") !== request.jobId) throw new Error("Capture job no longer active")
  progress("Saving Current capture…")
  recordScreen(root, { ...latest, image, source: request.source, expectedBranch: request.branch, expectedCurrent: request.current, recapture: true, capture })
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  if (directory) fs.rmSync(directory, { recursive: true, force: true })
}

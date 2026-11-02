import path from "node:path"
import { execFileSync } from "node:child_process"
import { readHistory, sourceFingerprint, storedImageStatus } from "./screen-history.mjs"
import { screenshotPaths, screenshotSourceCurrent } from "./screenshot-dependencies.mjs"

export function readScreenshotTracker(root) {
  const script = `require 'yaml'; require 'json'; require 'date'; data = YAML.safe_load_file(ARGV[0], permitted_classes: [Date, Time], aliases: true); puts JSON.generate(data)`
  return JSON.parse(
    execFileSync("ruby", ["-e", script, path.join(root, "docs/manual-testing/tracking.yml")], {
      encoding: "utf8"
    })
  )
}

export function scenarioCaptureOptions(
  root,
  scenarioId,
  state,
  extraPaths = [],
  tracker = readScreenshotTracker(root)
) {
  for (const part of Object.values(tracker.parts || {})) {
    const scenario = part.scenarios?.[scenarioId]
    if (!scenario) continue
    const id = scenario.screenshots?.[state]
    if (typeof id !== "string" || !id)
      throw new Error(
        `Add screenshots.${state} to scenario ${scenarioId} in tracking.yml before recording`
      )
    const existing = readHistory(root).screens[id]
    return {
      id,
      title: `${scenario.title} — ${state.replaceAll("-", " ")}`,
      area: part.file.replace(/^\d+-/, "").replace(/\.md$/, "").replaceAll("-", " "),
      paths: screenshotPaths(
        id,
        [...new Set([...(scenario.paths || []), ...(existing?.paths || []), ...extraPaths])],
        tracker
      )
    }
  }
  throw new Error(`Unknown scenario: ${scenarioId}`)
}

export function linkedScreenshotStatus(
  root,
  tracker = readScreenshotTracker(root),
  history = readHistory(root),
  { screenId, currentOnly = false } = {}
) {
  const rows = []
  const imageStatus = (version) => storedImageStatus(root, version)
  const fingerprints = new Map()
  const sourceFiles = new Map()
  const fingerprint = (paths) => {
    const key = JSON.stringify([...paths].sort())
    if (!fingerprints.has(key)) fingerprints.set(key, sourceFingerprint(root, paths))
    return fingerprints.get(key)
  }
  for (const [partId, part] of Object.entries(tracker.parts || {})) {
    for (const [scenarioId, scenario] of Object.entries(part.scenarios || {})) {
      // `alternates` maps a state to the default state it varies; alternates are captured
      // on request rather than as part of every pass.
      const alternates = scenario.alternates || {}
      for (const [state, primary] of Object.entries(alternates)) {
        if (
          !scenario.screenshots?.[state] ||
          !scenario.screenshots?.[primary] ||
          alternates[primary]
        )
          throw new Error(
            `Alternate ${scenarioId}/${state} must vary a default state of the scenario`
          )
      }
      for (const [state, id] of Object.entries(scenario.screenshots || {})) {
        if (screenId !== undefined && id !== screenId) continue
        if (typeof id !== "string" || !id)
          throw new Error(`Invalid screenshot ID for ${scenarioId}/${state}`)
        const screen = history.screens[id]
        const now = screen?.versions.at(-1)
        const paths = screenshotPaths(
          id,
          [...new Set([...(scenario.paths || []), ...(screen?.paths || [])])],
          tracker
        )
        const current = imageStatus(now)
        if (current.status === "not_recorded") current.status = "missing"
        if (current.status === "available") {
          try {
            current.status = screenshotSourceCurrent(
              root,
              screen,
              paths,
              fingerprint(paths),
              sourceFiles
            )
              ? "current"
              : "stale"
          } catch {
            current.status = "stale"
          }
        }
        rows.push({
          part: partId,
          scenario: scenarioId,
          state,
          id,
          variantOf: alternates[state] || null,
          paths,
          current,
          ...(currentOnly
            ? {}
            : {
                previous: imageStatus(screen?.versions.at(-2)),
                legacy: screen?.legacy?.absent
                  ? { status: "absent", image: null }
                  : imageStatus(screen?.legacy?.image ? screen.legacy : null)
              })
        })
      }
    }
  }
  return rows
}

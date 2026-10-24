import { readHistory } from "./screen-history.mjs"
import { readScreenshotTracker, scenarioCaptureOptions } from "./screenshot-tracker.mjs"
import { captureRecipes } from "./capture-registry.mjs"
import { screenshotPaths } from "./screenshot-dependencies.mjs"

export const claudeCapturePaths = [
  "test/playwright/capture-options.mjs",
  "test/playwright/capture-claude.mjs",
  "test/playwright/capture-agent.md"
]

export function captureOptions(root, id, tracker = readScreenshotTracker(root)) {
  const recipe = captureRecipes[id]
  if (recipe) return scenarioCaptureOptions(root, recipe.scenario, recipe.state, recipe.paths, tracker)
  const screen = readHistory(root).screens[id]
  if (!screen?.versions.length) throw new Error("Unknown recorded screen; automatic capture not configured")
  const paths = new Set([...(screen.paths || []), ...claudeCapturePaths])
  for (const part of Object.values(tracker.parts || {})) {
    for (const scenario of Object.values(part.scenarios || {})) {
      if (Object.values(scenario.screenshots || {}).includes(id)) {
        for (const source of scenario.paths || []) paths.add(source)
      }
    }
  }
  return { id, title: screen.title, area: screen.area, paths: screenshotPaths(id, [...paths], tracker) }
}

export function captureScenarioContext(root, id, tracker = readScreenshotTracker(root)) {
  const contexts = []
  for (const part of Object.values(tracker.parts || {})) {
    for (const [scenarioId, scenario] of Object.entries(part.scenarios || {})) {
      for (const [state, screenId] of Object.entries(scenario.screenshots || {})) {
        if (screenId === id) contexts.push({ scenarioId, state, title: scenario.title, notes: scenario.notes, file: `docs/manual-testing/${part.file}` })
      }
    }
  }
  return contexts
}

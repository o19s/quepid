import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"

const styles = "app/assets/stylesheets/"
const layouts = "app/views/layouts/"
const sharedStyles = ["fonts", "base", "navbar-brand"]
const applicationStyles = [...sharedStyles, "bootstrap5-add", "signup", "judgements"]
const coreStyles = [...sharedStyles, "core-additions", "bootstrap5-compat", "style", "panes", "stackedChart", "tour", "docs", "qscore", "qgraph", "misc", "animation", "froggy", "json-explorer"]
const sharedLayouts = ["_header", "_header_navigation", "_header_management_actions", "_header_help_links", "_footer"]
const captureInfrastructure = new Set([
  "test/playwright/capture-options.mjs", "test/playwright/capture-claude.mjs",
  "test/playwright/capture-agent.md", "test/playwright/capture-registry.mjs",
  "test/playwright/capture-recipes.mjs", "test/playwright/capture-screenshot.mjs"
])
const surfacePaths = {
  application: [...applicationStyles.map(name => `${styles}${name}.css`), ...["application", "_head_common", "_sidebar", ...sharedLayouts].map(name => `${layouts}${name}.html.erb`)],
  core: [...coreStyles.map(name => `${styles}${name}.css`), ...["application", "_head_common", "_case_head", "_case_workspace", "_header_core_app", "_header_core_actions", "_footer_core_app", "_header_navigation", "_header_help_links"].map(name => `${layouts}${name}.html.erb`)],
  admin: [...applicationStyles.map(name => `${styles}${name}.css`), ...["admin", "_admin_sidebar", ...sharedLayouts].map(name => `${layouts}${name}.html.erb`)],
  analytics: [...applicationStyles.map(name => `${styles}${name}.css`), ...["analytics", ...sharedLayouts].map(name => `${layouts}${name}.html.erb`)],
  viewer: [],
  blazer: [`${layouts}blazer/application.html.erb`]
}

export function screenshotPaths(id, paths, tracker) {
  const mapping = tracker?.screenshot_surfaces
  const scenario = id.split("/")[0]
  const part = scenario.split(".")[0].padStart(2, "0")
  const surface = mapping?.screens?.[id] || mapping?.scenarios?.[scenario] || mapping?.parts?.[part]
  if (!surface || surface === "conservative") return [...new Set(paths)] // Unknown surfaces retain conservative dependencies.
  if (!Object.hasOwn(surfacePaths, surface)) throw new Error(`Unknown screenshot surface: ${surface}`)
  return [...new Set(paths.flatMap(source => {
    if (surface !== "viewer" && captureInfrastructure.has(source)) return []
    if (source.replace(/\/$/, "") === styles.slice(0, -1)) return surfacePaths[surface].filter(file => file.startsWith(styles))
    if (source.replace(/\/$/, "") === layouts.slice(0, -1)) return surfacePaths[surface].filter(file => file.startsWith(layouts))
    return [source] // Explicit dependencies are never discarded.
  }))]
}

const digest = value => crypto.createHash("sha256").update(value).digest("hex")
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
const historical = new Map()
const matches = (file, sources) => sources.some(source => {
  if (source.includes("*")) {
    const pattern = source.split("*").map(part => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")
    return new RegExp(`^${pattern}$`).test(file)
  }
  return file === source || file.startsWith(`${source.replace(/\/$/, "")}/`)
})

export function snapshotFingerprint(paths, files) {
  const hash = crypto.createHash("sha256")
  hash.update(JSON.stringify([...paths].sort()))
  for (const file of Object.keys(files).sort()) hash.update(`\0${file}\0${files[file]}`)
  return hash.digest("hex")
}

export function screenshotSourceFiles(root, paths, commit) {
  if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid capture commit")
  let files
  if (commit) {
    const key = `${root}\0${commit}`
    if (!historical.has(key)) historical.set(key, { names: git(root, "ls-tree", "-r", "--name-only", "-z", commit).split("\0").filter(Boolean), hashes: new Map() })
    const tree = historical.get(key)
    files = Object.fromEntries(tree.names.filter(file => matches(file, paths)).map(file => {
      if (!tree.hashes.has(file)) tree.hashes.set(file, digest(execFileSync("git", ["-C", root, "show", `${commit}:${file}`], { maxBuffer: 32 * 1024 * 1024 })))
      return [file, tree.hashes.get(file)]
    }))
  } else {
    const names = [...new Set(git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0"))]
    files = Object.fromEntries(names.filter(file => file && matches(file, paths) && fs.existsSync(path.join(root, file))).sort().map(file => [file, digest(fs.readFileSync(path.join(root, file)))]))
  }
  return files
}

// Changing dependency metadata must not require another image when the captured
// source can be verified and the retained files have not changed.
export function screenshotSourceCurrent(root, screen, paths, fingerprint, cache = new Map()) {
  const current = screen?.versions.at(-1)
  if (!current) return false
  if (fingerprint === current.source) return true
  const recordedPaths = current.sourcePaths || screen.paths
  try {
    const covered = paths.every(source => recordedPaths.includes(source) || (!source.includes("*") && matches(source, recordedPaths)))
    if (!covered) return false
    const snapshot = commit => {
      const key = JSON.stringify([root, commit || null, [...recordedPaths].sort()])
      if (!cache.has(key)) cache.set(key, screenshotSourceFiles(root, recordedPaths, commit))
      return cache.get(key)
    }
    let files = current.sourceFiles || (!current.dirty && current.commit ? snapshot(current.commit) : null)
    if (!files || snapshotFingerprint(recordedPaths, files) !== current.source) files = snapshot()
    if (snapshotFingerprint(recordedPaths, files) !== current.source) return false
    const retained = Object.fromEntries(Object.entries(files).filter(([file]) => matches(file, paths)))
    return snapshotFingerprint(paths, retained) === fingerprint
  } catch {
    return false // Unverifiable dirty or unavailable historical sources stay due.
  }
}

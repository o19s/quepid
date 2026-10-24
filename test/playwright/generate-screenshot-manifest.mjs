#!/usr/bin/env node
/**
 * Scan `.playwright-mcp/` (including topic subfolders) for PNGs and write
 * screenshot-manifest.json for test/playwright/screenshot-viewer.html.
 *
 * Layout (gitignored):
 *   .playwright-mcp/<topic>/*-before.png + *-after.png
 *   e.g. share-case/, prior/
 *
 * Flat files in `.playwright-mcp/` still work (topic = "(root)").
 *
 * Each pair whose bytes differ gets a `diff`: changed-pixel stats plus
 * `regions`, padded boxes in screenshot pixels around each cluster of
 * changes (png-diff.mjs). The viewer draws them; agents can read them to find
 * what changed.
 *
 * Run via: yarn screenshots:view  (or node test/playwright/generate-screenshot-manifest.mjs)
 */

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { COMPARE_OPTIONS, decodePng, diffRegions, THUMB_GRID, thumbnail, thumbnailDifference } from "./png-diff.mjs"
import { readHistory, sourceFingerprint, storedImageStatus } from "./screen-history.mjs"
import { linkedScreenshotStatus, readScreenshotTracker } from "./screenshot-tracker.mjs"
import { screenshotPaths, screenshotSourceCurrent } from "./screenshot-dependencies.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")
const shotDir = path.join(repoRoot, ".playwright-mcp")
const manifestPath = path.join(__dirname, "screenshot-manifest.json")
// Decoding every pair takes minutes, so pixel diffs are cached by file size
// and mtime. Bump DIFF_VERSION when png-diff.mjs's output changes.
const diffCachePath = path.join(shotDir, ".diff-cache.json")
const DIFF_VERSION = 4

function titleize(stem) {
  return stem
    .replace(/^cmp-/, "")
    .replace(/^migration-/, "migration: ")
    .replace(/-/g, " ")
}

function buffersEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function compareFiles(beforeRel, afterRel) {
  const beforeBytes = fs.readFileSync(path.join(shotDir, beforeRel))
  const afterBytes = fs.readFileSync(path.join(shotDir, afterRel))

  const byteIdentical = buffersEqual(beforeBytes, afterBytes)

  return {
    beforeSize: beforeBytes.length,
    afterSize: afterBytes.length,
    byteIdentical,
    diff: byteIdentical ? null : pixelDiff(beforeRel, afterRel, beforeBytes, afterBytes)
  }
}

function loadDiffCache() {
  try {
    const cache = JSON.parse(fs.readFileSync(diffCachePath, "utf8"))
    return cache.version === DIFF_VERSION ? cache.entries : {}
  } catch {
    return {}
  }
}

const diffCache = loadDiffCache()
const usedCacheKeys = new Set()

function fileStamp(rel) {
  const stat = fs.statSync(path.join(shotDir, rel))
  return `${stat.size}:${stat.mtimeMs}`
}

function pixelDiff(beforeRel, afterRel, beforeBytes, afterBytes) {
  const key = `${beforeRel}|${afterRel}`
  const stamp = `${fileStamp(beforeRel)}|${fileStamp(afterRel)}`
  usedCacheKeys.add(key)
  if (diffCache[key]?.stamp === stamp) return diffCache[key].diff

  let diff
  try {
    diff = diffRegions(decodePng(beforeBytes), decodePng(afterBytes))
  } catch (error) {
    diff = { error: error.message, regions: [] }
  }
  diffCache[key] = { stamp, diff }
  return diff
}

function saveDiffCache() {
  const entries = Object.fromEntries(Object.entries(diffCache).filter(([key]) => usedCacheKeys.has(key)))
  fs.writeFileSync(diffCachePath, JSON.stringify({ version: DIFF_VERSION, entries }))
}

/** Recursively list PNG paths relative to shotDir (posix-style). */
function listPngsRelative(dir, prefix = "") {
  if (!fs.existsSync(dir)) return []

  const out = []
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith(".")) continue
    const abs = path.join(dir, name)
    const rel = prefix ? `${prefix}/${name}` : name
    const stat = fs.statSync(abs)
    if (stat.isDirectory()) {
      out.push(...listPngsRelative(abs, rel))
    } else if (name.endsWith(".png")) {
      out.push(rel.replaceAll("\\", "/"))
    }
  }
  return out
}

function topicAndFile(relPath) {
  const parts = relPath.split("/")
  if (parts.length === 1) {
    return { topic: "(root)", fileName: parts[0], relDir: "" }
  }
  const fileName = parts[parts.length - 1]
  const relDir = parts.slice(0, -1).join("/")
  return { topic: relDir, fileName, relDir }
}

/**
 * Flags Current screens whose latest image is byte-identical to another
 * screen's (different scenario or state, same rendered page). Each member
 * gets `duplicates` (the other screens' id/title) and every member except the
 * first in listing order gets `duplicateShadowed`, which the viewer's "Hide
 * duplicate captures" filter uses to keep one representative per group.
 */
function markDuplicateCaptures(current) {
  const entries = [...current.groups, ...current.singles].sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id, undefined, { numeric: true }))
  const byHash = new Map()
  for (const entry of entries) {
    const image = entry.after || entry.image
    let hash
    try {
      hash = crypto.createHash("sha256").update(fs.readFileSync(path.join(shotDir, image))).digest("hex")
    } catch {
      continue // missing or unreadable image: reported by captureStatus, not a duplicate
    }
    byHash.set(hash, [...(byHash.get(hash) || []), entry])
  }
  for (const members of byHash.values()) {
    if (members.length < 2) continue
    members.forEach((entry, index) => {
      entry.duplicates = members.filter((other) => other !== entry).map((other) => ({ id: other.id, title: other.title }))
      if (index > 0) entry.duplicateShadowed = true
    })
  }
}

// Screens whose thumbnails differ in at most this percent of cells are "similar".
const SIMILAR_PERCENT = 2
const thumbCachePath = path.join(shotDir, ".thumb-cache.json")

function loadThumbCache() {
  try {
    return JSON.parse(fs.readFileSync(thumbCachePath, "utf8"))
  } catch {
    return {}
  }
}

/**
 * Flags Current screens that look like the same page as another screen
 * without being byte-identical (a modal opened, a label reworded). Compares
 * coarse luminance thumbnails of same-sized images; each entry gets `similar`
 * (nearest matches with the percent of the page that differs) and every entry
 * after the first of its look-alike cluster, in listing order, gets
 * `similarShadowed` for the viewer's "hide near-duplicates" filter.
 * Thumbnails are cached by image path and size (history images are
 * content-addressed, so a path never changes meaning).
 */
function markSimilarCaptures(current) {
  const entries = [...current.groups, ...current.singles].sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id, undefined, { numeric: true }))
  const cache = loadThumbCache()
  const used = {}
  const items = []
  for (const entry of entries) {
    const image = entry.after || entry.image
    try {
      const size = fs.statSync(path.join(shotDir, image)).size
      const cached = cache[image]
      if (cached?.size === size && cached.grid === THUMB_GRID) {
        used[image] = cached
      } else {
        const png = decodePng(fs.readFileSync(path.join(shotDir, image)))
        used[image] = { size, grid: THUMB_GRID, width: png.width, height: png.height, thumb: Buffer.from(thumbnail(png)).toString("base64") }
      }
      items.push({ entry, width: used[image].width, height: used[image].height, thumb: Buffer.from(used[image].thumb, "base64") })
    } catch {
      // Missing, corrupt or unsupported image: not comparable.
    }
  }
  if (fs.existsSync(shotDir)) fs.writeFileSync(thumbCachePath, JSON.stringify(used))

  const representatives = items.filter((item) => !item.entry.duplicateShadowed)
  const kept = []
  for (const item of representatives) {
    const match = kept.find((other) => other.width === item.width && other.height === item.height && thumbnailDifference(item.thumb, other.thumb) <= SIMILAR_PERCENT)
    if (match) item.entry.similarShadowed = true
    else kept.push(item)
  }
  for (const item of items) {
    if (item.entry.duplicateShadowed) item.entry.similarShadowed = true
    const similar = []
    for (const other of representatives) {
      if (other === item || other.width !== item.width || other.height !== item.height) continue
      if (item.entry.duplicates?.some((duplicate) => duplicate.id === other.entry.id)) continue
      const percent = thumbnailDifference(item.thumb, other.thumb)
      if (percent <= SIMILAR_PERCENT) similar.push({ id: other.entry.id, title: other.entry.title, percentDifferent: Number(percent.toFixed(2)) })
    }
    if (similar.length) item.entry.similar = similar.sort((a, b) => a.percentDifferent - b.percentDifferent).slice(0, 5)
  }
}

function buildManifest() {
  if (!fs.existsSync(shotDir)) {
    return {
      generatedAt: new Date().toISOString(),
      shotDir: ".playwright-mcp",
      summary: { pairs: 0, byteIdentical: 0, byteDifferent: 0, visuallyDifferent: 0, topics: 0 },
      topics: [],
      groups: [],
      singles: []
    }
  }

  const files = listPngsRelative(shotDir)
  // key: `${topic}::${stem}`
  const byKey = new Map()

  for (const rel of files) {
    const { topic, fileName, relDir } = topicAndFile(rel)
    const before = fileName.match(/^(.+)-before\.png$/)
    const after = fileName.match(/^(.+)-after\.png$/)
    const keyPrefix = `${topic}::`

    if (before) {
      const stem = before[1]
      const key = keyPrefix + stem
      const entry = byKey.get(key) || {
        topic,
        relDir,
        stem,
        title: titleize(stem),
        before: null,
        after: null,
        unpaired: null
      }
      entry.before = rel
      byKey.set(key, entry)
      continue
    }

    if (after) {
      const stem = after[1]
      const key = keyPrefix + stem
      const entry = byKey.get(key) || {
        topic,
        relDir,
        stem,
        title: titleize(stem),
        before: null,
        after: null,
        unpaired: null
      }
      entry.after = rel
      byKey.set(key, entry)
      continue
    }

    byKey.set(keyPrefix + fileName, {
      topic,
      relDir,
      stem: fileName.replace(/\.png$/, ""),
      title: titleize(fileName.replace(/\.png$/, "")),
      before: null,
      after: null,
      unpaired: rel
    })
  }

  const groups = []
  const singles = []
  let byteIdentical = 0
  let byteDifferent = 0
  let visuallyDifferent = 0
  const topicSet = new Set()

  for (const entry of byKey.values()) {
    topicSet.add(entry.topic)
    const id = entry.relDir ? `${entry.relDir}/${entry.stem}` : entry.stem

    if (entry.before && entry.after) {
      const comparison = compareFiles(entry.before, entry.after)
      if (comparison.byteIdentical) byteIdentical++
      else byteDifferent++
      if (comparison.diff && !comparison.diff.pixelIdentical) visuallyDifferent++

      groups.push({
        id,
        topic: entry.topic,
        title: entry.title,
        before: entry.before,
        after: entry.after,
        ...comparison
      })
    } else if (entry.after) {
      singles.push({
        id,
        topic: entry.topic,
        title: entry.title,
        image: entry.after,
        note: "after only"
      })
    } else if (entry.before) {
      singles.push({
        id,
        topic: entry.topic,
        title: entry.title,
        image: entry.before,
        note: "before only"
      })
    } else if (entry.unpaired) {
      singles.push({
        id,
        topic: entry.topic,
        title: entry.title,
        image: entry.unpaired,
        note: "single"
      })
    }
  }

  const topicOrder = (a, b) => {
    // Prefer current work first, then alpha; stash "(root)" / prior last-ish.
    const rank = (t) => {
      if (t === "share-case") return 0
      if (t === "(root)") return 90
      if (t === "prior") return 100
      return 50
    }
    const d = rank(a) - rank(b)
    return d !== 0 ? d : a.localeCompare(b)
  }

  groups.sort((a, b) => topicOrder(a.topic, b.topic) || a.id.localeCompare(b.id))
  singles.sort((a, b) => topicOrder(a.topic, b.topic) || a.id.localeCompare(b.id))

  const topics = [...topicSet].sort(topicOrder)

  return {
    generatedAt: new Date().toISOString(),
    shotDir: ".playwright-mcp",
    summary: {
      pairs: groups.length,
      byteIdentical,
      byteDifferent,
      visuallyDifferent,
      topics: topics.length
    },
    topics,
    groups,
    singles
  }
}

const manifest = buildManifest()
const history = readHistory(repoRoot)
const tracker = readScreenshotTracker(repoRoot)
const linkedScreens = linkedScreenshotStatus(repoRoot, tracker, history)
manifest.compare = COMPARE_OPTIONS
manifest.screenshots = linkedScreens
const linkedById = new Map(linkedScreens.map((screen) => [screen.id, screen]))
const imageExists = (image) => image && storedImageStatus(repoRoot, { image }).status === "available"
const current = { groups: [], singles: [], branch: history.branch }
const revisions = []
for (const screen of Object.values(history.screens)) {
  const versions = screen.versions
  const now = versions.at(-1)
  if (!now) continue
  let stale = true
  const linked = linkedById.get(screen.id)
  try {
    const paths = screenshotPaths(screen.id, screen.paths, tracker)
    stale = linked ? linked.current.status === "stale" : !screenshotSourceCurrent(repoRoot, screen, paths, sourceFingerprint(repoRoot, paths))
  } catch {
    // Removed source remains visibly pending until a replacement capture is recorded.
  }
  const entry = {
    id: screen.id,
    screenId: screen.id,
    topic: screen.area,
    title: screen.title,
    stale,
    captureStatus: linked?.current.status || (imageExists(now.image) ? stale ? "stale" : "current" : "missing"),
    versions,
    now,
    legacy: screen.legacy || null,
    legacyComparison: imageExists(screen.legacy?.image) && imageExists(now.image) ? {
      before: screen.legacy.image,
      after: now.image,
      ...compareFiles(screen.legacy.image, now.image)
    } : null
  }
  const before = versions.at(-2)
  if (before && imageExists(before.image) && imageExists(now.image)) {
    current.groups.push({ ...entry, before: before.image, after: now.image, ...compareFiles(before.image, now.image) })
  } else {
    current.singles.push({ ...entry, image: now.image, note: "First capture" })
  }
  for (let index = 0; index < versions.length; index++) {
    const version = versions[index]
    revisions.push({
      id: `${screen.id}@${index + 1}`,
      screenId: screen.id,
      topic: screen.area,
      title: `${screen.title} — version ${index + 1}`,
      image: version.image,
      note: `${version.capturedAt} · ${version.commit.slice(0, 8)}${version.dirty ? " + edits" : ""}`
    })
  }
}
current.groups.sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id, undefined, { numeric: true }))
current.singles.sort((a, b) => a.topic.localeCompare(b.topic) || a.id.localeCompare(b.id, undefined, { numeric: true }))
markDuplicateCaptures(current)
markSimilarCaptures(current)
manifest.current = current
manifest.history = revisions
if (fs.existsSync(shotDir)) saveDiffCache()
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Wrote ${manifest.groups.length} comparison(s) (${manifest.summary.byteIdentical} byte-identical, ${manifest.summary.byteDifferent} different, ${manifest.summary.visuallyDifferent} with visual changes) and ${manifest.singles.length} single image(s) across ${manifest.topics.length} topic folder(s) to ${path.relative(repoRoot, manifestPath)}`
)

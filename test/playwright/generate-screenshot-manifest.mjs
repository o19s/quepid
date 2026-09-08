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
 * Run via: yarn screenshots:view  (or node test/playwright/generate-screenshot-manifest.mjs)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")
const shotDir = path.join(repoRoot, ".playwright-mcp")
const manifestPath = path.join(__dirname, "screenshot-manifest.json")

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

  return {
    beforeSize: beforeBytes.length,
    afterSize: afterBytes.length,
    byteIdentical: buffersEqual(beforeBytes, afterBytes)
  }
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

function buildManifest() {
  if (!fs.existsSync(shotDir)) {
    return {
      generatedAt: new Date().toISOString(),
      shotDir: ".playwright-mcp",
      summary: { pairs: 0, byteIdentical: 0, byteDifferent: 0, topics: 0 },
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
  const topicSet = new Set()

  for (const entry of byKey.values()) {
    topicSet.add(entry.topic)
    const id = entry.relDir ? `${entry.relDir}/${entry.stem}` : entry.stem

    if (entry.before && entry.after) {
      const comparison = compareFiles(entry.before, entry.after)
      if (comparison.byteIdentical) byteIdentical++
      else byteDifferent++

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
      topics: topics.length
    },
    topics,
    groups,
    singles
  }
}

const manifest = buildManifest()
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Wrote ${manifest.groups.length} comparison(s) (${manifest.summary.byteIdentical} byte-identical, ${manifest.summary.byteDifferent} different) and ${manifest.singles.length} single image(s) across ${manifest.topics.length} topic folder(s) to ${path.relative(repoRoot, manifestPath)}`
)

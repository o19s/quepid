#!/usr/bin/env node
/**
 * Scan .playwright-mcp/ for PNGs and write screenshot-manifest.json for
 * test/playwright/screenshot-viewer.html.
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

function compareFiles(beforeName, afterName) {
  const beforePath = path.join(shotDir, beforeName)
  const afterPath = path.join(shotDir, afterName)
  const beforeBytes = fs.readFileSync(beforePath)
  const afterBytes = fs.readFileSync(afterPath)

  return {
    beforeSize: beforeBytes.length,
    afterSize: afterBytes.length,
    byteIdentical: buffersEqual(beforeBytes, afterBytes)
  }
}

function buildManifest() {
  if (!fs.existsSync(shotDir)) {
    return {
      generatedAt: new Date().toISOString(),
      shotDir: ".playwright-mcp",
      summary: { pairs: 0, byteIdentical: 0, byteDifferent: 0 },
      groups: [],
      singles: []
    }
  }

  const files = fs
    .readdirSync(shotDir)
    .filter((name) => name.endsWith(".png"))
    .sort()

  const byStem = new Map()

  for (const name of files) {
    const before = name.match(/^(.+)-before\.png$/)
    const after = name.match(/^(.+)-after\.png$/)

    if (before) {
      const stem = before[1]
      const entry = byStem.get(stem) || {
        stem,
        title: titleize(stem),
        before: null,
        after: null,
        unpaired: null
      }
      entry.before = name
      byStem.set(stem, entry)
      continue
    }

    if (after) {
      const stem = after[1]
      const entry = byStem.get(stem) || {
        stem,
        title: titleize(stem),
        before: null,
        after: null,
        unpaired: null
      }
      entry.after = name
      byStem.set(stem, entry)
      continue
    }

    // Not a before/after pair name — keep as a plain single (don't call it "after").
    byStem.set(name, {
      stem: name.replace(/\.png$/, ""),
      title: titleize(name.replace(/\.png$/, "")),
      before: null,
      after: null,
      unpaired: name
    })
  }

  const groups = []
  const singles = []
  let byteIdentical = 0
  let byteDifferent = 0

  for (const entry of byStem.values()) {
    if (entry.before && entry.after) {
      const comparison = compareFiles(entry.before, entry.after)
      if (comparison.byteIdentical) byteIdentical++
      else byteDifferent++

      groups.push({
        id: entry.stem,
        title: entry.title,
        before: entry.before,
        after: entry.after,
        ...comparison
      })
    } else if (entry.after) {
      // Filename ends in -after.png but no matching -before.png exists.
      singles.push({
        id: entry.stem,
        title: entry.title,
        image: entry.after,
        note: "after only"
      })
    } else if (entry.before) {
      singles.push({
        id: entry.stem,
        title: entry.title,
        image: entry.before,
        note: "before only"
      })
    } else if (entry.unpaired) {
      singles.push({
        id: entry.stem,
        title: entry.title,
        image: entry.unpaired,
        note: "single"
      })
    }
  }

  groups.sort((a, b) => a.id.localeCompare(b.id))
  singles.sort((a, b) => a.id.localeCompare(b.id))

  return {
    generatedAt: new Date().toISOString(),
    shotDir: ".playwright-mcp",
    summary: {
      pairs: groups.length,
      byteIdentical,
      byteDifferent
    },
    groups,
    singles
  }
}

const manifest = buildManifest()
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Wrote ${manifest.groups.length} comparison(s) (${manifest.summary.byteIdentical} byte-identical, ${manifest.summary.byteDifferent} different) and ${manifest.singles.length} single image(s) to ${path.relative(repoRoot, manifestPath)}`
)

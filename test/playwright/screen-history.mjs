import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { decodePng } from "./png-diff.mjs"

const digest = (value) => crypto.createHash("sha256").update(value).digest("hex")
const git = (root, ...args) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim()

export function historyLocation(root) {
  const branch = git(root, "branch", "--show-current") || `detached:${git(root, "rev-parse", "HEAD")}`
  const relative = `.screen-history/${digest(branch).slice(0, 20)}`
  return { branch, relative, directory: path.join(root, ".playwright-mcp", relative) }
}

export function readHistory(root) {
  const location = historyLocation(root)
  const index = path.join(location.directory, "index.json")
  return fs.existsSync(index)
    ? JSON.parse(fs.readFileSync(index, "utf8"))
    : { version: 1, branch: location.branch, screens: {} }
}

export function sourceFingerprint(root, paths) {
  if (!paths?.length) throw new Error("At least one source path is required")
  for (const source of paths) {
    if (path.isAbsolute(source) || source.split("/").includes("..") || source.startsWith(".playwright-mcp")) {
      throw new Error(`Invalid source path: ${source}`)
    }
  }
  const files = [...new Set(git(root, "ls-files", "-z", "--cached", "--others", "--exclude-standard").split("\0"))]
    .filter(Boolean)
    .filter((file) => paths.some((source) => {
      if (source.includes("*")) {
        const pattern = source.split("*").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")
        return new RegExp(`^${pattern}$`).test(file)
      }
      return file === source || file.startsWith(`${source.replace(/\/$/, "")}/`)
    }))
    .filter((file) => fs.existsSync(path.join(root, file)))
    .sort()
  const hash = crypto.createHash("sha256")
  hash.update(JSON.stringify([...paths].sort()))
  for (const file of files) {
    hash.update(`\0${file}\0`)
    const absolute = path.join(root, file)
    hash.update(digest(fs.readFileSync(absolute)))
  }
  if (!files.length) throw new Error("Source paths match no existing files")
  return hash.digest("hex")
}

export function recordScreen(root, { id, title, area, paths, image, source, legacyImage, legacyRef, legacyAbsent }) {
  if (!id || !title || !area) throw new Error("Screen ID, title and application area are required")
  const location = historyLocation(root)
  fs.mkdirSync(location.directory, { recursive: true })
  const lock = path.join(location.directory, "record.lock")
  const descriptor = fs.openSync(lock, "wx")
  try {
    const fingerprint = sourceFingerprint(root, paths)
    if (source !== fingerprint) throw new Error("Source changed since the capture was prepared; recapture against current code")
    const history = readHistory(root)
    const existing = history.screens[id]
    const unchanged = existing?.versions.at(-1)?.source === fingerprint
    if (unchanged) {
      const current = existing.versions.at(-1)
      const target = path.join(root, ".playwright-mcp", current.image)
      if (!fs.existsSync(target)) {
        if (!image) throw new Error("Stored current screenshot is missing; restore the original image")
        const bytes = fs.readFileSync(image)
        decodePng(bytes)
        if (!current.image.endsWith(`-${digest(bytes).slice(0, 16)}.png`)) {
          throw new Error("Source is unchanged; restoring a missing screenshot requires the original image bytes")
        }
        fs.writeFileSync(target, bytes, { flag: "wx" })
      }
      if (!legacyImage && !legacyAbsent) return { updated: false, id, source: fingerprint }
    }
    if (legacyImage && legacyAbsent) throw new Error("Supply a legacy image or mark it absent, not both")
    if ((legacyImage || legacyAbsent) && !legacyRef) throw new Error("A legacy source ref is required")
    if ((legacyImage || legacyAbsent) && existing?.legacy) throw new Error("Legacy is already recorded for this screen")
    const screen = existing || { id, title, area, paths, versions: [] }
    const copyImage = (input, label) => {
      const bytes = fs.readFileSync(input)
      decodePng(bytes)
      const filename = `${digest(id).slice(0, 20)}-${label}-${digest(bytes).slice(0, 16)}.png`
      const target = path.join(location.directory, filename)
      if (!fs.existsSync(target)) fs.writeFileSync(target, bytes, { flag: "wx" })
      return `${location.relative}/${filename}`
    }
    const legacy = legacyImage || legacyAbsent ? {
      image: legacyImage ? copyImage(legacyImage, "legacy") : null,
      absent: Boolean(legacyAbsent),
      ref: git(root, "rev-parse", "--verify", `${legacyRef}^{commit}`),
      capturedAt: new Date().toISOString()
    } : null
    if (!unchanged && !image) throw new Error("A screenshot is required for changed source")
    Object.assign(screen, { title, area, paths })
    if (!unchanged) screen.versions.push({
      image: copyImage(image, screen.versions.length + 1),
      source: fingerprint,
      commit: git(root, "rev-parse", "HEAD"),
      dirty: Boolean(git(root, "status", "--porcelain", "--", ...paths)),
      capturedAt: new Date().toISOString()
    })
    if (legacy) screen.legacy = legacy
    history.screens[id] = screen
    const temporary = path.join(location.directory, "index.json.tmp")
    fs.writeFileSync(temporary, `${JSON.stringify(history, null, 2)}\n`)
    fs.renameSync(temporary, path.join(location.directory, "index.json"))
    return { updated: true, id, source: fingerprint, versions: screen.versions.length }
  } finally {
    fs.closeSync(descriptor)
    fs.unlinkSync(lock)
  }
}

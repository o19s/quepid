#!/usr/bin/env node
// Replaces byte-identical PNGs under .playwright-mcp with copy-on-write clones of one copy,
// so repeated captures share disk blocks. Every path keeps its bytes, and writing to one
// clone later leaves the others unchanged (unlike hard links). macOS host only, not in
// Docker: Node's COPYFILE_FICLONE does a full copy on macOS, so this shells out to cp -c.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const hash = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")
const first = new Map()
let cloned = 0
let bytes = 0
for (const entry of fs.readdirSync(path.join(root, ".playwright-mcp"), {
  recursive: true,
  withFileTypes: true
})) {
  if (!entry.isFile() || !entry.name.endsWith(".png")) continue
  const file = path.join(entry.parentPath, entry.name)
  const digest = hash(file)
  const original = first.get(digest)
  if (!original) {
    first.set(digest, file)
    continue
  }
  const temporary = `${file}.clonetmp`
  const { atime, mtime } = fs.statSync(file)
  execFileSync("cp", ["-c", original, temporary])
  fs.utimesSync(temporary, atime, mtime)
  // Either file may have been recaptured since it was hashed; never replace new bytes.
  if (hash(temporary) !== digest || hash(file) !== digest) {
    fs.unlinkSync(temporary)
    continue
  }
  fs.renameSync(temporary, file)
  cloned += 1
  bytes += fs.statSync(file).size
}
console.log(`${cloned} duplicate screenshots (${(bytes / 1e6).toFixed(0)} MB) are clones`)

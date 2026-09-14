#!/usr/bin/env node
/**
 * Regenerate screenshot-manifest.json and serve the repo root so the viewer
 * can load images from .playwright-mcp/.
 */

import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")
const port = Number(process.env.SCREENSHOT_VIEWER_PORT || 3456)

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8"
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8"
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".webp")) return "image/webp"
  return "application/octet-stream"
}

function runManifestGenerator() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, "generate-screenshot-manifest.mjs")], {
      cwd: repoRoot,
      stdio: "inherit"
    })
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`manifest generator exited ${code}`))))
  })
}

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0])
  const relative = decoded.replace(/^\/+/, "")
  const absolute = path.resolve(repoRoot, relative)
  if (!absolute.startsWith(repoRoot)) return null
  return absolute
}

await runManifestGenerator()

const server = http.createServer((req, res) => {
  const target = safePath(req.url === "/" ? "/test/playwright/screenshot-viewer.html" : req.url)
  if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found")
    return
  }

  res.writeHead(200, { "Content-Type": contentType(target) })
  fs.createReadStream(target).pipe(res)
})

server.listen(port, () => {
  const url = `http://localhost:${port}/test/playwright/screenshot-viewer.html`
  console.log(`Screenshot viewer: ${url}`)
  console.log("Ctrl+C to stop.")
})

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

import { screenshotReviews, setScreenshotApproval } from "./screenshot-reviews.mjs"

import { CaptureJobs } from "./capture-jobs.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "../..")
const port = Number(process.env.SCREENSHOT_VIEWER_PORT || 3456)
const host = process.env.SCREENSHOT_VIEWER_HOST || "127.0.0.1"

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
  if (absolute !== repoRoot && !absolute.startsWith(repoRoot + path.sep)) return null
  if (!["test/playwright/screenshot-viewer.html", "test/playwright/screenshot-manifest.json"].includes(relative) &&
      !(relative.startsWith(".playwright-mcp/") && /\.(png|webp)$/.test(relative))) return null
  if (!fs.existsSync(absolute)) return null
  const real = fs.realpathSync(absolute)
  if (!real.startsWith(repoRoot + path.sep)) return null
  if (relative.startsWith(".playwright-mcp/") && !real.startsWith(path.join(repoRoot, ".playwright-mcp") + path.sep)) return null
  return absolute
}

await runManifestGenerator()
const captures = new CaptureJobs(repoRoot, runManifestGenerator)

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/reviews" || req.url === "/api/captures" || req.url.startsWith("/api/captures/")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.setHeader("Cache-Control", "no-store")
    try {
      if (req.method === "GET") {
        const data = req.url === "/api/reviews" ? screenshotReviews(repoRoot) : req.url.startsWith("/api/captures/") ? captures.get(req.url.slice("/api/captures/".length)) : captures.active()
        res.end(JSON.stringify(data))
        return
      }
      if (req.method !== "POST") {
        res.writeHead(405, { Allow: "GET, POST" })
        res.end(JSON.stringify({ error: "Method not allowed" }))
        return
      }
      if (req.headers.origin !== `http://${req.headers.host}` || req.headers["content-type"] !== "application/json") {
        res.writeHead(403)
        res.end(JSON.stringify({ error: "Viewer actions require a same-origin JSON request" }))
        return
      }
      let body = ""
      for await (const chunk of req) {
        body += chunk
        if (Buffer.byteLength(body) > 16384) throw new Error("Request too large")
      }
      if (req.url !== "/api/reviews" && req.url !== "/api/captures") throw new Error("Invalid action URL")
      const data = req.url === "/api/captures" ? captures.start(JSON.parse(body)) : setScreenshotApproval(repoRoot, JSON.parse(body))
      res.writeHead(req.url === "/api/captures" ? 202 : 200)
      res.end(JSON.stringify(data))
    } catch (error) {
      res.writeHead(409)
      res.end(JSON.stringify({ error: error.message }))
    }
    return
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" })
    res.end("Method not allowed")
    return
  }
  let target
  try {
    target = safePath(req.url === "/" ? "/test/playwright/screenshot-viewer.html" : req.url)
  } catch {
    res.writeHead(400)
    res.end("Invalid path")
    return
  }
  if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" })
    res.end("Not found")
    return
  }

  res.writeHead(200, { "Content-Type": contentType(target), "Cache-Control": "no-store" })
  fs.createReadStream(target).on("error", () => res.destroy()).pipe(res)
})

server.listen(port, host, () => {
  const url = `http://${host}:${port}/test/playwright/screenshot-viewer.html`
  console.log(`Screenshot viewer: ${url}`)
  console.log("Ctrl+C to stop.")
})

import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import os from "node:os"
import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"
import { duplicateCaptures, readHistory, sourceFingerprint } from "./screen-history.mjs"
import { captureOptions } from "./capture-options.mjs"
import { captureRecipes } from "./capture-registry.mjs"

const execute = promisify(execFile)

export async function captureContainer(root) {
  if (process.env.SCREENSHOT_CAPTURE_CONTAINER) return process.env.SCREENSHOT_CAPTURE_CONTAINER
  const envFile = path.join(root, ".env")
  const configuredPort = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8").match(/^APP_PORT=["']?(\d+)/m)?.[1] : null
  const port = Number(process.env.APP_PORT || configuredPort || 3000)
  const { stdout } = await execute("docker", ["compose", "ps", "-a", "app", "--format", "json"], { cwd: root })
  const containers = stdout.trim().split("\n").filter(Boolean).flatMap((line) => JSON.parse(line))
  const matches = containers.filter((container) => container.State === "running" && container.Publishers?.some((publisher) => publisher.TargetPort === 3000 && publisher.PublishedPort === port))
  if (matches.length !== 1) throw new Error(`Expected one running app server on port ${port}; configure SCREENSHOT_CAPTURE_CONTAINER for the actual server`)
  return matches[0].Name
}

export async function runCapture(root, request, progress) {
  if (!Object.hasOwn(captureRecipes, request.id)) {
    const { runClaudeCapture } = await import("./capture-claude.mjs")
    return runClaudeCapture(root, request, progress)
  }
  const container = await captureContainer(root)
  progress("Starting capture browser…")
  await new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "node", "test/playwright/capture-screenshot.mjs"], { cwd: root, stdio: ["pipe", "pipe", "pipe"] })
    let pending = ""
    let errorOutput = ""
    child.stdout.on("data", (chunk) => {
      pending += chunk
      const lines = pending.split("\n")
      pending = lines.pop()
      for (const line of lines) {
        try { progress(JSON.parse(line).message) } catch { /* Ignore non-event output. */ }
      }
    })
    child.stderr.on("data", (chunk) => { errorOutput = (errorOutput + chunk).slice(-8000) })
    child.on("error", reject)
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(errorOutput.trim() || `Capture worker exited ${code}`)))
    child.stdin.on("error", reject)
    child.stdin.end(JSON.stringify(request))
  })
}

export class CaptureJobs {
  constructor(root, regenerate, replay = runCapture, tracker) {
    this.root = root
    this.regenerate = regenerate
    this.replay = replay
    this.tracker = tracker
    this.directory = path.join(root, ".playwright-mcp", ".capture-jobs")
    this.lock = path.join(this.directory, "active")
  }

  get(jobId) {
    if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("Invalid capture job")
    const job = JSON.parse(fs.readFileSync(path.join(this.directory, `${jobId}.json`), "utf8"))
    if (job.owner?.host === os.hostname() && Number.isInteger(job.owner.pid) && job.owner.pid > 0) {
      try {
        process.kill(job.owner.pid, 0)
      } catch (error) {
        // EPERM still means the owner exists. Only a missing process is abandoned.
        if (error.code !== "ESRCH" && error.code !== "EPERM") throw error
        if (error.code === "ESRCH") {
          if (job.state === "running") {
            job.state = "failed"
            job.message = "Capture interrupted because its viewer stopped. Retry capture."
            this.save(job)
          }
          this.release(jobId)
        }
      }
    }
    return job
  }

  save(job) {
    const filename = path.join(this.directory, `${job.jobId}.json`)
    const temporary = `${filename}.${crypto.randomUUID()}.tmp`
    try {
      fs.writeFileSync(temporary, JSON.stringify(job))
      fs.renameSync(temporary, filename)
    } finally {
      fs.rmSync(temporary, { force: true })
    }
  }

  release(jobId) {
    if (fs.existsSync(this.lock) && fs.readFileSync(this.lock, "utf8") === jobId) fs.unlinkSync(this.lock)
  }

  active() {
    if (!fs.existsSync(this.lock)) return null
    return this.get(fs.readFileSync(this.lock, "utf8"))
  }

  start({ id, branch, source, image, capturedAt }) {
    const options = captureOptions(this.root, id, this.tracker)
    const history = readHistory(this.root)
    const current = history.screens[id]?.versions.at(-1)
    if (history.branch !== branch || !current || current.source !== source || current.image !== image || current.capturedAt !== capturedAt) {
      throw new Error("Displayed capture changed; reload the viewer before recapturing")
    }
    if (options.id !== id) throw new Error("Capture recipe does not match the tracker screen ID")
    const fingerprint = sourceFingerprint(this.root, options.paths)
    fs.mkdirSync(this.directory, { recursive: true })
    this.active()
    const job = { jobId: crypto.randomUUID(), id, state: "running", message: "Preparing capture…", owner: { pid: process.pid, host: os.hostname() } }
    const preparedLock = path.join(this.directory, `${job.jobId}.lock`)
    // Publish an initialized lock only after the owning job is readable.
    // An interrupted preparation must not leave an empty or ownerless active lock.
    this.save(job)
    try {
      fs.writeFileSync(preparedLock, job.jobId, { flag: "wx" })
      fs.linkSync(preparedLock, this.lock)
    } catch (error) {
      fs.rmSync(path.join(this.directory, `${job.jobId}.json`), { force: true })
      if (error.code === "EEXIST") throw new Error("Another screenshot capture is running; retry when it finishes")
      throw error
    } finally {
      fs.rmSync(preparedLock, { force: true })
    }
    const save = () => this.save(job)
    const progress = (message) => { job.message = message; save() }
    const request = { jobId: job.jobId, id, branch, source: fingerprint, current }
    this.completion = (async () => {
      try {
        await this.replay(this.root, request, progress)
        progress("Updating screenshot comparisons…")
        await this.regenerate()
        job.state = "succeeded"
        job.message = "Current screenshot captured. Review the new image."
        const duplicates = duplicateCaptures(this.root, id)
        if (duplicates.length) job.message += ` Warning: it is identical to ${duplicates.map((other) => other.title).join(", ")} — confirm it shows the requested page.`
      } catch (error) {
        job.state = "failed"
        job.message = error.message
      } finally {
        try { save() } finally {
          this.release(job.jobId)
        }
      }
    })()
    return { ...job }
  }
}

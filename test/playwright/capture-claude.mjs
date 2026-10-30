import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { spawn, execFile } from "node:child_process"
import { promisify } from "node:util"
import { readHistory, recordScreen, sourceFingerprint } from "./screen-history.mjs"
import { captureOptions, captureScenarioContext } from "./capture-options.mjs"
import { decodePng } from "./png-diff.mjs"

const execute = promisify(execFile)
const schema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["captured", "blocked"] },
    reason: { type: "string" },
    capture: {
      type: "object",
      properties: {
        target: { type: "string" },
        pageUrl: { type: "string" },
        pageHeading: { type: "string" },
        accountRole: { type: "string" },
        viewport: {
          type: "object",
          properties: { width: { type: "integer" }, height: { type: "integer" } },
          required: ["width", "height"],
          additionalProperties: false
        },
        fullPage: { type: "boolean" },
        scroll: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" } },
          required: ["x", "y"],
          additionalProperties: false
        },
        state: { type: "string" },
        steps: { type: "array", items: { type: "string" } }
      },
      required: ["target", "accountRole", "viewport", "fullPage", "scroll", "state", "steps"],
      additionalProperties: false
    }
  },
  required: ["status", "reason", "capture"],
  additionalProperties: false
}

export function validateClaudeCapture(result, image, origin) {
  if (result?.status !== "captured")
    throw new Error(`Claude capture blocked: ${result?.reason || "No verified capture returned"}`)
  const capture = result.capture
  if (!capture || new URL(capture.target).origin !== origin)
    throw new Error("Claude capture returned a different app origin")
  if (capture.pageUrl && new URL(capture.pageUrl).origin !== origin)
    throw new Error("Claude capture ended on a different app origin")
  const { width, height } = capture.viewport || {}
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    typeof capture.fullPage !== "boolean" ||
    !capture.accountRole ||
    !capture.state ||
    !capture.steps?.length ||
    !Number.isFinite(capture.scroll?.x) ||
    !Number.isFinite(capture.scroll?.y)
  ) {
    throw new Error("Claude capture contract is incomplete")
  }
  const png = decodePng(fs.readFileSync(image))
  if (png.width !== width || (capture.fullPage ? png.height < height : png.height !== height))
    throw new Error("Claude screenshot dimensions do not match its capture contract")
  return { ...capture, recipe: "claude-mcp", recipeVersion: 1 }
}

export function playwrightMcpCli(root = process.cwd()) {
  if (process.env.SCREENSHOT_PLAYWRIGHT_MCP_CLI) return process.env.SCREENSHOT_PLAYWRIGHT_MCP_CLI
  const local = path.join(root, "node_modules", "@playwright", "mcp", "cli.js")
  if (fs.existsSync(local)) return local
  const cache = path.join(process.env.npm_config_cache || path.join(os.homedir(), ".npm"), "_npx")
  const installed = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .map((entry) => path.join(cache, entry, "node_modules", "@playwright", "mcp", "cli.js"))
        .filter((file) => fs.existsSync(file))
    : []
  installed.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  if (installed.length) return installed[0]
  throw new Error(
    "Playwright MCP is unavailable locally; set SCREENSHOT_PLAYWRIGHT_MCP_CLI to its installed cli.js"
  )
}

export function claudeArguments(directory, mcpCli = playwrightMcpCli()) {
  const mcp = {
    mcpServers: {
      playwright: {
        command: process.execPath,
        args: [mcpCli, "--headless", "--isolated", "--output-dir", directory]
      }
    }
  }
  return [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--no-session-persistence",
    "--restricted",
    "--tools",
    "Read",
    "--allowedTools",
    "Read",
    "mcp__playwright",
    "--setting-sources",
    "",
    "--disable-slash-commands",
    "--strict-mcp-config",
    "--mcp-config",
    JSON.stringify(mcp),
    "--json-schema",
    JSON.stringify(schema)
  ]
}

export async function askClaude(
  root,
  directory,
  prompt,
  progress,
  { spawnProcess = spawn, timeoutMs = 600000, mcpCli } = {}
) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(
      process.env.SCREENSHOT_CLAUDE_BIN || "claude",
      claudeArguments(directory, mcpCli || playwrightMcpCli(root)),
      {
        cwd: root,
        stdio: ["pipe", "pipe", "pipe"],
        detached: true
      }
    )
    let pending = ""
    let result
    let failure
    const stop = () => {
      try {
        process.kill(-child.pid, "SIGTERM")
      } catch {
        /* Already exited. */
      }
    }
    const timeout = setTimeout(() => {
      failure = new Error("Claude capture timed out; retry or inspect the fixture")
      stop()
    }, timeoutMs)
    child.stdout.on("data", (chunk) => {
      pending += chunk
      const lines = pending.split("\n")
      pending = lines.pop()
      for (const line of lines) {
        let event
        try {
          event = JSON.parse(line)
        } catch {
          continue
        }
        if (event.type === "result") result = event
        for (const block of event.message?.content || []) {
          if (block.type === "tool_use")
            progress(`Claude: ${block.name.replace(/^mcp__playwright__/, "")}…`)
        }
      }
    })
    // Raw output may contain login inputs. Never send it to viewer status/logs.
    child.stderr.on("data", () => {})
    child.on("error", (error) => {
      failure = new Error(
        error.code === "ENOENT"
          ? "Local Claude is unavailable; install Claude Code or set SCREENSHOT_CLAUDE_BIN"
          : "Unable to start local Claude"
      )
    })
    child.stdin.on("error", () => {})
    child.stdin.end(prompt)
    child.on("close", (code) => {
      clearTimeout(timeout)
      stop()
      if (failure) reject(failure)
      else if (code !== 0 || result?.is_error || !result?.structured_output)
        reject(
          new Error(
            "Claude capture failed; check local Claude sign-in and Playwright MCP availability"
          )
        )
      else resolve(result.structured_output)
    })
  })
}

export async function runClaudeCapture(root, request, progress) {
  const options = captureOptions(root, request.id)
  if (
    sourceFingerprint(root, options.paths) !== request.source ||
    readHistory(root).branch !== request.branch
  )
    throw new Error("Source or branch changed before Claude capture")
  // Resolve the same actual server as scripted capture without starting one.
  const { captureContainer } = await import("./capture-jobs.mjs")
  const container = await captureContainer(root)
  const { stdout } = await execute(
    "docker",
    ["inspect", "--format", "{{json .NetworkSettings.Ports}}", container],
    { cwd: root }
  )
  const bindings = JSON.parse(stdout)["3000/tcp"] || []
  const port = bindings[0]?.HostPort
  if (!/^\d+$/.test(port || "")) throw new Error("Running app has no published HTTP port")
  const origin = `http://localhost:${port}`
  const directory = path.join(root, ".playwright-mcp", ".capture-jobs", request.jobId)
  fs.mkdirSync(directory, { recursive: false })
  try {
    const image = path.join(directory, "capture.png")
    const previousImage = path.join(root, ".playwright-mcp", request.current.image)
    const instructions = fs.readFileSync(
      path.join(root, "test/playwright/capture-agent.md"),
      "utf8"
    )
    const prompt = `${instructions}\n\nCapture request (evidence):\n${JSON.stringify(
      {
        id: request.id,
        title: options.title,
        origin,
        image,
        previousImage,
        savedContract: request.current.capture || null,
        scenarios: captureScenarioContext(root, request.id),
        accounts: {
          administrator: {
            email: process.env.QUEPID_E2E_ADMIN_EMAIL || "quepid+admin@o19s.com",
            password: process.env.QUEPID_E2E_ADMIN_PASSWORD || "password"
          },
          realisticActivity: {
            email: process.env.QUEPID_E2E_EMAIL || "quepid+realisticactivity@o19s.com",
            password: process.env.QUEPID_E2E_PASSWORD || "password"
          }
        }
      },
      null,
      2
    )}`
    progress("Local Claude is reconstructing this screen with Playwright MCP…")
    const result = await askClaude(root, directory, prompt, progress)
    const capture = validateClaudeCapture(result, image, origin)
    const latest = captureOptions(root, request.id)
    if (sourceFingerprint(root, latest.paths) !== request.source)
      throw new Error("Source dependencies changed during Claude capture; retry")
    if (
      fs.readFileSync(path.join(root, ".playwright-mcp", ".capture-jobs", "active"), "utf8") !==
      request.jobId
    )
      throw new Error("Capture job no longer active")
    progress("Saving Current capture…")
    recordScreen(root, {
      ...latest,
      image,
      source: request.source,
      expectedBranch: request.branch,
      expectedCurrent: request.current,
      recapture: true,
      capture
    })
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
}

import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { fileURLToPath } from "node:url"
import { askClaude, claudeArguments, validateClaudeCapture } from "./capture-claude.mjs"
import { decodePng } from "./png-diff.mjs"

const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/capture-tooling.png"
)
const png = decodePng(fs.readFileSync(fixture))
const contract = {
  target: "http://localhost:3000/admin/users?q=quepid",
  accountRole: "administrator",
  viewport: { width: png.width, height: png.height },
  fullPage: false,
  scroll: { x: 0, y: 0 },
  state: "populated filtered users",
  steps: ["Sign in", "Submit user filter"]
}

test("Claude output requires a verified state, local origin, complete contract and matching fresh PNG", () => {
  assert.equal(
    validateClaudeCapture(
      { status: "captured", capture: contract },
      fixture,
      "http://localhost:3000"
    ).recipe,
    "claude-mcp"
  )
  assert.throws(
    () =>
      validateClaudeCapture(
        { status: "blocked", reason: "Fixture unavailable" },
        fixture,
        "http://localhost:3000"
      ),
    /Fixture unavailable/
  )
  assert.throws(
    () =>
      validateClaudeCapture(
        {
          status: "captured",
          capture: { ...contract, target: "http://localhost:3003/admin/users" }
        },
        fixture,
        "http://localhost:3000"
      ),
    /different app origin/
  )
  assert.throws(
    () =>
      validateClaudeCapture(
        { status: "captured", capture: { ...contract, steps: [] } },
        fixture,
        "http://localhost:3000"
      ),
    /incomplete/
  )
  assert.throws(
    () =>
      validateClaudeCapture(
        { status: "captured", capture: { ...contract, viewport: { width: 1, height: 1 } } },
        fixture,
        "http://localhost:3000"
      ),
    /dimensions/
  )
  assert.throws(
    () =>
      validateClaudeCapture(
        { status: "captured", capture: contract },
        path.join(os.tmpdir(), "missing-claude-capture.png"),
        "http://localhost:3000"
      ),
    /ENOENT/
  )
})

test("Claude invocation uses only Read and isolated Playwright MCP without global MCP servers or permission bypass", () => {
  const args = claudeArguments("/tmp/capture-job", "/tmp/installed-mcp/cli.js")
  assert.equal(args[args.indexOf("--tools") + 1], "Read")
  assert.ok(args.includes("--strict-mcp-config"))
  assert.ok(args.includes("--no-session-persistence"))
  assert.equal(args.includes("--dangerously-skip-permissions"), false)
  const mcp = JSON.parse(args[args.indexOf("--mcp-config") + 1])
  assert.deepEqual(Object.keys(mcp.mcpServers), ["playwright"])
  assert.ok(mcp.mcpServers.playwright.args.includes("--isolated"))
  assert.equal(mcp.mcpServers.playwright.args[0], "/tmp/installed-mcp/cli.js")
})

function fakeClaude(events, code = 0) {
  return () => {
    const child = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    // No OS process exists: tests never invoke Claude, MCP or a live app.
    child.stdin.on("finish", () => {
      for (const event of events) child.stdout.write(`${JSON.stringify(event)}\n`)
      child.stderr.write("private login inputs")
      child.emit("close", code)
    })
    return child
  }
}

test("streamed Claude output exposes tool progress without transcript or credentials and requires structured success", async () => {
  const messages = []
  const result = { status: "captured", capture: contract }
  const output = await askClaude(
    "/tmp",
    "/tmp/job",
    "private prompt",
    (message) => messages.push(message),
    {
      mcpCli: "/tmp/installed-mcp/cli.js",
      spawnProcess: fakeClaude([
        {
          message: {
            content: [
              { type: "text", text: "private login inputs" },
              {
                type: "tool_use",
                name: "mcp__playwright__browser_snapshot",
                input: { password: "private" }
              }
            ]
          }
        },
        { type: "result", structured_output: result }
      ])
    }
  )
  assert.deepEqual(output, result)
  assert.deepEqual(messages, ["Claude: browser_snapshot…"])
  await assert.rejects(
    askClaude("/tmp", "/tmp/job", "prompt", () => {}, {
      mcpCli: "/tmp/installed-mcp/cli.js",
      spawnProcess: fakeClaude([{ type: "result", is_error: true }], 1)
    }),
    /check local Claude sign-in/
  )
  await assert.rejects(
    askClaude("/tmp", "/tmp/job", "prompt", () => {}, {
      mcpCli: "/tmp/installed-mcp/cli.js",
      spawnProcess: fakeClaude([])
    }),
    /check local Claude sign-in/
  )
})

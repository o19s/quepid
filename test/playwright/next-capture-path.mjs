#!/usr/bin/env node
/**
 * Prints an unused absolute path for a Playwright MCP capture, so a retry
 * never overwrites an earlier image:
 *   node test/playwright/next-capture-path.mjs <topic> <name>
 * -> <repo>/.playwright-mcp/<topic>/<name>.png, or <name>-2.png, -3.png, ...
 * when earlier captures already exist.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export function nextCapturePath(root, topic, name) {
  // Topics may be nested folders (e.g. "branch-ui-diff/16.5"); each segment must be a plain name.
  const segment = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
  for (const part of [...(topic || "").split("/"), name || ""]) {
    if (!segment.test(part) || part.includes("..")) throw new Error(`Invalid capture path part: ${part}`)
  }
  const directory = path.join(root, ".playwright-mcp", topic)
  const stem = name.replace(/\.png$/, "")
  for (let attempt = 1; ; attempt++) {
    const candidate = path.join(directory, `${stem}${attempt === 1 ? "" : `-${attempt}`}.png`)
    if (!fs.existsSync(candidate)) return candidate
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [topic, name] = process.argv.slice(2)
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  try {
    console.log(nextCapturePath(root, topic, name))
  } catch (error) {
    console.error(`${error.message}\nUsage: node test/playwright/next-capture-path.mjs <topic> <name>`)
    process.exitCode = 1
  }
}
